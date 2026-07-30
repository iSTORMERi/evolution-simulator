// src/simulation/OceanCurrentsManager.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

export enum CurrentZoneType {
  DEEP = 'DEEP',   // 🟣 Фиолетовая
  COLD = 'COLD',   // 🔵 Синяя
  WARM = 'WARM'    // 🟠 Оранжевая
}

export type UpwellingZoneType = 'ENTRY' | 'EXIT';
export type DownwellingZoneType = 'ENTRY' | 'EXIT';

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType | null;
  targetColor: string;
  isWater: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export const ZONE_COLOR_MAP: Record<CurrentZoneType, string> = {
  [CurrentZoneType.DEEP]: '#8A00FF',
  [CurrentZoneType.COLD]: '#0000FF',
  [CurrentZoneType.WARM]: '#FF5500'
};

// 🟢 Цвет частиц Апвеллинга (Зелёный)
export const UPWELLING_COLOR = '#00FF00';

// 🟡 Цвет частиц Даунвеллинга (Жёлтый)
export const DOWNWELLING_COLOR = '#FFFF00';

export const ZONE_SPEED_MULTIPLIERS: Record<CurrentZoneType, number> = {
  [CurrentZoneType.DEEP]: 0.85,
  [CurrentZoneType.COLD]: 1.0,
  [CurrentZoneType.WARM]: 1.15
};

// 🟢 Множитель скорости Апвеллинга (плотная глубинная вода)
export const UPWELLING_SPEED_MULTIPLIER = 0.75;

// 🟡 Множитель скорости Даунвеллинга (равен апвеллингу)
export const DOWNWELLING_SPEED_MULTIPLIER = 0.75;

// 🔥 РАСПРЕДЕЛЕНИЕ 10 000 ЧАСТИЦ ПО ЗОНАМ
export const ZONE_PARTICLE_COUNTS: Record<CurrentZoneType, number> = {
  [CurrentZoneType.DEEP]: 1000, // 🟣 Оставляем как есть (эталонная плотность)
  [CurrentZoneType.COLD]: 6750, // 🔵 МАКСИМУМ: Заполняем огромную центральную зону (+1500)
  [CurrentZoneType.WARM]: 2250  // 🟠 Усиленный прибрежный поток (+500)
};

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 70;

  private readonly MASK_SIZE = 1000;
  private maskData: Uint8ClampedArray | null = null;
  private upwellingMaskData: Uint8ClampedArray | null = null;
  private downwellingMaskData: Uint8ClampedArray | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private darkeningSprite: PIXI.Sprite | null = null;

  private overlayOpacity: number = 0.6;
  private overlayBlur: number = 12;

  private zoneSpawnPoints: Record<CurrentZoneType, Point2D[]> = {
    [CurrentZoneType.DEEP]: [],
    [CurrentZoneType.COLD]: [],
    [CurrentZoneType.WARM]: []
  };

  public isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  // --- 1. ЗАГРУЗКА МАСОК И ИНИЦИАЛИЗАЦИЯ ---
  public async initScanner(): Promise<void> {
    const baseUrl = (import.meta as any).env?.BASE_URL || './';
    const cleanBase = baseUrl.replace(/\/$/, '');
    
    // 1. Пробуем сначала поверхностную маску, затем бинарную фолбэк-маску
    const candidatePaths = [
      `${cleanBase}/assets/ocean_surface_mask.png`,
      `${cleanBase}/assets/ocean_binary_mask.png`
    ];

    let loadedImg: HTMLImageElement | null = null;

    for (const path of candidatePaths) {
      try {
        loadedImg = await this.loadImage(path);
        console.log(`[OceanCurrentsManager] Успешно загружена маска поверхностей: ${path}`);
        break;
      } catch {
        // Пробуем следующий путь
      }
    }

    // 2. Загружаем маску апвеллинга
    const upwellingPath = `${cleanBase}/assets/ocean_upwelling_mask.png`;
    try {
      const loadedUpwellingImg = await this.loadImage(upwellingPath);
      console.log(`[OceanCurrentsManager] Успешно загружена маска апвеллинга: ${upwellingPath}`);
      this.upwellingMaskData = this.extractImageData(loadedUpwellingImg);
    } catch {
      console.warn('[OceanCurrentsManager] Маска апвеллинга не найдена. Апвеллинг будет отключен.');
    }

    // 3. Загружаем маску даунвеллинга
    const downwellingPath = `${cleanBase}/assets/ocean_downwelling_mask.png`;
    try {
      const loadedDownwellingImg = await this.loadImage(downwellingPath);
      console.log(`[OceanCurrentsManager] Успешно загружена маска даунвеллинга: ${downwellingPath}`);
      this.downwellingMaskData = this.extractImageData(loadedDownwellingImg);
    } catch {
      console.warn('[OceanCurrentsManager] Маска даунвеллинга не найдена. Даунвеллинг будет отключен.');
    }

    if (!loadedImg) {
      console.warn('[OceanCurrentsManager] Ни одна маска PNG не загружена. Включаем фолбэк.');
      this.generateFallbackSpawnPoints();
      this.isLoaded = true;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.MASK_SIZE;
    canvas.height = this.MASK_SIZE;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(loadedImg, 0, 0, this.MASK_SIZE, this.MASK_SIZE);
    const imgData = ctx.getImageData(0, 0, this.MASK_SIZE, this.MASK_SIZE);

    this.maskData = imgData.data;

    // Генерируем маску воды (Универсальный метод)
    this.generateWaterAlphaCanvas();
    this.buildSpawnTables();
    this.isLoaded = true;

    // Обновляем текстуру затемнения, если спрайт уже был создан
    if (this.darkeningSprite) {
      this.refreshDarkeningTexture();
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });
  }

  private extractImageData(img: HTMLImageElement): Uint8ClampedArray | null {
    const canvas = document.createElement('canvas');
    canvas.width = this.MASK_SIZE;
    canvas.height = this.MASK_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, this.MASK_SIZE, this.MASK_SIZE);
    return ctx.getImageData(0, 0, this.MASK_SIZE, this.MASK_SIZE).data;
  }

  /**
   * 🟢 ПРОВЕРКА ЗОНЫ АПВЕЛЛИНГА В КООРДИНАТЕ (ENTRY / EXIT)
   */
  public getUpwellingZoneAt(x: number, y: number): UpwellingZoneType | null {
    if (!this.upwellingMaskData) return null;
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return null;

    const gx = Math.floor((x / this.worldWidth) * this.MASK_SIZE);
    const gy = Math.floor((y / this.worldHeight) * this.MASK_SIZE);
    const index = (gy * this.MASK_SIZE + gx) * 4;

    const r = this.upwellingMaskData[index];
    const g = this.upwellingMaskData[index + 1];
    const b = this.upwellingMaskData[index + 2];
    const a = this.upwellingMaskData[index + 3];

    // Пропускаем прозрачные пиксели и сушу (черный цвет)
    if (a <= 50 || (r < 20 && g < 20 && b < 20)) return null;

    // 🟢 Доминанта зелёного канала (зелёного явно больше, чем R и B)
    const isGreenDominant = g > r + 15 && g > b + 15;

    if (isGreenDominant) {
      // Ярко-зелёный / Неоновый = Зона выхода (EXIT)
      if (g > 160) {
        return 'EXIT';
      }
      // Любой тёмный/средний зелёный = Зона входа/трансформации (ENTRY)
      return 'ENTRY';
    }

    return null;
  }

  /**
   * 🟡 ПРОВЕРКА ЗОНЫ ДАУНВЕЛЛИНГА В КООРДИНАТЕ (ENTRY / EXIT)
   */
  public getDownwellingZoneAt(x: number, y: number): DownwellingZoneType | null {
    if (!this.downwellingMaskData) return null;
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return null;

    const gx = Math.floor((x / this.worldWidth) * this.MASK_SIZE);
    const gy = Math.floor((y / this.worldHeight) * this.MASK_SIZE);
    const index = (gy * this.MASK_SIZE + gx) * 4;

    const r = this.downwellingMaskData[index];
    const g = this.downwellingMaskData[index + 1];
    const b = this.downwellingMaskData[index + 2];
    const a = this.downwellingMaskData[index + 3];

    // Пропускаем прозрачные пиксели и сушу/белую инертную зону
    if (a <= 50 || (r < 20 && g < 20 && b < 20)) return null;

    // 🟡 Светло-жёлтая зона (EXIT)
    if (r > 200 && g > 140 && b < 80) {
      return 'EXIT';
    }

    // 🟤 Тёмно-жёлтая / коричневая зона (ENTRY)
    if (r > 80 && r < 190 && g > 40 && g < 140 && b < 70) {
      return 'ENTRY';
    }

    return null;
  }

  /**
   * 🟢 ВЕКТОР ДВИЖЕНИЯ ЧАСТИЦЫ АПВЕЛЛИНГА
   * Диагональный экспресс-лифт под углом 45 градусов (вправо-вниз) со скоростью 0.75x
   */
  public getUpwellingVector(): { vx: number; vy: number } {
    const speed = this.baseSpeed * UPWELLING_SPEED_MULTIPLIER;
    const invSqrt2 = 0.70710678; // cos(45deg) = sin(45deg)
    return {
      vx: invSqrt2 * speed,
      vy: invSqrt2 * speed
    };
  }

  /**
   * 🟡 ВЕКТОР ДВИЖЕНИЯ ЧАСТИЦЫ ДАУНВЕЛЛИНГА
   * Диагональный экспресс-лифт под углом 225 градусов (влево-вверх) со скоростью 0.75x
   */
  public getDownwellingVector(): { vx: number; vy: number } {
    const speed = this.baseSpeed * DOWNWELLING_SPEED_MULTIPLIER;
    const invSqrt2 = 0.70710678;
    return {
      vx: -invSqrt2 * speed,
      vy: -invSqrt2 * speed
    };
  }

  /**
   * ГЕНЕРАЦИЯ МАСКИ ВОДЫ (Универсальная проверка: любой не-черный пиксель = вода)
   */
  private generateWaterAlphaCanvas(): void {
    if (!this.maskData) return;

    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = this.MASK_SIZE;
    alphaCanvas.height = this.MASK_SIZE;
    const ctx = alphaCanvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(this.MASK_SIZE, this.MASK_SIZE);

    for (let i = 0; i < this.maskData.length; i += 4) {
      const r = this.maskData[i];
      const g = this.maskData[i + 1];
      const b = this.maskData[i + 2];
      const a = this.maskData[i + 3];

      // Гарантированно находит воду и на цветной, и на бинарной маске
      const isWater = a > 50 && (r > 30 || g > 30 || b > 30);

      if (isWater) {
        imgData.data[i]     = 255;
        imgData.data[i + 1] = 255;
        imgData.data[i + 2] = 255;
        imgData.data[i + 3] = 255; // Заливаем белый силуэт акватории
      } else {
        imgData.data[i + 3] = 0;   // Прозрачно для суши
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.maskCanvas = alphaCanvas;
  }

  /**
   * СОЗДАНИЕ СПРАЙТА ЗАТЕМНЕНИЯ
   */
  public createDarkeningOverlay(opacity: number = 0.6, blurRadius: number = 12): PIXI.Sprite {
    this.overlayOpacity = opacity;
    this.overlayBlur = blurRadius;

    if (this.darkeningSprite) {
      this.refreshDarkeningTexture();
      return this.darkeningSprite;
    }

    this.darkeningSprite = new PIXI.Sprite();
    this.refreshDarkeningTexture();

    this.darkeningSprite.tint = 0x050C1C;
    this.darkeningSprite.alpha = this.overlayOpacity;
    this.darkeningSprite.visible = true;

    return this.darkeningSprite;
  }

  /**
   * ОБНОВЛЕНИЕ ТЕКСТУРЫ И МАСШТАБА
   */
  private refreshDarkeningTexture(): void {
    if (!this.darkeningSprite) return;

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = this.MASK_SIZE;
    renderCanvas.height = this.MASK_SIZE;
    const ctx = renderCanvas.getContext('2d');

    if (ctx) {
      if (this.maskCanvas) {
        if (this.overlayBlur > 0) {
          ctx.filter = `blur(${this.overlayBlur}px)`;
        }
        ctx.drawImage(this.maskCanvas, 0, 0, this.MASK_SIZE, this.MASK_SIZE);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, this.MASK_SIZE, this.MASK_SIZE);
      }
    }

    const newTexture = PIXI.Texture.from(renderCanvas);
    newTexture.update();

    const oldTexture = this.darkeningSprite.texture;
    this.darkeningSprite.texture = newTexture;

    if (oldTexture && oldTexture !== PIXI.Texture.EMPTY) {
      oldTexture.destroy(true);
    }

    const scaleX = this.worldWidth / this.MASK_SIZE;
    const scaleY = this.worldHeight / this.MASK_SIZE;
    this.darkeningSprite.scale.set(scaleX, scaleY);
    this.darkeningSprite.tint = 0x050C1C;
    this.darkeningSprite.alpha = this.overlayOpacity;
  }

  public setDarkeningVisible(visible: boolean, immediate: boolean = false): void {
    if (!this.darkeningSprite) return;

    if (visible) {
      this.darkeningSprite.visible = true;
      if (immediate) this.darkeningSprite.alpha = this.overlayOpacity;
    } else {
      if (immediate) {
        this.darkeningSprite.alpha = 0;
        this.darkeningSprite.visible = false;
      }
    }
  }

  public updateDarkening(deltaSeconds: number, showCurrents: boolean, fadeSpeed: number = 4.0): void {
    if (!this.darkeningSprite) return;

    const targetAlpha = showCurrents ? this.overlayOpacity : 0.0;

    if (showCurrents) {
      this.darkeningSprite.visible = true;
    }

    if (Math.abs(this.darkeningSprite.alpha - targetAlpha) > 0.01) {
      const step = (targetAlpha - this.darkeningSprite.alpha) * Math.min(1, deltaSeconds * fadeSpeed);
      this.darkeningSprite.alpha += step;
    } else {
      this.darkeningSprite.alpha = targetAlpha;
      if (targetAlpha === 0) {
        this.darkeningSprite.visible = false;
      }
    }
  }

  private generateFallbackSpawnPoints(): void {
    const zones = [CurrentZoneType.DEEP, CurrentZoneType.COLD, CurrentZoneType.WARM];
    for (const zone of zones) {
      const count = ZONE_PARTICLE_COUNTS[zone];
      for (let i = 0; i < count; i++) {
        this.zoneSpawnPoints[zone].push({
          x: Math.random() * this.worldWidth,
          y: Math.random() * this.worldHeight
        });
      }
    }
  }

  /**
   * ПОСТРОЕНИЕ ТАБЛИЦ СПАВНА С ЭРОЗИЕЙ ГРАНИЦ И СТРОГОЙ ПРОВЕРКОЙ
   */
  private buildSpawnTables(): void {
    if (!this.maskData) return;

    const cellW = this.worldWidth / this.MASK_SIZE;
    const cellH = this.worldHeight / this.MASK_SIZE;

    for (let gy = 4; gy < this.MASK_SIZE - 4; gy += 4) {
      for (let gx = 4; gx < this.MASK_SIZE - 4; gx += 4) {
        const worldX = (gx + 0.5) * cellW;
        const worldY = (gy + 0.5) * cellH;

        if (!this.isWater(worldX, worldY)) continue;

        const currentZone = this.getZoneAtStrict(gx, gy);
        if (!currentZone) continue;

        let isPureZone = true;
        for (let dy = -2; dy <= 2; dy += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            if (dx === 0 && dy === 0) continue;
            if (this.getZoneAtStrict(gx + dx, gy + dy) !== currentZone) {
              isPureZone = false;
              break;
            }
          }
          if (!isPureZone) break;
        }

        if (isPureZone) {
          this.zoneSpawnPoints[currentZone].push({ x: worldX, y: worldY });
        }
      }
    }
  }

  /**
   * Вспомогательный метод для точного чтения зоны по пиксельным координатам маски без широтных фолбэков
   */
  private getZoneAtStrict(gx: number, gy: number): CurrentZoneType | null {
    if (gx < 0 || gx >= this.MASK_SIZE || gy < 0 || gy >= this.MASK_SIZE) return null;
    const index = (gy * this.MASK_SIZE + gx) * 4;
    const r = this.maskData![index];
    const g = this.maskData![index + 1];
    const b = this.maskData![index + 2];
    const a = this.maskData![index + 3];

    if (a <= 50 || (r <= 30 && g <= 30 && b <= 30)) return null; // Суша / прозрачность

    if (r > 100 && b > 150 && g < 100) return CurrentZoneType.DEEP; // Фиолетовый
    if (b > 150 && r < 100 && g < 100) return CurrentZoneType.COLD;  // Синий
    if (r > 180 && g > 40 && b < 100) return CurrentZoneType.WARM;   // Оранжевый

    return null;
  }

  /**
   * ПРОВЕРКА: Является ли точка водой
   */
  public isWater(x: number, y: number): boolean {
    if (!this.maskData) {
      return true; // Пока маска не загружена -- считаем весь мир доступным
    }
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return false;

    const gx = Math.floor((x / this.worldWidth) * this.MASK_SIZE);
    const gy = Math.floor((y / this.worldHeight) * this.MASK_SIZE);
    const index = (gy * this.MASK_SIZE + gx) * 4;

    const r = this.maskData[index];
    const g = this.maskData[index + 1];
    const b = this.maskData[index + 2];
    const a = this.maskData[index + 3];

    // Любой видимый и не-чёрный пиксель = вода
    return a > 50 && (r > 30 || g > 30 || b > 30);
  }

  /**
   * ПОЛУЧЕНИЕ ТИПА ЗОНЫ В КООРДИНАТЕ
   */
  public getZoneAt(x: number, y: number): CurrentZoneType | null {
    if (!this.maskData) {
      if (y < this.worldHeight * 0.33) return CurrentZoneType.COLD;
      if (y < this.worldHeight * 0.66) return CurrentZoneType.DEEP;
      return CurrentZoneType.WARM;
    }

    if (!this.isWater(x, y)) return null;

    const gx = Math.floor((x / this.worldWidth) * this.MASK_SIZE);
    const gy = Math.floor((y / this.worldHeight) * this.MASK_SIZE);
    const index = (gy * this.MASK_SIZE + gx) * 4;

    const r = this.maskData[index];
    const g = this.maskData[index + 1];
    const b = this.maskData[index + 2];

    // 1. Попытка определить по цветам поверхностной маски
    if (r > 100 && b > 150 && g < 100) return CurrentZoneType.DEEP; // Фиолетовый
    if (b > 150 && r < 100 && g < 100) return CurrentZoneType.COLD;  // Синий
    if (r > 180 && g > 40 && b < 100) return CurrentZoneType.WARM;   // Оранжевый

    // 2. Фолбэк (для бинарной/белой маски или нетипичных градаций цвета): делим по широте Y
    if (y < this.worldHeight * 0.33) return CurrentZoneType.COLD;
    if (y < this.worldHeight * 0.66) return CurrentZoneType.DEEP;
    return CurrentZoneType.WARM;
  }

  /**
   * ПОЛУЧЕНИЕ ПОЛНЫХ ДАННЫХ О ТЕЧЕНИИ ДЛЯ ОВЕРЛЕЕВ И ЧАСТИЦ
   */
  public getCurrentAt(x: number, y: number): CurrentData {
    const isWater = this.isWater(x, y);
    const zone = isWater ? this.getZoneAt(x, y) : null;
    const fallbackZone = zone || CurrentZoneType.DEEP;

    return {
      vx: 0,
      vy: 0,
      zoneType: zone,
      targetColor: ZONE_COLOR_MAP[fallbackZone],
      isWater: isWater
    };
  }

  public getInitialParticlesForZone(zone: CurrentZoneType, count: number): Point2D[] {
    const points: Point2D[] = [];
    const pool = this.zoneSpawnPoints[zone];

    if (!pool || pool.length === 0) {
      for (let i = 0; i < count; i++) {
        points.push({
          x: Math.random() * this.worldWidth,
          y: Math.random() * this.worldHeight
        });
      }
      return points;
    }

    for (let i = 0; i < count; i++) {
      const randomPt = pool[Math.floor(Math.random() * pool.length)];
      points.push({
        x: randomPt.x + (Math.random() - 0.5) * 40,
        y: randomPt.y + (Math.random() - 0.5) * 40
      });
    }

    return points;
  }

  /**
   * 🔥 УДОБНЫЙ МЕТОД: Возвращает сразу все 10 000 частиц для трех зон
   */
  public getAllInitialParticles(): Array<Point2D & { zone: CurrentZoneType; color: string }> {
    const result: Array<Point2D & { zone: CurrentZoneType; color: string }> = [];
    const zones = [CurrentZoneType.DEEP, CurrentZoneType.COLD, CurrentZoneType.WARM];

    for (const zone of zones) {
      const count = ZONE_PARTICLE_COUNTS[zone];
      const points = this.getInitialParticlesForZone(zone, count);
      
      for (const pt of points) {
        result.push({
          x: pt.x,
          y: pt.y,
          zone: zone,
          color: ZONE_COLOR_MAP[zone]
        });
      }
    }

    return result;
  }

  public getCurrentVectorForParticle(
    x: number,
    y: number,
    currentVx: number,
    currentVy: number,
    assignedZone: CurrentZoneType
  ): CurrentData {
    let vx = currentVx;
    let vy = currentVy;

    if (Math.hypot(vx, vy) < 0.1) {
      vx = 0.5;
      vy = -0.5;
    }

    const speed = this.baseSpeed * ZONE_SPEED_MULTIPLIERS[assignedZone];
    const currentAngle = Math.atan2(vy, vx);
    const PROBE_DIST = 35;

    const nextX = x + Math.cos(currentAngle) * PROBE_DIST;
    const nextY = y + Math.sin(currentAngle) * PROBE_DIST;

    if (this.getZoneAt(nextX, nextY) !== assignedZone) {
      let bestAngle = currentAngle;
      let foundPath = false;

      for (let delta = 0.2; delta <= Math.PI; delta += 0.2) {
        for (const sign of [1, -1]) {
          const testAngle = currentAngle + delta * sign;
          const testX = x + Math.cos(testAngle) * PROBE_DIST;
          const testY = y + Math.sin(testAngle) * PROBE_DIST;

          if (this.getZoneAt(testX, testY) === assignedZone) {
            bestAngle = testAngle;
            foundPath = true;
            break;
          }
        }
        if (foundPath) break;
      }

      vx = Math.cos(bestAngle);
      vy = Math.sin(bestAngle);
    }

    const len = Math.hypot(vx, vy) || 1;
    return {
      vx: (vx / len) * speed,
      vy: (vy / len) * speed,
      zoneType: assignedZone,
      targetColor: ZONE_COLOR_MAP[assignedZone],
      isWater: true
    };
  }

  public static lerpColor(currentColor: string, targetColor: string, speed: number = 0.05): string {
    if (currentColor === targetColor) return currentColor;
    const c1 = OceanCurrentsManager.hexToRgb(currentColor);
    const c2 = OceanCurrentsManager.hexToRgb(targetColor);
    if (!c1 || !c2) return targetColor;

    const r = Math.round(c1.r + (c2.r - c1.r) * speed);
    const g = Math.round(c1.g + (c2.g - c1.g) * speed);
    const b = Math.round(c1.b + (c2.b - c1.b) * speed);

    return OceanCurrentsManager.rgbToHex(r, g, b);
  }

  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return null;
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16)
    };
  }

  private static rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
