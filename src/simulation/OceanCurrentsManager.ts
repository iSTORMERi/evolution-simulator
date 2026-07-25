import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';

export interface ShorePoint {
  x: number;
  y: number;
}

export enum CurrentZoneType {
  WARM = 'WARM', // 🟠 Прибрежное теплое течение (кольцо справа снизу)
  COLD = 'COLD'  // 🔵 Глубоководное холодное течение (кольцо слева сверху)
}

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType;
  targetColor: string; // HEX-цвет текущей зоны для частицы
  isWater: boolean;
}

// Карта точных цветов для визуализации двух кольцевых течений
export const ZONE_COLOR_MAP: Record<CurrentZoneType, string> = {
  [CurrentZoneType.WARM]: '#FF8C00', // Оранжевый
  [CurrentZoneType.COLD]: '#00BFFF'  // Ледяной синий
};

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 200;

  private readonly MASK_SIZE = 1000;

  // Хранит максимальный X (предел океана) для каждого Y маски
  private shorelineLimits: Float32Array = new Float32Array(this.MASK_SIZE).fill(0);
  
  private waterSpawnPoints: { x: number; y: number }[] = [];
  public isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.initScanner();
  }

  /**
   * Прямая синхронизация точек берега из внешних источников (WorldMap)
   */
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
    console.log(`[CurrentsManager] Берег успешно синхронизирован через setShorelinePoints.`);
  }

  /**
   * Инициализация и загрузка черно-белой маски ocean_binary_mask.png
   */
  private async initScanner(): Promise<void> {
    try {
      const img = new Image();
      img.src = 'assets/ocean_binary_mask.png';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Binary mask (ocean_binary_mask.png) failed to load'));
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
      console.log(`[CurrentsManager] Сканирование ocean_binary_mask.png завершено. Спавн-точек: ${this.waterSpawnPoints.length}`);
    } catch (e) {
      console.error('[CurrentsManager] Ошибка загрузки маски:', e);
      this.buildEmergencyWall();
      this.isLoaded = true;
    }
  }

  /**
   * Сканирование СПРАВА НАЛЕВО по бинарной маске
   */
  private runBinaryRightToLeftScanner(imgData: ImageData): void {
    const data = imgData.data;
    const cellHeight = this.worldHeight / this.MASK_SIZE;
    const SAFETY_BUFFER_PX = 4; 

    this.waterSpawnPoints = [];

    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      let foundShoreX = -1;

      for (let gx = this.MASK_SIZE - 1; gx >= 0; gx--) {
        const i = (gy * this.MASK_SIZE + gx) * 4;
        const r = data[i];

        if (r > 128) {
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

  /**
   * Резервный расчет границы на случай сбоя сети или файла
   */
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

  /**
   * Проверка: находится ли координата (x, y) в воде
   */
  public isWater(x: number, y: number): boolean {
    if (!this.isLoaded) return false;
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return false;

    const scanY = Math.min(
      this.MASK_SIZE - 1, 
      Math.floor((y / this.worldHeight) * this.MASK_SIZE)
    );
    
    return x < this.shorelineLimits[scanY]; 
  }

  /**
   * Получить случайную позицию спавна частиц в воде
   */
  public getRandomWaterPosition(): { x: number; y: number } {
    if (this.waterSpawnPoints.length > 0) {
      const idx = Math.floor(Math.random() * this.waterSpawnPoints.length);
      return this.waterSpawnPoints[idx];
    }
    return { x: 500, y: 4000 };
  }

  /**
   * Расчет вектора направления по геометрии вытянутого стадиона (Racetrack)
   */
  private getStadiumVector(
    x: number,
    y: number,
    track: { xLeft: number; xRight: number; yCenter: number; radius: number }
  ): { vx: number; vy: number } | null {
    const { xLeft, xRight, yCenter, radius } = track;
    const dy = y - yCenter;

    // 1. Прямой участок (между xLeft и xRight)
    if (x >= xLeft && x <= xRight) {
      if (Math.abs(dy) <= radius) {
        // Верхняя половина трассы (dy < 0) -> вправо, Нижняя (dy >= 0) -> влево
        return {
          vx: dy < 0 ? 1 : -1,
          vy: 0
        };
      }
      return null;
    }

    // 2. Левый разворот (полукруг вокруг xLeft, yCenter)
    if (x < xLeft) {
      const dx = x - xLeft;
      if (Math.hypot(dx, dy) <= radius) {
        // Вектор касательной для вращения по часовой стрелке
        return { vx: -dy, vy: dx };
      }
      return null;
    }

    // 3. Правый разворот (полукруг вокруг xRight, yCenter)
    if (x > xRight) {
      const dx = x - xRight;
      if (Math.hypot(dx, dy) <= radius) {
        // Вектор касательной для вращения по часовой стрелке
        return { vx: -dy, vy: dx };
      }
      return null;
    }

    return null;
  }

  /**
   * Расчет векторного поля ТОЛЬКО для двух вытянутых овальных (стадионных) течений
   */
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

    // --- 1. ХОЛОДНОЕ ТЕЧЕНИЕ (Слева сверху -- вытянутый стадион) ---
    const coldTrack = {
      xLeft: 800,
      xRight: 4500,
      yCenter: 2000,
      radius: 700
    };

    const coldVec = this.getStadiumVector(x, y, coldTrack);
    if (coldVec) {
      const len = Math.hypot(coldVec.vx, coldVec.vy) || 1;
      return {
        vx: (coldVec.vx / len) * this.baseSpeed,
        vy: (coldVec.vy / len) * this.baseSpeed,
        zoneType: CurrentZoneType.COLD,
        targetColor: ZONE_COLOR_MAP[CurrentZoneType.COLD],
        isWater: true
      };
    }

    // --- 2. ТЕПЛОЕ ТЕЧЕНИЕ (Справа снизу у берега -- вытянутый стадион) ---
    const warmTrack = {
      xLeft: 1500,
      xRight: 5000,
      yCenter: 6000,
      radius: 800
    };

    const warmVec = this.getStadiumVector(x, y, warmTrack);
    if (warmVec) {
      const len = Math.hypot(warmVec.vx, warmVec.vy) || 1;
      return {
        vx: (warmVec.vx / len) * this.baseSpeed,
        vy: (warmVec.vy / len) * this.baseSpeed,
        zoneType: CurrentZoneType.WARM,
        targetColor: ZONE_COLOR_MAP[CurrentZoneType.WARM],
        isWater: true
      };
    }

    // --- 3. НЕЙТРАЛЬНАЯ ВОДА (Вне трасс движение отсутствует) ---
    return {
      vx: 0,
      vy: 0,
      zoneType: CurrentZoneType.COLD,
      targetColor: '#1e293b', // Темный фоновый цвет для нейтральной воды
      isWater: true
    };
  }

  /**
   * Вспомогательный метод для плавной интерполяции цвета частиц (lerp)
   */
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
