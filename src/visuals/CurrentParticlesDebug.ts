import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  zone: CurrentZoneType;
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
  
  // Выравнивание (Alignment)
  private readonly ALIGNMENT_RADIUS_SQ = 180 * 180;
  private readonly FLOCKING_STRENGTH = 0.12; // Сила подстройки направления

  // Отталкивание (Separation)
  private readonly SEPARATION_RADIUS = 45; // Минимальный комфортный радиус между частицами
  private readonly SEPARATION_RADIUS_SQ = 45 * 45;
  private readonly SEPARATION_STRENGTH = 0.45; // Сила выталкивания при сближении

  // Лимит плотности (Density Limit)
  private readonly MAX_NEIGHBORS = 8; // Максимальное число соседей для влияния

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
          lengthScale,
          sprite
        });
      }
    }
  }

  /**
   * Единоразовое позиционирование при полной загрузке маски
   */
  private relocateToZone(p: Particle): void {
    const pts = this.currentsManager.getInitialParticlesForZone(p.zone, 1);
    const pos = pts[0] || { x: p.x, y: p.y };

    p.x = pos.x;
    p.y = pos.y;

    const angle = Math.random() * Math.PI * 2;
    p.vx = Math.cos(angle);
    p.vy = Math.sin(angle);
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
   * Расчет коллективного влияния:
   * 1. Alignment (выравнивание векторов) с лимитом MAX_NEIGHBORS
   * 2. Separation (отталкивание при критическом сближении)
   */
  private applyFlocking(p: Particle): { vx: number; vy: number } {
    const cx = Math.floor(p.x / this.CELL_SIZE);
    const cy = Math.floor(p.y / this.CELL_SIZE);

    let sumVx = 0;
    let sumVy = 0;
    let separationVx = 0;
    let separationVy = 0;
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

          // Считаем только соседей ТОГО ЖЕ ТИПА зоны
          if (other !== p && other.zone === p.zone) {
            const dx = other.x - p.x;
            const dy = other.y - p.y;
            const distSq = dx * dx + dy * dy;

            // --- 1. Separation (Сила отталкивания при слишком плотном сближении) ---
            if (distSq < this.SEPARATION_RADIUS_SQ && distSq > 0.0001) {
              const dist = Math.sqrt(distSq);
              // Чем ближе сосед, тем сильнее импульс отталкивания
              const force = (this.SEPARATION_RADIUS - dist) / this.SEPARATION_RADIUS;
              separationVx -= (dx / dist) * force;
              separationVy -= (dy / dist) * force;
            }

            // --- 2. Alignment (Выравнивание направления с лимитом соседей) ---
            if (distSq < this.ALIGNMENT_RADIUS_SQ && distSq > 0.0001 && neighborCount < this.MAX_NEIGHBORS) {
              sumVx += other.vx;
              sumVy += other.vy;
              neighborCount++;
            }
          }
        }
      }
    }

    let targetVx = p.vx;
    let targetVy = p.vy;

    // Смешивание вектора выравнивания
    if (neighborCount > 0) {
      const avgVx = sumVx / neighborCount;
      const avgVy = sumVy / neighborCount;
      targetVx += (avgVx - targetVx) * this.FLOCKING_STRENGTH;
      targetVy += (avgVy - targetVy) * this.FLOCKING_STRENGTH;
    }

    // Применение силы отталкивания
    targetVx += separationVx * this.SEPARATION_STRENGTH;
    targetVy += separationVy * this.SEPARATION_STRENGTH;

    return { vx: targetVx, vy: targetVy };
  }

  public update(deltaSeconds: number): void {
    // Единоразовое распределение по маске при старте загрузки
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

      // 1. Применяем Flocking (Alignment + Separation)
      const flockedDir = this.applyFlocking(p);

      // 2. Физика движения и выталкивание из чужих зон обратно в свою
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

      // 3. Отскок от крайних границ карты (без уничтожения/спавна)
      if (p.x <= 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      if (p.x >= this.worldSize) { p.x = this.worldSize; p.vx = -Math.abs(p.vx); }
      if (p.y <= 0) { p.y = 0; p.vy = Math.abs(p.vy); }
      if (p.y >= this.worldSize) { p.y = this.worldSize; p.vy = -Math.abs(p.vy); }

      // Поворот кометы вдоль направления движения
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 0.01) {
        p.sprite.rotation = Math.atan2(p.vy, p.vx);
      }

      // Динамический размер в зависимости от скорости
      const currentSpeedFactor = Math.min(2.0, Math.max(0.5, speed / 100));
      p.sprite.scale.x = p.lengthScale * currentSpeedFactor;
      p.sprite.scale.y = 1.0;

      // Постоянная видимость частицы
      p.sprite.alpha = 0.85;

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
