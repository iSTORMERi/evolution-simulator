import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';

export interface ShorePoint {
  x: number;
  y: number;
}

export enum CurrentZoneType {
  WARM = 'WARM',             // 🟠 Тёплые прибрежные вихри и струи вдоль берега
  COLD = 'COLD',             // 🔵 Холодные глубоководные вихри
  CONNECTING = 'CONNECTING', // 🟢 Зелёные магистрали (Из глубины к берегу)
  TRANSIT = 'TRANSIT'        // 🟡 Жёлтые транзиты (От берега в глубину)
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
  [CurrentZoneType.CONNECTING]: '#00FF66', // Сочно-зелёный
  [CurrentZoneType.TRANSIT]: '#FFD700'     // Ярко-жёлтый
};

export const ZONE_SPEED_MULTIPLIERS: Record<CurrentZoneType, number> = {
  [CurrentZoneType.CONNECTING]: 1.4, // 🟢 Самые быстрые мосты
  [CurrentZoneType.TRANSIT]: 1.25,   // 🟡 Скоростной возврат
  [CurrentZoneType.WARM]: 1.0,       // 🟠 Прибрежная циркуляция
  [CurrentZoneType.COLD]: 0.85       // 🔵 Плотные глубокие массы
};

interface Point2D {
  x: number;
  y: number;
}

interface GyreNode {
  cx: number;
  cy: number;
  radius: number;
  clockwise: boolean;
  type: CurrentZoneType.WARM | CurrentZoneType.COLD;
}

interface StreamLine {
  p0: Point2D;
  p1: Point2D;
  p2?: Point2D; // Точка изгиба для дуги Безье
  radius: number;
  type: CurrentZoneType.CONNECTING | CurrentZoneType.TRANSIT;
}

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 65;

  private readonly MASK_SIZE = 1000;
  private shorelineLimits: Float32Array = new Float32Array(this.MASK_SIZE).fill(0);
  private waterSpawnPoints: Point2D[] = [];
  public isLoaded: boolean = false;

  // --- 1. КОВЕР ВИХРЕЙ (ГЛУБИННЫЕ СИНИЕ И ПРИБРЕЖНЫЕ ОРАНЖЕВЫЕ) ---
  private readonly GYRES: GyreNode[] = [
    // 🔵 ГЛУБОКОВОДНАЯ ЗОНА (Слева)
    { cx: 1500, cy: 1500, radius: 1400, clockwise: true, type: CurrentZoneType.COLD },
    { cx: 1200, cy: 3800, radius: 1300, clockwise: false, type: CurrentZoneType.COLD },
    { cx: 1800, cy: 6200, radius: 1500, clockwise: true, type: CurrentZoneType.COLD },
    { cx: 3200, cy: 2200, radius: 1200, clockwise: false, type: CurrentZoneType.COLD },
    { cx: 3000, cy: 5000, radius: 1300, clockwise: true, type: CurrentZoneType.COLD },

    // 🟠 ПРИБРЕЖНАЯ ЗОНА (Справа вдоль берега)
    { cx: 5800, cy: 1200, radius: 900, clockwise: true, type: CurrentZoneType.WARM },
    { cx: 6200, cy: 2800, radius: 1000, clockwise: false, type: CurrentZoneType.WARM },
    { cx: 5200, cy: 4200, radius: 1100, clockwise: true, type: CurrentZoneType.WARM },
    { cx: 4800, cy: 6000, radius: 1000, clockwise: false, type: CurrentZoneType.WARM },
    { cx: 4200, cy: 7200, radius: 800, clockwise: true, type: CurrentZoneType.WARM }
  ];

  // --- 2. МЕЖЗОНАЛЬНЫЕ МОСТЫ (ЗЕЛЕНЫЕ И ЖЕЛТЫЕ СТРУИ) ---
  private readonly STREAMS: StreamLine[] = [
    // 🟢 ЗЕЛЕНЫЕ СТРУИ: Из глубины к берегу
    {
      p0: { x: 1000, y: 1500 },
      p1: { x: 3000, y: 3000 },
      p2: { x: 5500, y: 4000 },
      radius: 950,
      type: CurrentZoneType.CONNECTING
    },
    {
      p0: { x: 1500, y: 4500 },
      p1: { x: 3200, y: 5800 },
      p2: { x: 4500, y: 6800 },
      radius: 900,
      type: CurrentZoneType.CONNECTING
    },

    // 🟡 ЖЕЛТЫЕ СТРУИ: От берега в глубину (параллельно зеленым!)
    {
      p0: { x: 5800, y: 1800 },
      p1: { x: 3800, y: 1000 },
      p2: { x: 2200, y: 800 },
      radius: 900,
      type: CurrentZoneType.TRANSIT
    },
    {
      p0: { x: 6000, y: 4800 },
      p1: { x: 3800, y: 3600 },
      p2: { x: 2000, y: 3000 },
      radius: 950,
      type: CurrentZoneType.TRANSIT
    }
  ];

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

  // --- МАТЕМАТИКА ВИХРЕЙ И СТРУЙ ---

  private getGyreVector(x: number, y: number, gyre: GyreNode): { vx: number; vy: number; weight: number } | null {
    const dx = x - gyre.cx;
    const dy = y - gyre.cy;
    const dist = Math.hypot(dx, dy);

    if (dist > gyre.radius || dist === 0) return null;

    // Гладкий спад влияния от центра к краям
    const normDist = dist / gyre.radius;
    const weight = Math.cos(normDist * Math.PI * 0.5);

    const dir = gyre.clockwise ? 1 : -1;
    const vx = -dir * (dy / dist);
    const vy = dir * (dx / dist);

    return { vx, vy, weight };
  }

  private getStreamVector(x: number, y: number, stream: StreamLine): { vx: number; vy: number; weight: number } | null {
    if (stream.p2) {
      // Дуга Безье
      const SAMPLES = 30;
      let minDistSq = Infinity;
      let bestT = 0;

      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const invT = 1 - t;
        const bx = invT * invT * stream.p0.x + 2 * invT * t * stream.p1.x + t * t * stream.p2.x;
        const by = invT * invT * stream.p0.y + 2 * invT * t * stream.p1.y + t * t * stream.p2.y;

        const dSq = (x - bx) * (x - bx) + (y - by) * (y - by);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          bestT = t;
        }
      }

      const dist = Math.sqrt(minDistSq);
      if (dist > stream.radius) return null;

      const invT = 1 - bestT;
      const tangentX = 2 * invT * (stream.p1.x - stream.p0.x) + 2 * bestT * (stream.p2.x - stream.p1.x);
      const tangentY = 2 * invT * (stream.p1.y - stream.p0.y) + 2 * bestT * (stream.p2.y - stream.p1.y);

      const len = Math.hypot(tangentX, tangentY) || 1;
      const weight = Math.cos((dist / stream.radius) * Math.PI * 0.5) * 1.5; // Мосты имееют приоритет

      return { vx: tangentX / len, vy: tangentY / len, weight };
    } else {
      // Прямая линия
      const dx = stream.p1.x - stream.p0.x;
      const dy = stream.p1.y - stream.p0.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return null;

      let t = ((x - stream.p0.x) * dx + (y - stream.p0.y) * dy) / (len * len);
      t = Math.max(0, Math.min(1, t));

      const projX = stream.p0.x + t * dx;
      const projY = stream.p0.y + t * dy;
      const dist = Math.hypot(x - projX, y - projY);

      if (dist > stream.radius) return null;

      const weight = Math.cos((dist / stream.radius) * Math.PI * 0.5) * 1.5;
      return { vx: dx / len, vy: dy / len, weight };
    }
  }

  // --- ГЛАВНЫЙ РАСЧЕТ ТЕЧЕНИЙ ---

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
    let totalWeight = 0;

    const weights: Record<CurrentZoneType, number> = {
      [CurrentZoneType.WARM]: 0,
      [CurrentZoneType.COLD]: 0,
      [CurrentZoneType.CONNECTING]: 0,
      [CurrentZoneType.TRANSIT]: 0
    };

    // 1. Проверяем все вихри
    for (const gyre of this.GYRES) {
      const res = this.getGyreVector(x, y, gyre);
      if (res) {
        totalVx += res.vx * res.weight;
        totalVy += res.vy * res.weight;
        totalWeight += res.weight;
        weights[gyre.type] += res.weight;
      }
    }

    // 2. Проверяем все линейные и дуговые мосты
    for (const stream of this.STREAMS) {
      const res = this.getStreamVector(x, y, stream);
      if (res) {
        totalVx += res.vx * res.weight;
        totalVy += res.vy * res.weight;
        totalWeight += res.weight;
        weights[stream.type] += res.weight;
      }
    }

    // 3. ФОНОВОЕ ПЛАНЕТАРНОЕ ТЕЧЕНИЕ (Гарантия от нулевых точек!)
    // Если точка оказалась ровно на стыке двух противодействующих вихрей
    if (totalWeight === 0 || Math.hypot(totalVx, totalVy) < 0.05) {
      // Береговой сток на северо-восток вдоль общей линии карты
      totalVx = 0.5;
      totalVy = -0.5;
      weights[CurrentZoneType.COLD] = 0.1;
    }

    // Определение доминирующего типа течения для цвета и скорости
    let dominantZone = CurrentZoneType.COLD;
    let maxW = -1;
    for (const zType in weights) {
      const type = zType as CurrentZoneType;
      if (weights[type] > maxW) {
        maxW = weights[type];
        dominantZone = type;
      }
    }

    // Нормализация скорости (никакого застоя, всегда baseSpeed!)
    const len = Math.hypot(totalVx, totalVy) || 1;
    const speed = this.baseSpeed * ZONE_SPEED_MULTIPLIERS[dominantZone];

    return {
      vx: (totalVx / len) * speed,
      vy: (totalVy / len) * speed,
      zoneType: dominantZone,
      targetColor: ZONE_COLOR_MAP[dominantZone],
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
