import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  zone: CurrentZoneType;
  life: number;
  maxLife: number;
  lengthScale: number; // Индивидуальный множитель длины
  sprite: PIXI.Sprite;
}

export class CurrentParticlesDebug {
  public container: PIXI.Container;
  private particles: Particle[] = [];
  private currentsManager: OceanCurrentsManager;

  private particleTexture: PIXI.Texture;

  // Цветовая палитра Layer 1 (HEX для PIXI)
  private readonly colorDeep = 0x8a00ff; // 🟣 Фиолетовый (Глубоководное)
  private readonly colorCold = 0x0000ff; // 🔵 Синий (Холодное)
  private readonly colorWarm = 0xff5500; // 🟠 Оранжевый (Теплое)

  private readonly worldSize = 8000;
  private isInitializedWithMask: boolean = false;

  // --- Параметры Spatial Grid & Flocking ---
  private readonly CELL_SIZE = 200;
  private readonly NEIGHBOR_RADIUS = 180;
  private readonly NEIGHBOR_RADIUS_SQ = 180 * 180;
  private readonly FLOCKING_STRENGTH = 0.15; // Коэффициент подстройки к направлению соседей (15%)
  private gridCols: number;
  private gridRows: number;
  private spatialGrid: Particle[][];

  constructor(currentsManager: OceanCurrentsManager, count: number = 2400) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();

    // Инициализация пространственной сетки для оптимизации O(N)
    this.gridCols = Math.ceil(this.worldSize / this.CELL_SIZE);
    this.gridRows = Math.ceil(this.worldSize / this.CELL_SIZE);
    this.spatialGrid = new Array(this.gridCols * this.gridRows);
    for (let i = 0; i < this.spatialGrid.length; i++) {
      this.spatialGrid[i] = [];
    }

    // Генерируем текстуру кометы (64px x 8px) с градиентным хвостом
    this.particleTexture = this.generateCometTexture(64, 8);
    this.initParticles(count);
  }

  /**
   * Генерация текстуры кометы: плавный прозрачный хвост слева, яркая голова справа
   */
  private generateCometTexture(width: number, height: number): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Градиент прозрачности вдоль оси X
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');     // Хвост (полная прозрачность)
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)'); // Тело
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1.0)');   // Голова (яркая)

      ctx.fillStyle = gradient;
      ctx.beginPath();

      const centerY = height / 2;
      ctx.moveTo(0, centerY);                                        // Острый хвост
      ctx.lineTo(width - height, 0);                                 // Верхнее ребро
      ctx.arcTo(width, centerY, width - height, height, height / 2); // Скругленная голова
      ctx.lineTo(width - height, height);                            // Нижнее ребро
      ctx.closePath();
      ctx.fill();
    }

    return PIXI.Texture.from(canvas);
  }

  private initParticles(totalCount: number): void {
    const zones = [CurrentZoneType.DEEP, CurrentZoneType.COLD, CurrentZoneType.WARM];
    const countPerZone = Math.floor(totalCount / zones.length);

    for (const zone of zones) {
      const spawnPoints = this.currentsManager.getInitialParticlesForZone(zone, countPerZone);

      for (let i = 0; i < countPerZone; i++) {
        const pt = spawnPoints[i] || { x: this.worldSize * 0.5, y: this.worldSize * 0.5 };
        const sprite = new PIXI.Sprite(this.particleTexture);

        // Устанавливаем анкор в голову кометы (правый край: x=1.0, y=0.5)
        sprite.anchor.set(1.0, 0.5);

        const maxLife = 4 + Math.random() * 4;
        const life = Math.random() * maxLife;
        const lengthScale = 0.8 + Math.random() * 1.7;

        // Случайный вектор направления при создании (360 градусов)
        const angle = Math.random() * Math.PI * 2;

        this.container.addChild(sprite);
        this.particles.push({
          x: pt.x,
          y: pt.y,
          vx: Math.cos(angle),
          vy: Math.sin(angle),
          zone,
          life,
          maxLife,
          lengthScale,
          sprite
        });
      }
    }
  }

  private respawnParticle(p: Particle): void {
    const pts = this.currentsManager.getInitialParticlesForZone(p.zone, 1);
    const pos = pts[0] || { x: p.x, y: p.y };

    p.x = pos.x;
    p.y = pos.y;

    // Случайный вектор направления при перерождении (360 градусов)
    const angle = Math.random() * Math.PI * 2;
    p.vx = Math.cos(angle);
    p.vy = Math.sin(angle);

    p.life = 0;
    p.maxLife = 4 + Math.random() * 4;
    p.lengthScale = 0.8 + Math.random() * 1.7;
    p.sprite.position.set(p.x, p.y);
  }

  // --- Методы Spatial Grid ---
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

  /**
   * Расчет коллективного влияния (Flocking Alignment) от соседей той же зоны
   */
  private applyFlocking(p: Particle): { vx: number; vy: number } {
    const cx = Math.floor(p.x / this.CELL_SIZE);
    const cy = Math.floor(p.y / this.CELL_SIZE);

    let sumVx = 0;
    let sumVy = 0;
    let neighborCount = 0;

    // Проверяем текущую ячейку и 8 соседних ячеек
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

          // Считаем только соседей ТОГО ЖЕ ТИПА зоны
          if (other !== p && other.zone === p.zone) {
            const dx = other.x - p.x;
            const dy = other.y - p.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < this.NEIGHBOR_RADIUS_SQ && distSq > 0.0001) {
              sumVx += other.vx;
              sumVy += other.vy;
              neighborCount++;
            }
          }
        }
      }
    }

    if (neighborCount > 0) {
      const avgVx = sumVx / neighborCount;
      const avgVy = sumVy / neighborCount;

      // Плавное смешивание направления (Alignment)
      const blendedVx = p.vx + (avgVx - p.vx) * this.FLOCKING_STRENGTH;
      const blendedVy = p.vy + (avgVy - p.vy) * this.FLOCKING_STRENGTH;

      return { vx: blendedVx, vy: blendedVy };
    }

    return { vx: p.vx, vy: p.vy };
  }

  public update(deltaSeconds: number): void {
    // Единоразовое распределение частиц по маске, как только изображение загрузится
    if (this.currentsManager.isLoaded && !this.isInitializedWithMask) {
      for (const p of this.particles) {
        this.respawnParticle(p);
      }
      this.isInitializedWithMask = true;
    }

    // Обновляем сетку пространственной оптимизации перед расчетом стаи
    this.clearGrid();
    this.populateGrid();

    const total = this.particles.length;

    for (let i = 0; i < total; i++) {
      const p = this.particles[i];
      p.life += deltaSeconds;

      // Респавн по истечении времени жизни (внутри своей же зоны)
      if (p.life >= p.maxLife) {
        this.respawnParticle(p);
        continue;
      }

      // 1. Применяем коллективное выравнивание направления с соседями по зоне (Flocking)
      const flockedDir = this.applyFlocking(p);

      // 2. Получаем физику движения с авто-удержанием в родной зоне
      const current = this.currentsManager.getCurrentVectorForParticle(
        p.x,
        p.y,
        flockedDir.vx,
        flockedDir.vy,
        p.zone
      );

      p.vx = current.vx;
      p.vy = current.vy;

      p.x += p.vx * deltaSeconds;
      p.y += p.vy * deltaSeconds;

      // Проверка на вылет за границы мира
      if (p.x > this.worldSize || p.x < 0 || p.y > this.worldSize || p.y < 0) {
        this.respawnParticle(p);
        continue;
      }

      // Поворот кометы вдоль направления движения
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 0.01) {
        p.sprite.rotation = Math.atan2(p.vy, p.vx);
      }

      // Динамический размер: длина зависит от скорости течения
      const currentSpeedFactor = Math.min(2.0, Math.max(0.5, speed / 100));
      p.sprite.scale.x = p.lengthScale * currentSpeedFactor;
      p.sprite.scale.y = 1.0;

      // Прозрачность с мягким проявлением и затуханием (Fade In / Fade Out)
      const progress = p.life / p.maxLife;
      let alpha = 0.85;
      if (progress < 0.2) alpha = (progress / 0.2) * 0.85;
      if (progress > 0.8) alpha = ((1 - progress) / 0.2) * 0.85;
      p.sprite.alpha = alpha;

      // Окрашивание в цвет своей зоны
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
