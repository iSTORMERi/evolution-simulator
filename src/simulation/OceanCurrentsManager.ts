import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';

export interface ShorePoint {
  x: number;
  y: number;
}

export enum CurrentZoneType {
  WARM = 'WARM', // 🟠 Прибрежное теплое течение (S-образный стадион вдоль берега)
  COLD = 'COLD'  // 🔵 Глубоководное холодное течение (повернутый овал слева)
}

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType;
  targetColor: string;
  isWater: boolean;
}

export const ZONE_COLOR_MAP: Record<CurrentZoneType, string> = {
  [CurrentZoneType.WARM]: '#FF8C00', // Оранжевый
  [CurrentZoneType.COLD]: '#00BFFF'  // Ледяной синий
};

interface Point2D {
  x: number;
  y: number;
}

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 200;

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

  /**
   * Вектор для повернутого прямого стадиона (Холодное течение)
   */
  private getRotatedStadiumVector(
    x: number,
    y: number,
    track: { cx: number; cy: number; halfLength: number; radius: number; angleRad: number }
  ): Point2D | null {
    const { cx, cy, halfLength, radius, angleRad } = track;

    // 1. Перевод координат в локальную систему стадиона
    const dx = x - cx;
    const dy = y - cy;
    const cosA = Math.cos(-angleRad);
    const sinA = Math.sin(-angleRad);

    const lx = dx * cosA - dy * sinA;
    const ly = dx * sinA + dy * cosA;

    let lvx = 0;
    let lvy = 0;
    let inside = false;

    // 2. Расчет в локальной системе
    if (Math.abs(lx) <= halfLength) {
      if (Math.abs(ly) <= radius) {
        lvx = ly < 0 ? 1 : -1;
        lvy = 0;
        inside = true;
      }
    } else if (lx > halfLength) {
      const pdx = lx - halfLength;
      if (Math.hypot(pdx, ly) <= radius) {
        lvx = -ly;
        lvy = pdx;
        inside = true;
      }
    } else if (lx < -halfLength) {
      const pdx = lx + halfLength;
      if (Math.hypot(pdx, ly) <= radius) {
        lvx = -ly;
        lvy = pdx;
        inside = true;
      }
    }

    if (!inside) return null;

    // 3. Поворот вектора обратно в мировые координаты
    const cosR = Math.cos(angleRad);
    const sinR = Math.sin(angleRad);
    return {
      x: lvx * cosR - lvy * sinR,
      y: lvx * sinR + lvy * cosR
    };
  }

  /**
   * Вектор для S-образного стадиона по 3 опорным точкам (Теплое течение)
   */
  private getBentStadiumVector(
    px: number,
    py: number,
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    radius: number
  ): Point2D | null {
    const segments = [
      { a: p0, b: p1 },
      { a: p1, b: p2 }
    ];

    let minDist = Infinity;
    let closestProj: Point2D | null = null;
    let activeDir: Point2D = { x: 0, y: 1 };
    let segmentIndex = -1;

    // Поиск ближайшего сегмента
    for (let i = 0; i < segments.length; i++) {
      const { a, b } = segments[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      const dist = Math.hypot(px - projX, py - projY);

      if (dist < minDist) {
        minDist = dist;
        closestProj = { x: projX, y: projY };
        const len = Math.sqrt(lenSq);
        activeDir = { x: dx / len, y: dy / len };
        segmentIndex = i;
      }
    }

    if (minDist > radius || !closestProj) return null;

    // Векторы для разворота на верхнем и нижнем концах трассы
    const distTop = Math.hypot(px - p0.x, py - p0.y);
    if (distTop <= radius && py < p0.y) {
      const dx = px - p0.x;
      const dy = py - p0.y;
      return { x: -dy, y: dx };
    }

    const distBottom = Math.hypot(px - p2.x, py - p2.y);
    if (distBottom <= radius && py > p2.y) {
      const dx = px - p2.x;
      const dy = py - p2.y;
      return { x: -dy, y: dx };
    }

    // Определяем, с какой стороны от оси находится точка (Векторное произведение)
    const cross = activeDir.x * (py - closestProj.y) - activeDir.y * (px - closestProj.x);

    // Вдоль берега (справа от оси) -> течем вниз
    // В глубокой воде (слева от оси) -> течем вверх обратно
    if (cross > 0) {
      return { x: activeDir.x, y: activeDir.y };
    } else {
      return { x: -activeDir.x, y: -activeDir.y };
    }
  }

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

    // --- 1. ХОЛОДНОЕ ТЕЧЕНИЕ (Слева сверху -- выровнено под угол берега) ---
    const coldTrack = {
      cx: 2200,
      cy: 2500,
      halfLength: 1800,
      radius: 800,
      angleRad: (25 * Math.PI) / 180 // Поворот на 25 градусов параллельно берегу
    };

    const coldVec = this.getRotatedStadiumVector(x, y, coldTrack);
    if (coldVec) {
      const len = Math.hypot(coldVec.x, coldVec.y) || 1;
      return {
        vx: (coldVec.x / len) * this.baseSpeed,
        vy: (coldVec.y / len) * this.baseSpeed,
        zoneType: CurrentZoneType.COLD,
        targetColor: ZONE_COLOR_MAP[CurrentZoneType.COLD],
        isWater: true
      };
    }

    // --- 2. ТЕПЛОЕ ТЕЧЕНИЕ (Справа -- S-образный стадион вдоль 3 опорных точек берега) ---
    const warmP0 = { x: 6200, y: 1500 }; // Верх пляжа
    const warmP1 = { x: 4800, y: 4800 }; // Выступающий мыс по центру
    const warmP2 = { x: 6000, y: 7200 }; // Низ пляжа
    const warmRadius = 900;

    const warmVec = this.getBentStadiumVector(x, y, warmP0, warmP1, warmP2, warmRadius);
    if (warmVec) {
      const len = Math.hypot(warmVec.x, warmVec.y) || 1;
      return {
        vx: (warmVec.x / len) * this.baseSpeed,
        vy: (warmVec.y / len) * this.baseSpeed,
        zoneType: CurrentZoneType.WARM,
        targetColor: ZONE_COLOR_MAP[CurrentZoneType.WARM],
        isWater: true
      };
    }

    // --- 3. НЕЙТРАЛЬНАЯ ВОДА ---
    return {
      vx: 0,
      vy: 0,
      zoneType: CurrentZoneType.COLD,
      targetColor: '#1e293b',
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
