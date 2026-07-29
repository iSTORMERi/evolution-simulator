import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';

export interface ShorePoint {
  x: number;
  y: number;
}

export enum CurrentZoneType {
  WARM = 'WARM',             // 🟠 Теплое течение (Даунвеллинг / Воронка)
  COLD = 'COLD',             // 🔵 Холодное течение (Апвеллинг / Подъём)
  TRANSIT = 'TRANSIT',       // 🟡 Выносящие транзитные дуги
  CONNECTING = 'CONNECTING', // 🟢 Центральная скоростная магистраль
  STAGNATION = 'STAGNATION'  // 🌊 Застойная закольцованная зона (стадион)
}

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType;
  targetColor: string;
  isWater: boolean;
}

export const ZONE_COLOR_MAP: Record<CurrentZoneType, string> = {
  [CurrentZoneType.WARM]: '#FF8C00',       // Оранжевый
  [CurrentZoneType.COLD]: '#00BFFF',       // Ледяной синий
  [CurrentZoneType.TRANSIT]: '#FFD700',    // Ярко-жёлтый
  [CurrentZoneType.CONNECTING]: '#00FF66', // Сочно-зелёный
  [CurrentZoneType.STAGNATION]: '#3A506B'  // Тёмно-бирюзовый застой
};

// Мультипликаторы скоростей для разных зон
export const ZONE_SPEED_MULTIPLIERS: Record<CurrentZoneType, number> = {
  [CurrentZoneType.CONNECTING]: 1.35, // 🟢 Центральный ускоренный канал
  [CurrentZoneType.TRANSIT]: 1.1,    // 🟡 Транзитные дуги
  [CurrentZoneType.WARM]: 0.9,       // 🟠 Зона даунвеллинга
  [CurrentZoneType.COLD]: 0.85,      // 🔵 Зона апвеллинга
  [CurrentZoneType.STAGNATION]: 0.20 // 🌊 Застойные круговороты (частицы медленно циркулируют и выпадают в осадок)
};

interface Point2D {
  x: number;
  y: number;
}

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 65;

  private readonly MASK_SIZE = 1000;
  private shorelineLimits: Float32Array = new Float32Array(this.MASK_SIZE).fill(0);
  private waterSpawnPoints: Point2D[] = [];
  public isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.initScanner();
  }

  public setShorelinePoints(points: ShorePoint[]): void {
    if (!points || points.length === 0) return;
    this.waterSpawnPoints = [];

    for (const pt of points) {
      const gy = Math.floor((pt.y / this.worldHeight) * this.MASK_SIZE);
      if (gy >= 0 && gy < this.MASK_SIZE) {
        const safeX = Math.max(0, pt.x - 40);
        this.shorelineLimits[gy] = safeX;

        if (safeX > 100) {
          this.waterSpawnPoints.push({
            x: Math.random() * (safeX - 50),
            y: pt.y
          });
        }
      }
    }
    this.isLoaded = true;
  }

  private async initScanner(): Promise<void> {
    try {
      const img = new Image();
      img.src = 'assets/ocean_binary_mask.png';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Binary mask failed to load'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = this.MASK_SIZE;
      canvas.height = this.MASK_SIZE;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, this.MASK_SIZE, this.MASK_SIZE);
      const imgData = ctx.getImageData(0, 0, this.MASK_SIZE, this.MASK_SIZE);

      this.runBinaryRightToLeftScanner(imgData);
      this.isLoaded = true;
    } catch (e) {
      console.error('[CurrentsManager] Ошибка загрузки маски:', e);
      this.buildEmergencyWall();
      this.isLoaded = true;
    }
  }

  private runBinaryRightToLeftScanner(imgData: ImageData): void {
    const data = imgData.data;
    const cellHeight = this.worldHeight / this.MASK_SIZE;
    const SAFETY_BUFFER_PX = 4;

    this.waterSpawnPoints = [];

    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      let foundShoreX = -1;
      for (let gx = this.MASK_SIZE - 1; gx >= 0; gx--) {
        const i = (gy * this.MASK_SIZE + gx) * 4;
        if (data[i] > 128) {
          foundShoreX = gx;
          break;
        }
      }

      const safeWaterX = foundShoreX !== -1 ? Math.max(0, foundShoreX - SAFETY_BUFFER_PX) : 0;
      const worldLimitX = (safeWaterX / this.MASK_SIZE) * this.worldWidth;
      this.shorelineLimits[gy] = worldLimitX;

      if (worldLimitX > 100) {
        for (let s = 0; s < 2; s++) {
          this.waterSpawnPoints.push({
            x: Math.random() * (worldLimitX - 50),
            y: (gy + Math.random()) * cellHeight
          });
        }
      }
    }
  }

  private buildEmergencyWall(): void {
    this.waterSpawnPoints = [];
    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      const limitX = this.worldWidth * 0.6;
      this.shorelineLimits[gy] = limitX;
      this.waterSpawnPoints.push({
        x: Math.random() * limitX,
        y: (gy / this.MASK_SIZE) * this.worldHeight
      });
    }
  }

  public isWater(x: number, y: number): boolean {
    if (!this.isLoaded) return false;
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return false;

    const scanY = Math.min(
      this.MASK_SIZE - 1,
      Math.floor((y / this.worldHeight) * this.MASK_SIZE)
    );
    return x < this.shorelineLimits[scanY];
  }

  public getRandomWaterPosition(): Point2D {
    if (this.waterSpawnPoints.length > 0) {
      const idx = Math.floor(Math.random() * this.waterSpawnPoints.length);
      return this.waterSpawnPoints[idx];
    }
    return { x: 500, y: 4000 };
  }

  // --- МАТЕМАТИЧЕСКИЕ ПРИМИТИВЫ ПОЛЕЙ ---

  /**
   * 1. Вектор Апвеллинга / Даунвеллинга (Сердце течения)
   * Upwelling: Радиальный разлёт + вращение
   * Downwelling: Сход в центр + вращение
   */
  private getHeartNodeVector(
    x: number,
    y: number,
    heart: { cx: number; cy: number; radius: number; isUpwelling: boolean; clockwise?: boolean }
  ): Point2D | null {
    const dx = x - heart.cx;
    const dy = y - heart.cy;
    const dist = Math.hypot(dx, dy);

    if (dist > heart.radius || dist === 0) return null;

    const normX = dx / dist;
    const normY = dy / dist;
    const spinDir = heart.clockwise === false ? -1 : 1;

    // Вращательный вектор (касательный к окружности)
    const tangX = -spinDir * normY;
    const tangY = spinDir * normX;

    // Радиальный вектор (выталкивание для Upwelling, засасывание для Downwelling)
    const radFactor = heart.isUpwelling ? 0.7 : -0.7;
    const radX = normX * radFactor;
    const radY = normY * radFactor;

    // Смешивание радиального и тангенциального потока
    const vx = tangX + radX;
    const vy = tangY + radY;
    const len = Math.hypot(vx, vy) || 1;

    return { x: vx / len, y: vy / len };
  }

  /**
   * 2. Зацикленный стадион / Зона застоя
   * Образует замкнутые орбиты, на которых скорость угасает
   */
  private getStadiumGyreVector(
    x: number,
    y: number,
    track: { cx: number; cy: number; halfLength: number; radius: number; angleRad: number; clockwise?: boolean }
  ): Point2D | null {
    const { cx, cy, halfLength, radius, angleRad } = track;

    const dx = x - cx;
    const dy = y - cy;
    const cosA = Math.cos(-angleRad);
    const sinA = Math.sin(-angleRad);

    const lx = dx * cosA - dy * sinA;
    const ly = dx * sinA + dy * cosA;

    let lvx = 0;
    let lvy = 0;
    let inside = false;
    const dir = track.clockwise === false ? -1 : 1;

    if (Math.abs(lx) <= halfLength) {
      if (Math.abs(ly) <= radius) {
        lvx = ly < 0 ? dir : -dir;
        lvy = 0;
        inside = true;
      }
    } else if (lx > halfLength) {
      const pdx = lx - halfLength;
      if (Math.hypot(pdx, ly) <= radius) {
        lvx = -dir * ly;
        lvy = dir * pdx;
        inside = true;
      }
    } else if (lx < -halfLength) {
      const pdx = lx + halfLength;
      if (Math.hypot(pdx, ly) <= radius) {
        lvx = -dir * ly;
        lvy = dir * pdx;
        inside = true;
      }
    }

    if (!inside) return null;

    const len = Math.hypot(lvx, lvy) || 1;
    lvx /= len;
    lvy /= len;

    const cosR = Math.cos(angleRad);
    const sinR = Math.sin(angleRad);
    return {
      x: lvx * cosR - lvy * sinR,
      y: lvx * sinR + lvy * cosR
    };
  }

  /**
   * 3. Дугообразное (дуга Безье) транзитное течение
   */
  private getCrescentStreamVector(
    x: number,
    y: number,
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    radius: number
  ): Point2D | null {
    const SAMPLES = 25;
    let minDistSq = Infinity;
    let bestT = 0;

    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const invT = 1 - t;

      const bx = invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x;
      const by = invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y;

      const dSq = (x - bx) * (x - bx) + (y - by) * (y - by);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestT = t;
      }
    }

    if (Math.sqrt(minDistSq) > radius) return null;

    const invT = 1 - bestT;
    const tangentX = 2 * invT * (p1.x - p0.x) + 2 * bestT * (p2.x - p1.x);
    const tangentY = 2 * invT * (p1.y - p0.y) + 2 * bestT * (p2.y - p1.y);

    const len = Math.hypot(tangentX, tangentY) || 1;
    return {
      x: tangentX / len,
      y: tangentY / len
    };
  }

  /**
   * 4. Прямое соединительное течение
   */
  private getLinearStreamVector(
    x: number,
    y: number,
    p0: Point2D,
    p1: Point2D,
    radius: number
  ): Point2D | null {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;

    const dirX = dx / len;
    const dirY = dy / len;

    let t = ((x - p0.x) * dx + (y - p0.y) * dy) / (len * len);
    t = Math.max(0, Math.min(1, t));

    const projX = p0.x + t * dx;
    const projY = p0.y + t * dy;
    const dist = Math.hypot(x - projX, y - projY);

    if (dist > radius) return null;

    return {
      x: dirX,
      y: dirY
    };
  }

  // --- ГЛАВНЫЙ РАСЧЕТ ВЕКТОРНОГО ПОЛЯ В ТОЧКЕ ---

  public getCurrentAt(x: number, y: number): CurrentData {
    const isWater = this.isWater(x, y);
    if (!isWater) {
      return {
        vx: 0,
        vy: 0,
        zoneType: CurrentZoneType.WARM,
        targetColor: ZONE_COLOR_MAP[CurrentZoneType.WARM],
        isWater: false
      };
    }

    let totalVx = 0;
    let totalVy = 0;

    let warmWeight = 0;
    let coldWeight = 0;
    let transitWeight = 0;
    let connectingWeight = 0;
    let stagnationWeight = 0;

    // 1. ВЕРХНИЙ ЛЕВЫЙ ЗАСТОЙНЫЙ СТАДИОН (Top-Left Stagnation Gyre)
    const topLeftStagnation = {
      cx: 1600,
      cy: 1600,
      halfLength: 1200,
      radius: 1100,
      angleRad: (25 * Math.PI) / 180,
      clockwise: true
    };
    const topLeftVec = this.getStadiumGyreVector(x, y, topLeftStagnation);
    if (topLeftVec) {
      totalVx += topLeftVec.x * 0.5;
      totalVy += topLeftVec.y * 0.5;
      stagnationWeight += 2.5;
    }

    // 2. НИЖНИЙ ПРАВЫЙ ЗАСТОЙНЫЙ СТАДИОН (Bottom-Right Stagnation Gyre)
    const bottomRightStagnation = {
      cx: 6400,
      cy: 6400,
      halfLength: 1400,
      radius: 1200,
      angleRad: (-35 * Math.PI) / 180,
      clockwise: true
    };
    const bottomRightVec = this.getStadiumGyreVector(x, y, bottomRightStagnation);
    if (bottomRightVec) {
      totalVx += bottomRightVec.x * 0.5;
      totalVy += bottomRightVec.y * 0.5;
      stagnationWeight += 2.5;
    }

    // 3. СЕРДЦЕ ХОЛОДНОГО ТЕЧЕНИЯ (Центральный Апвеллинг - Источник)
    const coldHeart = {
      cx: 2400,
      cy: 3000,
      radius: 1100,
      isUpwelling: true,
      clockwise: false
    };
    const coldHeartVec = this.getHeartNodeVector(x, y, coldHeart);
    if (coldHeartVec) {
      totalVx += coldHeartVec.x * 1.2;
      totalVy += coldHeartVec.y * 1.2;
      coldWeight += 2.0;
    }

    // 4. СЕРДЦЕ ТЁПЛОГО ТЕЧЕНИЯ (Центральный Даунвеллинг - Сток/Воронка)
    const warmHeart = {
      cx: 4600,
      cy: 4500,
      radius: 1200,
      isUpwelling: false,
      clockwise: true
    };
    const warmHeartVec = this.getHeartNodeVector(x, y, warmHeart);
    if (warmHeartVec) {
      totalVx += warmHeartVec.x * 1.2;
      totalVy += warmHeartVec.y * 1.2;
      warmWeight += 2.0;
    }

    // 5. ПРЯМАЯ ЗЕЛЕНАЯ МАГИСТРАЛЬ (Из Апвеллинга в Даунвеллинг)
    const connectingStream = {
      p0: { x: 2400, y: 3000 },
      p1: { x: 4600, y: 4500 },
      radius: 750
    };
    const connectingVec = this.getLinearStreamVector(
      x,
      y,
      connectingStream.p0,
      connectingStream.p1,
      connectingStream.radius
    );
    if (connectingVec) {
      totalVx += connectingVec.x * 1.5;
      totalVy += connectingVec.y * 1.5;
      connectingWeight += 3.0;
    }

    // 6. ПРАВЫЙ ВЕРХНИЙ ТРАНЗИТ (Жёлтая выносящая дуга)
    const topRightCrescent = {
      p0: { x: 6200, y: 2200 },
      p1: { x: 5200, y: 600 },
      p2: { x: 2500, y: 700 },
      radius: 800
    };
    const topCrescentVec = this.getCrescentStreamVector(
      x,
      y,
      topRightCrescent.p0,
      topRightCrescent.p1,
      topRightCrescent.p2,
      topRightCrescent.radius
    );
    if (topCrescentVec) {
      totalVx += topCrescentVec.x * 1.1;
      totalVy += topCrescentVec.y * 1.1;
      transitWeight += 1.8;
    }

    // 7. НИЖНИЙ ЛЕВЫЙ ТРАНЗИТ (Жёлтая выносящая дуга)
    const bottomLeftCrescent = {
      p0: { x: 4800, y: 6800 },
      p1: { x: 2000, y: 7600 },
      p2: { x: 1200, y: 4500 },
      radius: 850
    };
    const bottomCrescentVec = this.getCrescentStreamVector(
      x,
      y,
      bottomLeftCrescent.p0,
      bottomLeftCrescent.p1,
      bottomLeftCrescent.p2,
      bottomLeftCrescent.radius
    );
    if (bottomCrescentVec) {
      totalVx += bottomCrescentVec.x * 1.1;
      totalVy += bottomCrescentVec.y * 1.1;
      transitWeight += 1.8;
    }

    // --- ОБРАБОТКА ТИПА ЗОНЫ И СКОРОСТИ ---
    const maxWeight = Math.max(
      warmWeight,
      coldWeight,
      transitWeight,
      connectingWeight,
      stagnationWeight
    );

    // Если область находится в спокойной воде вне активных течений
    if (maxWeight === 0) {
      return {
        vx: 0,
        vy: 0,
        zoneType: CurrentZoneType.STAGNATION,
        targetColor: ZONE_COLOR_MAP[CurrentZoneType.STAGNATION],
        isWater: true
      };
    }

    let primaryZone = CurrentZoneType.STAGNATION;
    if (maxWeight === connectingWeight) {
      primaryZone = CurrentZoneType.CONNECTING;
    } else if (maxWeight === warmWeight) {
      primaryZone = CurrentZoneType.WARM;
    } else if (maxWeight === coldWeight) {
      primaryZone = CurrentZoneType.COLD;
    } else if (maxWeight === transitWeight) {
      primaryZone = CurrentZoneType.TRANSIT;
    }

    // Нормализация векторного поля
    const combinedLen = Math.hypot(totalVx, totalVy) || 1;
    const zoneSpeed = this.baseSpeed * ZONE_SPEED_MULTIPLIERS[primaryZone];

    const finalVx = (totalVx / combinedLen) * zoneSpeed;
    const finalVy = (totalVy / combinedLen) * zoneSpeed;

    return {
      vx: finalVx,
      vy: finalVy,
      zoneType: primaryZone,
      targetColor: ZONE_COLOR_MAP[primaryZone],
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
