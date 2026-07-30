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
  lengthScale: number; // Индивидуальный множитель длины
  sprite: PIXI.Sprite;

  // Параметры для плавного угасания и спавна
  alpha: number;
  isDying: boolean;
  immunityTimer: number; // Защита от мгновенного повторного угасания после спавна

  // 🟢 Состояние Апвеллинга и нелинейной траектории
  isUpwelling?: boolean;
  upwellingOrigin?: CurrentZoneType;         // Исходная зона (COLD или DEEP)
  upwellingTarget?: { x: number; y: number }; // Целевой вектор/точка дуги

  // 🟡 Состояние Даунвеллинга
  isDownwelling?: boolean;
  downwellingOrigin?: CurrentZoneType;       // Исходная зона (WARM или COLD)
  downwellingTarget?: { x: number; y: number };
  downwellingPenetrationTimer?: number;       // Таймер задержки смены типа при погружении в DEEP
}

interface Vortex {
  x: number;
  y: number;
  radius: number;
  strength: number; // Положительное -- по часовой, отрицательное -- против часовой
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

  // --- Множители скорости для разных зон ---
  private readonly zoneSpeedMultipliers: Record<CurrentZoneType, number> = {
    [CurrentZoneType.WARM]: 1.0,  // 🟠 Прибрежные быстрые потоки
    [CurrentZoneType.COLD]: 0.5,  // 🔵 Основная акватория
    [CurrentZoneType.DEEP]: 0.17  // 🟣 Медленный донный дрейф
  };

  private readonly worldSize = 8000;
  private isInitializedWithMask: boolean = false;

  // --- Параметры Spatial Grid & Flocking ---
  private readonly CELL_SIZE = 200;
  private readonly ALIGNMENT_RADIUS_SQ = 180 * 180;
  private readonly SEPARATION_RADIUS_SQ = 60 * 60;

  private readonly FLOCKING_STRENGTH = 0.10;
  private readonly SEPARATION_STRENGTH = 0.25;

  // --- Параметры контроля плотности и угасания ---
  private readonly DENSITY_THRESHOLD = 14;
  private readonly FADE_SPEED = 1.5;
  private readonly IMMUNITY_DURATION = 3.0;

  private gridCols: number;
  private gridRows: number;
  private spatialGrid: Particle[][];

  // --- Сетка искусственных водоворотов ---
  private vortices: Vortex[] = [];

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
    this.initParticles(totalCount);
  }

  private generateVortices(count: number): void {
    this.vortices = [];
    for (let i = 0; i < count; i++) {
      this.vortices.push({
        x: Math.random() * this.worldSize,
        y: Math.random() * this.worldSize,
        radius: 300 + Math.random() * 500,
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

  private initParticles(totalCount: number): void {
    const scaleFactor = totalCount / 10000;
    const zones = [CurrentZoneType.DEEP, CurrentZoneType.COLD, CurrentZoneType.WARM];

    for (const zone of zones) {
      const countForZone = Math.round(ZONE_PARTICLE_COUNTS[zone] * scaleFactor);
      const spawnPoints = this.currentsManager.getInitialParticlesForZone(zone, countForZone);

      for (let i = 0; i < countForZone; i++) {
        const pt = spawnPoints[i] || { x: this.worldSize * 0.5, y: this.worldSize * 0.5 };
        const sprite = new PIXI.Sprite(this.particleTexture);

        sprite.anchor.set(1.0, 0.5);

        const lengthScale = 0.8 + Math.random() * 1.7;
        const angle = Math.random() * Math.PI * 2;

        this.container.addChild(sprite);
        this.particles.push({
          x: pt.x,
          y: pt.y,
          vx: Math.cos(angle),
          vy: Math.sin(angle),
          zone,
          lengthScale,
          sprite,
          alpha: Math.random() * 0.85,
          isDying: false,
          immunityTimer: Math.random() * this.IMMUNITY_DURATION,
          isUpwelling: false,
          isDownwelling: false
        });
      }
    }
  }

  private relocateToZone(p: Particle): void {
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
    p.isUpwelling = false;
    p.upwellingOrigin = undefined;
    p.upwellingTarget = undefined;

    p.isDownwelling = false;
    p.downwellingOrigin = undefined;
    p.downwellingTarget = undefined;
    p.downwellingPenetrationTimer = undefined;
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
      const cx = Math.floor(p.x / this.CELL_SIZE);
      const cy = Math.floor(p.y / this.CELL_SIZE);

      if (cx >= 0 && cx < this.gridCols && cy >= 0 && cy < this.gridRows) {
        const cellIndex = cy * this.gridCols + cx;
        this.spatialGrid[cellIndex].push(p);
      }
    }
  }

  private applyFlockingAndSeparation(p: Particle): { vx: number; vy: number } {
    const cx = Math.floor(p.x / this.CELL_SIZE);
    const cy = Math.floor(p.y / this.CELL_SIZE);

    let sumVx = 0;
    let sumVy = 0;
    let separateX = 0;
    let separateY = 0;
    let neighborCount = 0;

    const minX = Math.max(0, cx - 1);
    const maxX = Math.min(this.gridCols - 1, cx + 1);
    const minY = Math.max(0, cy - 1);
    const maxY = Math.min(this.gridRows - 1, cy + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cellIndex = y * this.gridCols + x;
        const cell = this.spatialGrid[cellIndex];

        for (let i = 0; i < cell.length; i++) {
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
                separateX += (dx / dist) * (this.SEPARATION_RADIUS_SQ - distSq);
                separateY += (dy / dist) * (this.SEPARATION_RADIUS_SQ - distSq);
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

    resultVx += separateX * this.SEPARATION_STRENGTH * 0.001;
    resultVy += separateY * this.SEPARATION_STRENGTH * 0.001;

    return { vx: resultVx, vy: resultVy };
  }

  private applyVortices(x: number, y: number, vx: number, vy: number): { vx: number; vy: number } {
    let vortexVx = 0;
    let vortexVy = 0;

    for (let i = 0; i < this.vortices.length; i++) {
      const v = this.vortices[i];
      const dx = x - v.x;
      const dy = y - v.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < v.radius * v.radius && distSq > 1.0) {
        const dist = Math.sqrt(distSq);
        const factor = 1.0 - dist / v.radius;

        const tangentX = -dy / dist;
        const tangentY = dx / dist;

        vortexVx += tangentX * v.strength * factor;
        vortexVy += tangentY * v.strength * factor;
      }
    }

    return {
      vx: vx + vortexVx,
      vy: vy + vortexVy
    };
  }

  public update(deltaSeconds: number): void {
    if (this.currentsManager.isLoaded && !this.isInitializedWithMask) {
      for (const p of this.particles) {
        this.relocateToZone(p);
      }
      this.isInitializedWithMask = true;
    }

    this.clearGrid();
    this.populateGrid();

    const total = this.particles.length;

    for (let i = 0; i < total; i++) {
      const p = this.particles[i];

      if (p.immunityTimer > 0) {
        p.immunityTimer -= deltaSeconds;
      }

      // 🟢 0. Проверка входа в апвеллинг
      const upwellingZone = this.currentsManager.getUpwellingZoneAt(p.x, p.y);
      
      if (upwellingZone === 'ENTRY' && !p.isUpwelling && !p.isDownwelling) {
        if (p.zone === CurrentZoneType.DEEP || p.zone === CurrentZoneType.COLD) {
          // 📉 Снижено с 0.10 до 0.02 (2% шанс в секунду)
          if (Math.random() < 0.02 * deltaSeconds) {
            p.isUpwelling = true;
            p.upwellingOrigin = p.zone;

            if (p.zone === CurrentZoneType.COLD) {
              const distToTopRight = Math.hypot(this.worldSize - p.x, 0 - p.y);
              const distToBottomLeft = Math.hypot(0 - p.x, this.worldSize - p.y);
              
              p.upwellingTarget = distToTopRight < distToBottomLeft 
                ? { x: this.worldSize, y: this.worldSize * 0.1 } 
                : { x: this.worldSize * 0.32, y: this.worldSize };
            } else {
              p.upwellingTarget = { x: this.worldSize * 0.5, y: this.worldSize * 0.5 };
            }
          }
        }
      } 

      // 🟡 0b. Проверка входа в даунвеллинг
      const downwellingZone = this.currentsManager.getDownwellingZoneAt(p.x, p.y);

      if (downwellingZone === 'ENTRY' && !p.isDownwelling && !p.isUpwelling) {
        if (p.zone === CurrentZoneType.WARM || p.zone === CurrentZoneType.COLD) {
          // 📉 Снижено с 0.10 до 0.02 (2% шанс в секунду)
          if (Math.random() < 0.02 * deltaSeconds) {
            p.isDownwelling = true;
            p.downwellingOrigin = p.zone;

            // Направление траектории погружения (влево-вверх)
            if (p.zone === CurrentZoneType.WARM) {
              p.downwellingTarget = { x: 0, y: this.worldSize * 0.4 };
            } else {
              p.downwellingTarget = { x: 0, y: 0 };
            }
          }
        }
      }
      
      // 🟢 ДВОЙНАЯ ПРОВЕРКА ВЫХОДА АПВЕЛЛИНГА: EXIT + Родная зона
      if (p.isUpwelling) {
        const mainZone = this.currentsManager.getZoneAt(p.x, p.y);

        if (p.upwellingOrigin === CurrentZoneType.COLD) {
          if (upwellingZone === 'EXIT' && mainZone === CurrentZoneType.COLD) {
            p.isUpwelling = false;
            p.zone = CurrentZoneType.COLD;
          }
        } else if (p.upwellingOrigin === CurrentZoneType.DEEP) {
          if (upwellingZone === 'EXIT' && mainZone === CurrentZoneType.WARM) {
            p.isUpwelling = false;
            p.zone = CurrentZoneType.WARM;
          }
        }
      }

      // 🟡 ДВОЙНАЯ ПРОВЕРКА ВЫХОДА ДАУНВЕЛЛИНГА: EXIT + Проникновение вглубь DEEP
      if (p.isDownwelling) {
        const mainZone = this.currentsManager.getZoneAt(p.x, p.y);

        if (p.downwellingOrigin === CurrentZoneType.WARM) {
          // 🟠 WARM погружается в 🟣 DEEP с эффектом проникновения
          if (mainZone === CurrentZoneType.DEEP) {
            if (p.downwellingPenetrationTimer === undefined) {
              // Инициализация случайной задержки (1.5 - 3.5 сек)
              p.downwellingPenetrationTimer = 1.5 + Math.random() * 2.0;
            } else {
              p.downwellingPenetrationTimer -= deltaSeconds;
              if (p.downwellingPenetrationTimer <= 0) {
                p.isDownwelling = false;
                p.zone = CurrentZoneType.DEEP;
                p.downwellingPenetrationTimer = undefined;
              }
            }
          }
        } else if (p.downwellingOrigin === CurrentZoneType.COLD) {
          // 🔵 COLD циркулирует и остается 🔵 COLD
          if (downwellingZone === 'EXIT' && mainZone === CurrentZoneType.COLD) {
            p.isDownwelling = false;
            p.zone = CurrentZoneType.COLD;
          }
        }
      }

      // 1. Выравнивание + Расталкивание
      const flockingDir = this.applyFlockingAndSeparation(p);

      // 2. Водовороты
      const swirlingDir = this.applyVortices(p.x, p.y, flockingDir.vx, flockingDir.vy);

      // 3. Прозрачность и респавн
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

      // 4. Движение с учетом дугового подкручивания (Steering Vector)
      if (p.isUpwelling) {
        const upVector = this.currentsManager.getUpwellingVector();
        let targetVx = upVector.vx;
        let targetVy = upVector.vy;

        if (p.upwellingTarget) {
          const dx = p.upwellingTarget.x - p.x;
          const dy = p.upwellingTarget.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 1.0) {
            const dirX = (dx / dist) * 120;
            const dirY = (dy / dist) * 120;

            const curveFactor = 0.45;
            targetVx = targetVx * (1 - curveFactor) + dirX * curveFactor;
            targetVy = targetVy * (1 - curveFactor) + dirY * curveFactor;
          }
        }

        p.vx = targetVx;
        p.vy = targetVy;
      } else if (p.isDownwelling) {
        const downVector = this.currentsManager.getDownwellingVector();
        let targetVx = downVector.vx;
        let targetVy = downVector.vy;

        if (p.downwellingTarget) {
          const dx = p.downwellingTarget.x - p.x;
          const dy = p.downwellingTarget.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 1.0) {
            const dirX = (dx / dist) * 120;
            const dirY = (dy / dist) * 120;

            const curveFactor = 0.45;
            targetVx = targetVx * (1 - curveFactor) + dirX * curveFactor;
            targetVy = targetVy * (1 - curveFactor) + dirY * curveFactor;
          }
        }

        p.vx = targetVx;
        p.vy = targetVy;
      } else {
        const current = this.currentsManager.getCurrentVectorForParticle(
          p.x,
          p.y,
          swirlingDir.vx,
          swirlingDir.vy,
          p.zone
        );

        const speedMultiplier = this.zoneSpeedMultipliers[p.zone] ?? 1.0;
        p.vx = current.vx * speedMultiplier;
        p.vy = current.vy * speedMultiplier;
      }

      p.x += p.vx * deltaSeconds;
      p.y += p.vy * deltaSeconds;

      // 5. Границы карты
      if (p.x <= 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      if (p.x >= this.worldSize) { p.x = this.worldSize; p.vx = -Math.abs(p.vx); }
      if (p.y <= 0) { p.y = 0; p.vy = Math.abs(p.vy); }
      if (p.y >= this.worldSize) { p.y = this.worldSize; p.vy = -Math.abs(p.vy); }

      // Поворот кометы
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 0.01) {
        p.sprite.rotation = Math.atan2(p.vy, p.vx);
      }

      // Масштабирование
      const currentSpeedFactor = Math.min(2.0, Math.max(0.5, speed / 100));
      p.sprite.scale.x = p.lengthScale * currentSpeedFactor;
      p.sprite.scale.y = 1.0;

      p.sprite.alpha = p.alpha;

      // Цвет частицы
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
