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
  
  // Увеличиваем точность физической сетки в 4 раза! (1 ячейка = 10x10 пикселей)
  private readonly GRID_SIZE = 800;

  private waterGrid: Uint8Array = new Uint8Array(800 * 800).fill(1);
  private zoneGrid: Uint8Array = new Uint8Array(800 * 800).fill(1);
  
  private waterSpawnPoints: { x: number; y: number }[] = [];
  public isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.initMaskGrid();
  }

  private async initMaskGrid(): Promise<void> {
    try {
      const img = new Image();
      img.src = 'assets/ocean_zones_mask.png'; // Без crossOrigin для локалки

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Mask image not found'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = this.GRID_SIZE;
      canvas.height = this.GRID_SIZE;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context unavailable');

      // КРИТИЧЕСКИ ВАЖНО: Отключаем сглаживание пикселей при сжатии
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(img, 0, 0, this.GRID_SIZE, this.GRID_SIZE);
      const imgData = ctx.getImageData(0, 0, this.GRID_SIZE, this.GRID_SIZE);

      this.buildGrids(imgData);
      
      // КРИТИЧЕСКИ ВАЖНО: Применяем эрозию (отступ от берега)
      this.applyCoastalErosion(2); // 2 ячейки = отступ 20 пикселей от берега

      this.isLoaded = true;
      console.log(`[CurrentsManager] Сетка 800x800 построена. Эрозия применена.`);
    } catch (e) {
      console.warn('[CurrentsManager] Ошибка маски, задействован фоллбэк:', e);
      this.buildFallbackGrid();
      this.isLoaded = true;
    }
  }

  private buildGrids(imgData: ImageData): void {
    const data = imgData.data;
    
    for (let gy = 0; gy < this.GRID_SIZE; gy++) {
      for (let gx = 0; gx < this.GRID_SIZE; gx++) {
        const i = (gy * this.GRID_SIZE + gx) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        const gridIdx = gy * this.GRID_SIZE + gx;

        // Если пиксель хоть немного прозрачный -- это железобетонная суша
        if (a < 200) {
          this.waterGrid[gridIdx] = 0;
          continue;
        }

        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        // Жесткий порог для суши
        const landDist = this.colorDistance(hex, LAND_ZONE_CONFIG.hexColor);
        if (landDist < 60) {
          this.waterGrid[gridIdx] = 0;
        } else {
          this.waterGrid[gridIdx] = 1;
          this.zoneGrid[gridIdx] = this.resolveZoneIndex(hex);
        }
      }
    }
  }

  /**
   * АЛГОРИТМ ЭРОЗИИ БЕРЕГА
   * Отодвигает невидимую границу океана подальше от берега.
   */
  private applyCoastalErosion(bufferSize: number): void {
    const newWaterGrid = new Uint8Array(this.waterGrid);
    const cellWidth = this.worldWidth / this.GRID_SIZE;
    const cellHeight = this.worldHeight / this.GRID_SIZE;
    this.waterSpawnPoints = []; // Очищаем и собираем только БЕЗОПАСНЫЕ точки

    for (let gy = 0; gy < this.GRID_SIZE; gy++) {
      for (let gx = 0; gx < this.GRID_SIZE; gx++) {
        const idx = gy * this.GRID_SIZE + gx;
        
        // Если это уже суша, пропускаем
        if (this.waterGrid[idx] === 0) continue;

        let isSafeWater = true;

        // Проверяем соседей в радиусе bufferSize
        for (let dy = -bufferSize; dy <= bufferSize; dy++) {
          for (let dx = -bufferSize; dx <= bufferSize; dx++) {
            const ny = gy + dy;
            const nx = gx + dx;
            
            // Если вышли за границы мира или сосед -- суша
            if (ny < 0 || ny >= this.GRID_SIZE || nx < 0 || nx >= this.GRID_SIZE) {
              isSafeWater = false;
              break;
            }
            
            if (this.waterGrid[ny * this.GRID_SIZE + nx] === 0) {
              isSafeWater = false;
              break;
            }
          }
          if (!isSafeWater) break;
        }

        if (!isSafeWater) {
          // Превращаем опасную прибрежную воду в "сушу" для коллайдеров
          newWaterGrid[idx] = 0;
        } else {
          // Сохраняем только безопасные точки для спавна (разреживаем кэш для экономии памяти)
          if (Math.random() > 0.5) {
            this.waterSpawnPoints.push({
              x: (gx + Math.random()) * cellWidth,
              y: (gy + Math.random()) * cellHeight
            });
          }
        }
      }
    }

    this.waterGrid = newWaterGrid; // Заменяем сетку на безопасную
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

  private buildFallbackGrid(): void {
    // Упрощенный фоллбэк для 800x800
    const cellWidth = this.worldWidth / this.GRID_SIZE;
    const cellHeight = this.worldHeight / this.GRID_SIZE;
    this.waterSpawnPoints = [];

    for (let gy = 0; gy < this.GRID_SIZE; gy++) {
      for (let gx = 0; gx < this.GRID_SIZE; gx++) {
        const wx = (gx + 0.5) * cellWidth;
        const wy = (gy + 0.5) * cellHeight;
        const dist = Math.hypot(wx - this.centerPoint, wy - this.centerPoint);
        
        const gridIdx = gy * this.GRID_SIZE + gx;
        const isWater = dist > 600 && dist < 3800;

        this.waterGrid[gridIdx] = isWater ? 1 : 0;
        if (isWater) this.waterSpawnPoints.push({ x: wx, y: wy });
      }
    }
  }

  public isWater(x: number, y: number): boolean {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return false;

    const gx = Math.floor((x / this.worldWidth) * this.GRID_SIZE);
    const gy = Math.floor((y / this.worldHeight) * this.GRID_SIZE);
    
    return this.waterGrid[gy * this.GRID_SIZE + gx] === 1;
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

    const gx = Math.floor(Math.max(0, Math.min(1, x / this.worldWidth)) * (this.GRID_SIZE - 1));
    const gy = Math.floor(Math.max(0, Math.min(1, y / this.worldHeight)) * (this.GRID_SIZE - 1));
    const zoneIdx = this.zoneGrid[gy * this.GRID_SIZE + gx];

    let zoneType = CurrentZoneType.MIXED;
    if (zoneIdx === 0) zoneType = CurrentZoneType.WARM;
    if (zoneIdx === 2) zoneType = CurrentZoneType.COLD;

    return { vx, vy, zoneType, isWater };
  }
}
