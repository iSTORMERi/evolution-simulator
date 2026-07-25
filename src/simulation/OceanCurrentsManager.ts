import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';

export interface ShorePoint {
  x: number;
  y: number;
}

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
  private readonly MASK_SIZE = 1000;

  // Хранит максимальный X (предел океана) для каждого Y маски
  private shorelineLimits: Float32Array = new Float32Array(this.MASK_SIZE).fill(0);
  private zoneGrid: Uint8Array = new Uint8Array(this.MASK_SIZE * this.MASK_SIZE).fill(1);
  
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
        // Запас 40px от границы песка
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
      // Загружаем точный бинарный файл из папки assets
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
   * Сканирование СПРАВА НАЛЕВО:
   * Черный пиксель = Суша (R <= 128)
   * Белый пиксель  = Вода (R > 128)
   */
  private runBinaryRightToLeftScanner(imgData: ImageData): void {
    const data = imgData.data;
    const cellHeight = this.worldHeight / this.MASK_SIZE;

    // Безопасный отступ вглубь океана (в пикселях маски 1000x1000).
    // 4px на маске = 32px в игровом мире (при worldWidth = 8000).
    const SAFETY_BUFFER_PX = 4; 

    this.waterSpawnPoints = [];

    for (let gy = 0; gy < this.MASK_SIZE; gy++) {
      let foundShoreX = -1;

      // Сканируем строку от края суши (справа, gx = 999) налево (gx = 0)
      for (let gx = this.MASK_SIZE - 1; gx >= 0; gx--) {
        const i = (gy * this.MASK_SIZE + gx) * 4;
        const r = data[i]; // В бинарном изображения R, G и B равны

        // Первый белый пиксель со стороны суши -- это водяной край океана
        if (r > 128) {
          foundShoreX = gx;
          break;
        }
      }

      // Если нашли воду, делаем отступ SAFETY_BUFFER_PX влево (в сторону океана)
      const safeWaterX = foundShoreX !== -1 ? Math.max(0, foundShoreX - SAFETY_BUFFER_PX) : 0;
      const worldLimitX = (safeWaterX / this.MASK_SIZE) * this.worldWidth;

      this.shorelineLimits[gy] = worldLimitX;

      // Заполняем сетку температурных зон в зависимости от широты (gy)
      const rowOffset = gy * this.MASK_SIZE;
      for (let gx = 0; gx < this.MASK_SIZE; gx++) {
        if (gy < 300) {
          this.zoneGrid[rowOffset + gx] = 2; // COLD (северные воды)
        } else if (gy > 700) {
          this.zoneGrid[rowOffset + gx] = 0; // WARM (южные воды)
        } else {
          this.zoneGrid[rowOffset + gx] = 1; // MIXED (умеренные воды)
        }
      }

      // Создаем точки возрождения частиц строго внутри пределов воды
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
    return { x: 500, y: this.centerPoint };
  }

  /**
   * Расчет вектора течения и зоны океана в точке (x, y)
   */
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
