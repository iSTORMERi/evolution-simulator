// src/debug/CurrentParticlesDebug.ts

import * as PIXI from 'pixi.js';
import { 
  OceanCurrentsManager, 
  CurrentZoneType, 
  ZONE_PARTICLE_COUNTS,
  UPWELLING_COLOR,
  DOWNWELLING_COLOR
} from '../simulation/OceanCurrentsManager';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  zone: CurrentZoneType;
  lengthScale: number;
  speedMultiplier: number; // 🟢 / 🟡 Индивидуальная скорость для размытия волн
  sprite: PIXI.Sprite;

  alpha: number;
  isDying: boolean;
  immunityTimer: number;

  // 🟢 / 🟡 Независимый визуальный слой
  isUpwelling?: boolean;
  isDownwelling?: boolean;
}

interface Vortex {
  x: number;
  y: number;
  radius: number;
  radiusSq: number;
  strength: number;
}

export class CurrentParticlesDebug {
  public container: PIXI.Container;
  private particles: Particle[] = [];
  private currentsManager: OceanCurrentsManager;

  private particleTexture: PIXI.Texture;

  // Цветовая палитра Layer 1 (HEX для PIXI)
  private readonly colorDeep = 0x8a00ff;     // 🟣 Фиолетовый (Глубоководное)
  private readonly colorCold = 0x0000ff;     // 🔵 Синий (Холодное)
  private readonly colorWarm = 0xff5500;     // 🟠 Оранжевый (Теплое)
  private readonly colorUpwelling = parseInt(UPWELLING_COLOR.replace('#', '0x'), 16);   // 🟢 Неоново-зелёный
  private readonly colorDownwelling = parseInt(DOWNWELLING_COLOR.replace('#', '0x'), 16); // 🟡 Жёлтый

  // Множители скорости для разных зон
  private readonly zoneSpeedMultipliers: Record<CurrentZoneType, number> = {
    [CurrentZoneType.WARM]: 1.0,
    [CurrentZoneType.COLD]: 0.5,
    [CurrentZoneType.DEEP]: 0.17
  };

  private readonly worldSize = 8000;
  private isInitializedWithMask: boolean = false;

  // Настройки поочередного спавна вертикальных течений (3 волны по 50 частиц)
  private pendingUpwelling = 150;
  private pendingDownwelling = 150;
  private spawnTimer = 0;
  private readonly BATCH_SIZE = 50;
  private readonly SPAWN_INTERVAL = 5.0; // Интервал 5 секунд

  // Spatial Grid & Flocking
  private readonly CELL_SIZE = 200;
  private readonly ALIGNMENT_RADIUS_SQ = 180 * 180;
  private readonly SEPARATION_RADIUS_SQ = 60 * 60;

  private readonly FLOCKING_STRENGTH = 0.10;
  private readonly SEPARATION_STRENGTH = 0.25;

  private readonly DENSITY_THRESHOLD = 14;
  private readonly FADE_SPEED = 1.5;
  private readonly IMMUNITY_DURATION = 3.0;

  private gridCols: number;
  private gridRows: number;
  private spatialGrid: Particle[][];

  private vortices: Vortex[] = [];

  private flockingVector = { vx: 0, vy: 0 };
  private swirlingVector = { vx: 0, vy: 0 };

  constructor(currentsManager: OceanCurrentsManager, totalCount: number = 10000) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();

    this.gridCols = Math.ceil(this.worldSize / this.CELL_SIZE);
    this.gridRows = Math.ceil(this.worldSize / this.CELL_SIZE);
    this.spatialGrid = new Array(this.gridCols * this.gridRows);
    for (let i = 0; i < this.spatialGrid.length; i++) {
      this.spatialGrid[i] = [];
    }

    this.generateVortices(45);
    this.particleTexture = this.generateCometTexture(64, 8);

    // Инициализация основных частиц и 1-й волны вертикальных течений
    this.initParticles(totalCount);
  }

  private generateVortices(count: number): void {
    this.vortices = [];
    for (let i = 0; i < count; i++) {
      const radius = 300 + Math.random() * 500;
      this.vortices.push({
        x: Math.random() * this.worldSize,
        y: Math.random() * this.worldSize,
        radius,
        radiusSq: radius * radius,
        strength: (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 80)
      });
    }
  }

  private generateCometTexture(width: number, height: number): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();

      const centerY = height / 2;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width - height, 0);
      ctx.arcTo(width, centerY, width - height, height, height / 2);
      ctx.lineTo(width - height, height);
      ctx.closePath();
      ctx.fill();
    }

    return PIXI.Texture.from(canvas);
  }

  private initParticles(mainCount: number): void {
    const scaleFactor = mainCount / 10000;
    const zones = [CurrentZoneType.DEEP, CurrentZoneType.COLD, CurrentZoneType.WARM];

    // 1. Основные частицы горизонтальных течений
    for (const zone of zones) {
      const countForZone = Math.round(ZONE_PARTICLE_COUNTS[zone] * scaleFactor);
      const spawnPoints = this.currentsManager.getInitialParticlesForZone(zone, countForZone);

      for (let i = 0; i < countForZone; i++) {
        const pt = spawnPoints[i] || { x: this.worldSize * 0.5, y: this.worldSize * 0.5 };
        this.createParticle(pt.x, pt.y, zone, false, false);
      }
    }

    // 2. Спавним первую волну из 50 частиц апвеллинга и даунвеллинга на старте
    this.spawnSpecialBatch();
  }

  private spawnSpecialBatch(): void {
    // 🟢 Апвеллинг
    const upToSpawn = Math.min(this.BATCH_SIZE, this.pendingUpwelling);
    for (let i = 0; i < upToSpawn; i++) {
      this.createParticle(this.worldSize * 0.5, this.worldSize * 0.5, CurrentZoneType.COLD, true, false);
    }
    this.pendingUpwelling -= upToSpawn;

    // 🟡 Даунвеллинг
    const downToSpawn = Math.min(this.BATCH_SIZE, this.pendingDownwelling);
    for (let i = 0; i < downToSpawn; i++) {
      this.createParticle(this.worldSize * 0.5, this.worldSize * 0.5, CurrentZoneType.WARM, false, true);
    }
    this.pendingDownwelling -= downToSpawn;
  }

  private createParticle(x: number, y: number, zone: CurrentZoneType, isUpwelling: boolean, isDownwelling: boolean): void {
    const sprite = new PIXI.Sprite(this.particleTexture);
    sprite.anchor.set(1.0, 0.5);

    const lengthScale = 0.8 + Math.random() * 1.7;
    const angle = Math.random() * Math.PI * 2;

    // Разброс скорости для вертикальных течений (0.4x - 0.9x)
    let speedMultiplier = 1.0;
    if (isUpwelling || isDownwelling) {
      speedMultiplier = 0.4 + Math.random() * 0.5;
    }

    this.container.addChild(sprite);

    const p: Particle = {
      x,
      y,
      vx: Math.cos(angle),
      vy: Math.sin(angle),
      zone,
      lengthScale,
      speedMultiplier,
      sprite,
      alpha: Math.random() * 0.85,
      isDying: false,
      immunityTimer: Math.random() * this.IMMUNITY_DURATION,
      isUpwelling,
      isDownwelling
    };

    if (isUpwelling || isDownwelling) {
      this.relocateSpecialParticle(p);
    }

    this.particles.push(p);
  }

  private relocateSpecialParticle(p: Particle): void {
    if (p.isUpwelling) {
      const pts = this.currentsManager.getInitialParticlesForZone(CurrentZoneType.DEEP, 1);
      const pos = pts[0] || { x: Math.random() * this.worldSize, y: Math.random() * this.worldSize };
      p.x = pos.x;
      p.y = pos.y;
    } else if (p.isDownwelling) {
      const pts = this.currentsManager.getInitialParticlesForZone(CurrentZoneType.WARM, 1);
      const pos = pts[0] || { x: Math.random() * this.worldSize, y: Math.random() * this.worldSize };
      p.x = pos.x;
      p.y = pos.y;
    }

    p.isDying = false;
    p.alpha = 0.1;
    p.immunityTimer = this.IMMUNITY_DURATION;
  }

  private relocateToZone(p: Particle): void {
    if (p.isUpwelling || p.isDownwelling) {
      this.relocateSpecialParticle(p);
      return;
    }

    const pts = this.currentsManager.getInitialParticlesForZone(p.zone, 1);
    const pos = pts[0] || { x: this.worldSize * 0.5, y: this.worldSize * 0.5 };

    p.x = pos.x;
    p.y = pos.y;

    const angle = Math.random() * Math.PI * 2;
    p.vx = Math.cos(angle);
    p.vy = Math.sin(angle);
    p.sprite.position.set(p.x, p.y);

    p.isDying = false;
    p.immunityTimer = this.IMMUNITY_DURATION;
  }

  private clearGrid(): void {
    const totalCells = this.spatialGrid.length;
    for (let i = 0; i < totalCells; i++) {
      this.spatialGrid[i].length = 0;
    }
  }

  private populateGrid(): void {
    const total = this.particles.length;
    for (let i = 0; i < total; i++) {
      const p = this.particles[i];
      // Игнорируем спец-частицы, чтобы они не участвовали в флоккинге
      if (p.isUpwelling || p.isDownwelling) continue;

      const cx = Math.floor(p.x / this.CELL_SIZE);
      const cy = Math.floor(p.y / this.CELL_SIZE);

      if (cx >= 0 && cx < this.gridCols && cy >= 0 && cy < this.gridRows) {
        const cellIndex = cy * this.gridCols + cx;
        this.spatialGrid[cellIndex].push(p);
      }
    }
  }

  private applyFlockingAndSeparation(p: Particle, out: { vx: number; vy: number }): void {
    const cx = Math.floor(p.x / this.CELL_SIZE);
    const cy = Math.floor(p.y / this.CELL_SIZE);

    let sumVx = 0;
    let sumVy = 0;
    let separateX = 0;
    let separateY = 0;
    let neighborCount = 0;

    const minX = cx > 0 ? cx - 1 : 0;
    const maxX = cx < this.gridCols - 1 ? cx + 1 : this.gridCols - 1;
    const minY = cy > 0 ? cy - 1 : 0;
    const maxY = cy < this.gridRows - 1 ? cy + 1 : this.gridRows - 1;

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * this.gridCols;
      for (let x = minX; x <= maxX; x++) {
        const cell = this.spatialGrid[rowOffset + x];
        const len = cell.length;

        for (let i = 0; i < len; i++) {
          const other = cell[i];

          if (other !== p && other.zone === p.zone) {
            const dx = p.x - other.x;
            const dy = p.y - other.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < this.ALIGNMENT_RADIUS_SQ && distSq > 0.0001) {
              sumVx += other.vx;
              sumVy += other.vy;
              neighborCount++;

              if (distSq < this.SEPARATION_RADIUS_SQ) {
                const dist = Math.sqrt(distSq);
                const factor = (this.SEPARATION_RADIUS_SQ - distSq) / dist;
                separateX += dx * factor;
                separateY += dy * factor;
              }
            }
          }
        }
      }
    }

    if (neighborCount >= this.DENSITY_THRESHOLD && p.immunityTimer <= 0 && !p.isDying) {
      p.isDying = true;
    }

    let resultVx = p.vx;
    let resultVy = p.vy;

    if (neighborCount > 0) {
      const avgVx = sumVx / neighborCount;
      const avgVy = sumVy / neighborCount;
      resultVx += (avgVx - p.vx) * this.FLOCKING_STRENGTH;
      resultVy += (avgVy - p.vy) * this.FLOCKING_STRENGTH;
    }

    out.vx = resultVx + separateX * this.SEPARATION_STRENGTH * 0.001;
    out.vy = resultVy + separateY * this.SEPARATION_STRENGTH * 0.001;
  }

  private applyVortices(x: number, y: number, inVx: number, inVy: number, out: { vx: number; vy: number }): void {
    let vortexVx = 0;
    let vortexVy = 0;
    const count = this.vortices.length;

    for (let i = 0; i < count; i++) {
      const v = this.vortices[i];
      const dx = x - v.x;
      const dy = y - v.y;

      if (Math.abs(dx) >= v.radius || Math.abs(dy) >= v.radius) continue;

      const distSq = dx * dx + dy * dy;
      if (distSq < v.radiusSq && distSq > 1.0) {
        const dist = Math.sqrt(distSq);
        const factor = (1.0 - dist / v.radius) * v.strength / dist;

        vortexVx += -dy * factor;
        vortexVy += dx * factor;
      }
    }

    out.vx = inVx + vortexVx;
    out.vy = inVy + vortexVy;
  }

  public update(deltaSeconds: number): void {
    if (this.currentsManager.isLoaded && !this.isInitializedWithMask) {
      for (const p of this.particles) {
        this.relocateToZone(p);
      }
      this.isInitializedWithMask = true;
    }

    // --- Спавн следующих волн через таймер ---
    if (this.pendingUpwelling > 0 || this.pendingDownwelling > 0) {
      this.spawnTimer += deltaSeconds;
      if (this.spawnTimer >= this.SPAWN_INTERVAL) {
        this.spawnTimer = 0;
        this.spawnSpecialBatch();
      }
    }

    this.clearGrid();
    this.populateGrid();

    const total = this.particles.length;

    for (let i = 0; i < total; i++) {
      const p = this.particles[i];

      if (p.immunityTimer > 0) {
        p.immunityTimer -= deltaSeconds;
      }

      // --- 1. Прозрачность и Респавн ---
      if (p.isDying) {
        p.alpha -= this.FADE_SPEED * deltaSeconds;
        if (p.alpha <= 0) {
          p.alpha = 0;
          this.relocateToZone(p);
        }
      } else {
        if (p.alpha < 0.85) {
          p.alpha += this.FADE_SPEED * deltaSeconds;
          if (p.alpha > 0.85) p.alpha = 0.85;
        }
      }

      // --- 2. Логика Движения ---
      if (p.isUpwelling) {
        // 🟢 Движение Апвеллинга с учётом индивидуальной скорости
        const upVector = this.currentsManager.getUpwellingVector();
        p.vx = upVector.vx * p.speedMultiplier;
        p.vy = upVector.vy * p.speedMultiplier;

        if (this.currentsManager.getUpwellingZoneAt(p.x, p.y) === 'EXIT' && p.immunityTimer <= 0) {
          p.isDying = true;
        }
      } else if (p.isDownwelling) {
        // 🟡 Движение Даунвеллинга с учётом индивидуальной скорости
        const downVector = this.currentsManager.getDownwellingVector();
        p.vx = downVector.vx * p.speedMultiplier;
        p.vy = downVector.vy * p.speedMultiplier;

        if (this.currentsManager.getDownwellingZoneAt(p.x, p.y) === 'EXIT' && p.immunityTimer <= 0) {
          p.isDying = true;
        }
      } else {
        // 🟣🔵🟠 Обычные частицы горизонтальных течений
        this.applyFlockingAndSeparation(p, this.flockingVector);
        this.applyVortices(p.x, p.y, this.flockingVector.vx, this.flockingVector.vy, this.swirlingVector);

        const current = this.currentsManager.getCurrentVectorForParticle(
          p.x,
          p.y,
          this.swirlingVector.vx,
          this.swirlingVector.vy,
          p.zone
        );

        const speedMultiplier = this.zoneSpeedMultipliers[p.zone] ?? 1.0;
        p.vx = current.vx * speedMultiplier;
        p.vy = current.vy * speedMultiplier;
      }

      p.x += p.vx * deltaSeconds;
      p.y += p.vy * deltaSeconds;

      // Границы мира
      if (p.x <= 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      if (p.x >= this.worldSize) { p.x = this.worldSize; p.vx = -Math.abs(p.vx); }
      if (p.y <= 0) { p.y = 0; p.vy = Math.abs(p.vy); }
      if (p.y >= this.worldSize) { p.y = this.worldSize; p.vy = -Math.abs(p.vy); }

      // Вращение и масштаб
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 0.01) {
        p.sprite.rotation = Math.atan2(p.vy, p.vx);
      }

      const currentSpeedFactor = Math.min(2.0, Math.max(0.5, speed / 100));
      p.sprite.scale.x = p.lengthScale * currentSpeedFactor;
      p.sprite.scale.y = 1.0;
      p.sprite.alpha = p.alpha;

      // Цвет
      if (p.isUpwelling) {
        p.sprite.tint = this.colorUpwelling;
      } else if (p.isDownwelling) {
        p.sprite.tint = this.colorDownwelling;
      } else {
        switch (p.zone) {
          case CurrentZoneType.DEEP:
            p.sprite.tint = this.colorDeep;
            break;
          case CurrentZoneType.COLD:
            p.sprite.tint = this.colorCold;
            break;
          case CurrentZoneType.WARM:
            p.sprite.tint = this.colorWarm;
            break;
        }
      }

      p.sprite.x = p.x;
      p.sprite.y = p.y;
    }
  }

  public destroy(): void {
    if (this.particleTexture) {
      this.particleTexture.destroy(true);
    }
    this.container.destroy({ children: true });
  }
}
