import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';

export enum CurrentZoneType {
  WARM = 'WARM',
  MIXED = 'MIXED',
  COLD = 'COLD'
}

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType;
  isWater: boolean;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 200;

  private readonly centerPoint = 4000;
  private readonly MASK_SIZE = 1000; // Разрешение маски

  // 2D-сетка: 1 - вода, 0 - суша (поддерживает любую геометрию карты и острова)
  private waterGrid: Uint8Array = new Uint8Array(this.MASK_SIZE * this.MASK_SIZE).fill(0);
  private zoneGrid: Uint8Array = new Uint8Array(this.MASK_SIZE * this.MASK_SIZE).fill(1);
  
  private waterSpawnPoints: { x: number; y: number }[] = [];
  public isLoaded: boolean = false;

  // Кэшированные RGB-значения для мгновенного сравнения
  private landRGB: RGB;
  private oceanZonesRGB: { rgb: RGB; index: number }[] = [];

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Предварительно парсим Hex в RGB, чтобы не производить строковых операций в цикле
    this.landRGB = this.hexToRgb(LAND_ZONE_CONFIG.hexColor);
    this.oceanZonesRGB = OCEAN_ZONES_CONFIG.map(zone => {
      const id = zone.id.toLowerCase();
      let index = 1; // По умолчанию MIXED
      if (id.includes('shallow') || id.includes('shelf')) index = 0; // WARM
      else if (id.includes('trench') || id.includes('abyssal')) index = 2; // COLD

      return {
        rgb: this.hexToRgb(zone.hexColor),
        index
      };
    });

    this.initScanner();
  }

  private hexToRgb(hex: string): RGB {
    const cleanHex = hex.replace('#', '');
    return {
      r: parseInt(cleanHex.substring(0, 2), 16) || 0,
      g: parseInt(cleanHex.substring(2, 4), 16) || 0,
      b: parseInt(cleanHex.substring(4, 6), 16) || 0
    };
  }

  private async initScanner(): Promise<void> {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous'; 
      img.src = 'assets/ocean_zones_mask.png';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Mask image failed to load'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = this.MASK_SIZE;
      canvas.height = this.MASK_SIZE;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, this.MASK_SIZE, this.MASK_SIZE);
      const imgData = ctx.getImageData(0, 0, this.MASK_SIZE, this.MASK_SIZE);

      this.processMaskData(imgData);
      
      this.isLoaded = true;
      console.log(`[Scanner] Карта построена. Безопасных точек спавна: ${this.waterSpawnPoints.length}`);
    } catch (e) {
      console.error('[Scanner] КРИТИЧЕСКАЯ ОШИБКА ЧТЕНИЯ МАСКИ!', e);
      this.buildEmergencyMask();
      this.isLoaded = true;
    }
  }

  /**
   * Высокопроизводительный 2D сканер маски без создания мусорных объектов в памяти
   */
  private processMaskData(imgData: ImageData): void {
    const data = imgData.data;
    const cellWidth = this.worldWidth / this.MASK_SIZE;
    const cellHeight = this.worldHeight / this.MASK_SIZE;

    this.waterSpawnPoints = [];

    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      for (let gx = 0; gx < this.MASK_SIZE; gx++) {
        const idx = gy * this.MASK_SIZE + gx;
        const pixelIdx = idx * 4;

        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        const a = data[pixelIdx + 3];

        // Критерии суши: прозрачность пикселя или близость к цвету земли
        const isTransparent = a < 150;
        const isLand = isTransparent || (this.colorDistanceRgb(r, g, b, this.landRGB) < 70);

        if (!isLand) {
          // Отмечаем пиксель как воду
          this.waterGrid[idx] = 1;

          // Определяем тип океанической зоны по прямому сравнению RGB
          this.zoneGrid[idx] = this.resolveZoneIndexFast(r, g, b);

          // Равномерно генерируем спавн-точки для воды (шаг 4x4 для оптимизации памяти)
          if (gx % 4 === 0 && gy % 4 === 0) {
            this.waterSpawnPoints.push({
              x: (gx + Math.random()) * cellWidth,
              y: (gy + Math.random()) * cellHeight
            });
          }
        } else {
          this.waterGrid[idx] = 0;
        }
      }
    }
  }

  // Аварийная разметка на случай ошибки загрузки изображения
  private buildEmergencyMask(): void {
    this.waterSpawnPoints = [];
    const cellWidth = this.worldWidth / this.MASK_SIZE;
    const cellHeight = this.worldHeight / this.MASK_SIZE;

    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      for (let gx = 0; gx < this.MASK_SIZE; gx++) {
        const idx = gy * this.MASK_SIZE + gx;
        const isWater = gx < (this.MASK_SIZE - gy * 0.5);

        if (isWater) {
          this.waterGrid[idx] = 1;
          this.zoneGrid[idx] = 1; // MIXED
          if (gx % 10 === 0 && gy % 10 === 0) {
            this.waterSpawnPoints.push({
              x: (gx + Math.random()) * cellWidth,
              y: (gy + Math.random()) * cellHeight
            });
          }
        } else {
          this.waterGrid[idx] = 0;
        }
      }
    }
  }

  private resolveZoneIndexFast(r: number, g: number, b: number): number {
    let closestIndex = 1;
    let minDistance = Infinity;

    for (let i = 0; i < this.oceanZonesRGB.length; i++) {
      const item = this.oceanZonesRGB[i];
      const dist = this.colorDistanceRgb(r, g, b, item.rgb);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = item.index;
      }
    }

    return closestIndex;
  }

  private colorDistanceRgb(r: number, g: number, b: number, target: RGB): number {
    return Math.sqrt((r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2);
  }

  /**
   * СВЕРХБЫСТРАЯ ПРОВЕРКА ВОДЫ ($O(1)$ сложности с поддержкой островов)
   */
  public isWater(x: number, y: number): boolean {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return false;

    const gx = Math.min(this.MASK_SIZE - 1, Math.max(0, Math.floor((x / this.worldWidth) * this.MASK_SIZE)));
    const gy = Math.min(this.MASK_SIZE - 1, Math.max(0, Math.floor((y / this.worldHeight) * this.MASK_SIZE)));

    return this.waterGrid[gy * this.MASK_SIZE + gx] === 1;
  }

  public getRandomWaterPosition(): { x: number; y: number } {
    if (this.waterSpawnPoints.length > 0) {
      const idx = Math.floor(Math.random() * this.waterSpawnPoints.length);
      return this.waterSpawnPoints[idx];
    }
    return { x: this.centerPoint, y: this.centerPoint };
  }

  public getCurrentAt(x: number, y: number): CurrentData {
    const isWater = this.isWater(x, y);

    const nx = (x - this.centerPoint) / this.centerPoint;
    const ny = (y - this.centerPoint) / this.centerPoint;

    let vx = -ny * 1.1 + Math.sin(y * 0.005) * 0.2;
    let vy = nx * 0.9 + Math.cos(x * 0.005) * 0.2;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.baseSpeed;
    vy = (vy / len) * this.baseSpeed;

    const gx = Math.min(this.MASK_SIZE - 1, Math.max(0, Math.floor((x / this.worldWidth) * this.MASK_SIZE)));
    const gy = Math.min(this.MASK_SIZE - 1, Math.max(0, Math.floor((y / this.worldHeight) * this.MASK_SIZE)));
    
    const zoneIdx = this.zoneGrid[gy * this.MASK_SIZE + gx];

    let zoneType = CurrentZoneType.MIXED;
    if (zoneIdx === 0) zoneType = CurrentZoneType.WARM;
    if (zoneIdx === 2) zoneType = CurrentZoneType.COLD;

    return { vx, vy, zoneType, isWater };
  }
}
