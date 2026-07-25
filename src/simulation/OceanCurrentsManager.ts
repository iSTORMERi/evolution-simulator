import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';
import { ZoneConfig } from '../world/types';

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

  // Быстрая сетка 200x200 для O(1) проверок физики
  private readonly GRID_SIZE = 200;
  private waterGrid: Uint8Array = new Uint8Array(200 * 200);
  private zoneGrid: Uint8Array = new Uint8Array(200 * 200); // 0: WARM, 1: MIXED, 2: COLD
  
  // Кэш готовых точек воды для мгновенного спавна без циклов
  private waterSpawnPoints: { x: number; y: number }[] = [];
  
  private isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Фоновая безопасная загрузка и построение сетки
    this.initMaskGrid();
  }

  /**
   * Асинхронная сборка быстрой сетки биомов и воды
   */
  private async initMaskGrid(): Promise<void> {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = 'assets/ocean_zones_mask.png';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Mask load failed'));
      });

      // Масштабируем до сетки 200x200 для молниеносного чтения
      const canvas = document.createElement('canvas');
      canvas.width = this.GRID_SIZE;
      canvas.height = this.GRID_SIZE;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.drawImage(img, 0, 0, this.GRID_SIZE, this.GRID_SIZE);
      const imgData = ctx.getImageData(0, 0, this.GRID_SIZE, this.GRID_SIZE);

      this.buildGrids(imgData);
      this.isLoaded = true;
    } catch (e) {
      console.warn('OceanCurrentsManager: Используется круговой фоллбэк', e);
      this.buildFallbackGrid();
      this.isLoaded = true;
    }
  }

  /**
   * Парсинг пикселей и заполнение массивов в памяти
   */
  private buildGrids(imgData: ImageData): void {
    const data = imgData.data;
    const cellWidth = this.worldWidth / this.GRID_SIZE;
    const cellHeight = this.worldHeight / this.GRID_SIZE;

    for (let gy = 0; gy < this.GRID_SIZE; gy++) {
      for (let gx = 0; gx < this.GRID_SIZE; gx++) {
        const i = (gy * this.GRID_SIZE + gx) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        const gridIdx = gy * this.GRID_SIZE + gx;

        // Проверка суши
        if (this.colorDistance(hex, LAND_ZONE_CONFIG.hexColor) < 80) {
          this.waterGrid[gridIdx] = 0; // Суша
        } else {
          this.waterGrid[gridIdx] = 1; // Вода

          // Сохраняем мировую координату центра ячейки для мгновенного спавна
          this.waterSpawnPoints.push({
            x: (gx + 0.5) * cellWidth,
            y: (gy + 0.5) * cellHeight
          });

          // Определяем тип зоны течения
          this.zoneGrid[gridIdx] = this.resolveZoneIndex(hex);
        }
      }
    }
  }

  /**
   * Фоллбэк-сетка на случай блокировки картинки браузером
   */
  private buildFallbackGrid(): void {
    const cellWidth = this.worldWidth / this.GRID_SIZE;
    const cellHeight = this.worldHeight / this.GRID_SIZE;

    for (let gy = 0; gy < this.GRID_SIZE; gy++) {
      for (let gx = 0; gx < this.GRID_SIZE; gx++) {
        const wx = (gx + 0.5) * cellWidth;
        const wy = (gy + 0.5) * cellHeight;
        const dist = Math.hypot(wx - this.centerPoint, wy - this.centerPoint);
        
        const gridIdx = gy * this.GRID_SIZE + gx;
        const isWater = dist > 500 && dist < 3700;

        this.waterGrid[gridIdx] = isWater ? 1 : 0;
        this.zoneGrid[gridIdx] = 1; // MIXED по умолчанию

        if (isWater) {
          this.waterSpawnPoints.push({ x: wx, y: wy });
        }
      }
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

    const zoneId = closestZone.id.toLowerCase();
    if (zoneId.includes('shallow') || zoneId.includes('shelf')) return 0; // WARM
    if (zoneId.includes('trench') || zoneId.includes('abyssal')) return 2; // COLD
    return 1; // MIXED
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
   * Быстрая O(1) проверка на воду
   */
  public isWater(x: number, y: number): boolean {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return false;

    const gx = Math.floor((x / this.worldWidth) * this.GRID_SIZE);
    const gy = Math.floor((y / this.worldHeight) * this.GRID_SIZE);
    
    return this.waterGrid[gy * this.GRID_SIZE + gx] === 1;
  }

  /**
   * Мгновенное получение точки на воде за O(1) без циклов
   */
  public getRandomWaterPosition(): { x: number; y: number } {
    if (this.waterSpawnPoints.length > 0) {
      const idx = Math.floor(Math.random() * this.waterSpawnPoints.length);
      return this.waterSpawnPoints[idx];
    }
    return { x: 4000, y: 2000 };
  }

  /**
   * Расчет вектора течения в точке (x, y)
   */
  public getCurrentAt(x: number, y: number): CurrentData {
    const isWater = this.isWater(x, y);

    const nx = (x - this.centerPoint) / this.centerPoint;
    const ny = (y - this.centerPoint) / this.centerPoint;

    let vx = -ny * 1.1;
    let vy = nx * 0.9;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.baseSpeed;
    vy = (vy / len) * this.baseSpeed;

    const gx = Math.floor(Math.max(0, Math.min(1, x / this.worldWidth)) * (this.GRID_SIZE - 1));
    const gy = Math.floor(Math.max(0, Math.min(1, y / this.worldHeight)) * (this.GRID_SIZE - 1));
    const zoneIdx = this.zoneGrid[gy * this.GRID_SIZE + gx];

    let zoneType = CurrentZoneType.MIXED;
    if (zoneIdx === 0) zoneType = CurrentZoneType.WARM;
    if (zoneIdx === 2) zoneType = CurrentZoneType.COLD;

    return { vx, vy, zoneType, isWater };
  }
}
