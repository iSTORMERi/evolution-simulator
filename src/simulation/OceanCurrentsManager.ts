import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';

export interface ShorePoint {
  x: number;
  y: number;
}

export enum CurrentZoneType {
  WARM = 'WARM', // 🟠 Теплое течение (повернутый стадион справа)
  COLD = 'COLD'  // 🔵 Холодное течение (повернутый стадион слева)
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
   * Универсальный вектор для повернутого стадиона
   */
  private getRotatedStadiumVector(
    x: number,
    y: number,
    track: { cx: number; cy: number; halfLength: number; radius: number; angleRad: number }
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

    const cosR = Math.cos(angleRad);
    const sinR = Math.sin(angleRad);
    return {
      x: lvx * cosR - lvy * sinR,
      y: lvx * sinR + lvy * cosR
    };
  }

  /**
   * Вектор замкнутого треугольного круговорота со сглаженными вершинами
   */
  private getTriangleGyreVector(
    x: number,
    y: number,
    p0: Point2D,
    p1: Point2D,
    p2: Point2D,
    radius: number
  ): Point2D | null {
    const vertices = [p0, p1, p2];
    let minDist = Infinity;
    let bestDir: Point2D = { x: 0, y: 0 };

    for (let i = 0; i < 3; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % 3];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;

      const dirX = dx / len;
      const dirY = dy / len;

      let t = ((x - a.x) * dx + (y - a.y) * dy) / (len * len);
      t = Math.max(0, Math.min(1, t));

      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      const dist = Math.hypot(x - projX, y - projY);

      if (dist < minDist) {
        minDist = dist;
        bestDir = { x: dirX, y: dirY };
      }
    }

    if (minDist > radius) return null;

    // Сглаживание траектории вокруг вершин треугольника
    const CORNER_SMOOTH_RADIUS = radius * 1.2;
    for (let i = 0; i < 3; i++) {
      const v = vertices[i];
      const dToVertex = Math.hypot(x - v.x, y - v.y);

      if (dToVertex <= CORNER_SMOOTH_RADIUS) {
        const rx = x - v.x;
        const ry = y - v.y;
        const rLen = Math.hypot(rx, ry) || 1;

        // Вектор касательной к вершине (по часовой стрелке)
        const tangentX = -ry / rLen;
        const tangentY = rx / rLen;

        const blend = 1 - dToVertex / CORNER_SMOOTH_RADIUS;
        bestDir.x = bestDir.x * (1 - blend) + tangentX * blend;
        bestDir.y = bestDir.y * (1 - blend) + tangentY * blend;

        const bLen = Math.hypot(bestDir.x, bestDir.y) || 1;
        bestDir.x /= bLen;
        bestDir.y /= bLen;
      }
    }

    return bestDir;
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

    let totalVx = 0;
    let totalVy = 0;
    let activeCount = 0;
    let primaryZone = CurrentZoneType.COLD;

    // --- 1. ХОЛОДНОЕ ТЕЧЕНИЕ (Основной синий стадион слева) ---
    const coldTrack = {
      cx: 2200,
      cy: 2800,
      halfLength: 1800,
      radius: 800,
      angleRad: (-30 * Math.PI) / 180
    };

    const coldVec = this.getRotatedStadiumVector(x, y, coldTrack);
    if (coldVec) {
      totalVx += coldVec.x;
      totalVy += coldVec.y;
      activeCount++;
      primaryZone = CurrentZoneType.COLD;
    }

    // --- 2. СЕВЕРНЫЙ ТРЕУГОЛЬНЫЙ ГИР (Верхний левый угол) ---
    const northTriangle = {
      p0: { x: 800, y: 600 },
      p1: { x: 3200, y: 800 },
      p2: { x: 2200, y: 3200 }, // Перекрывается с верхней частью холодного стадиона
      radius: 750
    };

    const northVec = this.getTriangleGyreVector(
      x,
      y,
      northTriangle.p0,
      northTriangle.p1,
      northTriangle.p2,
      northTriangle.radius
    );
    if (northVec) {
      totalVx += northVec.x;
      totalVy += northVec.y;
      activeCount++;
      primaryZone = CurrentZoneType.COLD;
    }

    // --- 3. ТЕПЛОЕ ТЕЧЕНИЕ (Оранжевый стадион справа) ---
    const warmTrack = {
      cx: 4200,
      cy: 4200,
      halfLength: 2400,
      radius: 1000,
      angleRad: (-65 * Math.PI) / 180
    };

    const warmVec = this.getRotatedStadiumVector(x, y, warmTrack);
    if (warmVec) {
      totalVx += warmVec.x;
      totalVy += warmVec.y;
      activeCount++;
      primaryZone = CurrentZoneType.WARM;
    }

    // --- РЕЗУЛЬТИРУЮЩИЙ РАСЧЕТ И ВЕКТОРНОЕ СЛОЖЕНИЕ ---
    if (activeCount === 0) {
      return {
        vx: 0,
        vy: 0,
        zoneType: CurrentZoneType.COLD,
        targetColor: '#1e293b',
        isWater: true
      };
    }

    const combinedLen = Math.hypot(totalVx, totalVy);

    // В области наложения (активна турбулентность) слегка усиливаем скорость потока
    const speedBoost = activeCount > 1 ? 1.15 : 1.0;
    const finalVx = (totalVx / (combinedLen || 1)) * this.baseSpeed * speedBoost;
    const finalVy = (totalVy / (combinedLen || 1)) * this.baseSpeed * speedBoost;

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
