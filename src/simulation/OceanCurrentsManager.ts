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

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 200;

  private readonly centerPoint = 4000;
  private readonly MASK_SIZE = 1000; // Разрешение сканера по оси Y

  // === БЕЗОПАСНЫЙ БУФЕР ОТСТУПА ЧАСТИЦ ОТ БЕРЕГА ===
  // 80 пикселей игрового мира (около 1% от ширины карты).
  // Частицы физически не смогут подлететь к берегу ближе этой дистанции.
  public SAFETY_MARGIN_PX: number = 80;

  private shorelineLimits: Float32Array = new Float32Array(this.MASK_SIZE).fill(0);
  private zoneGrid: Uint8Array = new Uint8Array(this.MASK_SIZE * this.MASK_SIZE).fill(1);
  
  private waterSpawnPoints: { x: number; y: number }[] = [];
  public isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.initScanner();
  }

  private async initScanner(): Promise<void> {
    try {
      const img = new Image();
      // Обязательно для обхода CORS на GitHub Pages
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

      this.runLeftToRightScanner(imgData);
      
      this.isLoaded = true;
      console.log(`[Scanner] Береговая линия построена. Безопасных точек спавна: ${this.waterSpawnPoints.length}`);
    } catch (e) {
      console.error('[Scanner] Ошибка загрузки маски!', e);
      this.buildEmergencyWall();
      this.isLoaded = true;
    }
  }

  /**
   * Спектральный сканер: определяет воду по преобладанию синего/зеленого каналов.
   * Как только встречает теплые тона берега (красный канал преобладает) -- фиксирует границу.
   */
  private runLeftToRightScanner(imgData: ImageData): void {
    const data = imgData.data;
    const cellHeight = this.worldHeight / this.MASK_SIZE;

    this.waterSpawnPoints = [];

    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      let maxWaterX = 0;
      let hitCoast = false;

      for (let gx = 0; gx < this.MASK_SIZE; gx++) {
        const i = (gy * this.MASK_SIZE + gx) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // КРИТЕРИЙ ВОДЫ:
        // 1. Не прозрачный пиксель (a >= 120)
        // 2. Синий или Зеленый заметно преобладают над Красным (холодный спектр)
        // 3. Красный не превышает порог 190 (у песка R почти всегда > 200)
        const isWaterPixel = (a >= 120) && ((b > r) || (g > r)) && (r < 190);

        if (!isWaterPixel) {
          // Встретили первый же пиксель суши/песка -- мгновенная остановка ряда!
          maxWaterX = gx;
          hitCoast = true;
          break; 
        }

        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        this.zoneGrid[gy * this.MASK_SIZE + gx] = this.resolveZoneIndex(hex);
      }

      if (!hitCoast) {
        maxWaterX = this.MASK_SIZE;
      }

      // Находим абсолютную физическую кромку берега в мировых координатах
      const realShoreX = (maxWaterX / this.MASK_SIZE) * this.worldWidth;
      this.shorelineLimits[gy] = realShoreX;

      // Максимальный X для спавна новых частиц с учетом отступа
      const safeSpawnMaxX = Math.max(0, realShoreX - this.SAFETY_MARGIN_PX);

      if (safeSpawnMaxX > 0) {
        const spawnsInRow = Math.max(1, Math.floor(safeSpawnMaxX / 100));
        for (let s = 0; s < spawnsInRow; s++) {
          this.waterSpawnPoints.push({
            x: Math.random() * safeSpawnMaxX,
            y: (gy + Math.random()) * cellHeight
          });
        }
      }
    }
  }

  private buildEmergencyWall(): void {
    this.waterSpawnPoints = [];
    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      const limitX = this.worldWidth - (gy / this.MASK_SIZE) * (this.worldWidth * 0.5);
      this.shorelineLimits[gy] = limitX;
      
      const safeX = Math.max(0, limitX - this.SAFETY_MARGIN_PX);
      this.waterSpawnPoints.push({
        x: Math.random() * safeX,
        y: (gy / this.MASK_SIZE) * this.worldHeight
      });
    }
  }

  private resolveZoneIndex(hex: string): number {
    let closestZone = OCEAN_ZONES_CONFIG[0];
    let minDistance = Infinity;

    for (const zone of OCEAN_ZONES_CONFIG) {
      const dist = this.colorDistance(hex, zone.hexColor);
      if (dist < minDistance) {
        minDistance = dist;
        closestZone = zone;
      }
    }

    const id = closestZone.id.toLowerCase();
    if (id.includes('shallow') || id.includes('shelf')) return 0;
    if (id.includes('trench') || id.includes('abyssal')) return 2;
    return 1;
  }

  private colorDistance(hex1: string, hex2: string): number {
    const r1 = parseInt(hex1.substring(1, 3), 16) || 0;
    const g1 = parseInt(hex1.substring(3, 5), 16) || 0;
    const b1 = parseInt(hex1.substring(5, 7), 16) || 0;

    const r2 = parseInt(hex2.substring(1, 3), 16) || 0;
    const g2 = parseInt(hex2.substring(3, 5), 16) || 0;
    const b2 = parseInt(hex2.substring(5, 7), 16) || 0;

    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  /**
   * Проверка: находится ли точка в воде.
   * Возвращает true ТОЛЬКО если точка левее линии берега МИНУС безопасный отступ.
   */
  public isWater(x: number, y: number): boolean {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return false;

    const scanY = Math.floor((y / this.worldHeight) * (this.MASK_SIZE - 1));
    const realShoreX = this.shorelineLimits[scanY];

    return x < (realShoreX - this.SAFETY_MARGIN_PX); 
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

    const gx = Math.floor(Math.max(0, Math.min(1, x / this.worldWidth)) * (this.MASK_SIZE - 1));
    const gy = Math.floor(Math.max(0, Math.min(1, y / this.worldHeight)) * (this.MASK_SIZE - 1));
    const zoneIdx = this.zoneGrid[gy * this.MASK_SIZE + gx];

    let zoneType = CurrentZoneType.MIXED;
    if (zoneIdx === 0) zoneType = CurrentZoneType.WARM;
    if (zoneIdx === 2) zoneType = CurrentZoneType.COLD;

    return { vx, vy, zoneType, isWater };
  }
}
