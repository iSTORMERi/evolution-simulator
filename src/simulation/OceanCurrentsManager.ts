export interface ShorePoint {
  x: number;
  y: number;
}

// Три чистые поверхностные зоны (Layer 1)
export enum CurrentZoneType {
  DEEP = 'DEEP',   // 🟣 Фиолетовая (Глубоководное течение)
  COLD = 'COLD',   // 🔵 Синяя (Среднее холодное течение)
  WARM = 'WARM'    // 🟠 Оранжевое (Теплое прибрежное течение)
}

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType | null;
  targetColor: string;
  isWater: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export const ZONE_COLOR_MAP: Record<CurrentZoneType, string> = {
  [CurrentZoneType.DEEP]: '#8A00FF', // 🟣 Фиолетовый
  [CurrentZoneType.COLD]: '#0000FF', // 🔵 Синий
  [CurrentZoneType.WARM]: '#FF5500'  // 🟠 Оранжевый
};

export const ZONE_SPEED_MULTIPLIERS: Record<CurrentZoneType, number> = {
  [CurrentZoneType.DEEP]: 0.85,
  [CurrentZoneType.COLD]: 1.0,
  [CurrentZoneType.WARM]: 1.15
};

export class OceanCurrentsManager {
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 70;

  private readonly MASK_SIZE = 1000;
  private maskData: Uint8ClampedArray | null = null;

  // Точки для однократного спавна частиц по зонам
  private zoneSpawnPoints: Record<CurrentZoneType, Point2D[]> = {
    [CurrentZoneType.DEEP]: [],
    [CurrentZoneType.COLD]: [],
    [CurrentZoneType.WARM]: []
  };

  public isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  // --- 1. ЗАГРУЗКА И СКАННИРОВАНИЕ МАСКИ СЛОЯ 1 ---
  public async initScanner(): Promise<void> {
    try {
      const img = new Image();
      img.src = '/assets/ocean_surface_mask.png';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load ocean_surface_mask.png'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = this.MASK_SIZE;
      canvas.height = this.MASK_SIZE;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, this.MASK_SIZE, this.MASK_SIZE);
      const imgData = ctx.getImageData(0, 0, this.MASK_SIZE, this.MASK_SIZE);

      this.maskData = imgData.data;
      this.buildSpawnTables();
      this.isLoaded = true;
      console.log('[OceanCurrentsManager] Layer 1 Surface Mask successfully loaded.');
    } catch (e) {
      console.error('[OceanCurrentsManager] Ошибка загрузки маски слоев:', e);
    }
  }

  // Заполнение списков координат для спавна частиц
  private buildSpawnTables(): void {
    if (!this.maskData) return;

    const cellW = this.worldWidth / this.MASK_SIZE;
    const cellH = this.worldHeight / this.MASK_SIZE;

    for (let gy = 0; gy < this.MASK_SIZE; gy += 4) {
      for (let gx = 0; gx < this.MASK_SIZE; gx += 4) {
        const worldX = (gx + 0.5) * cellW;
        const worldY = (gy + 0.5) * cellH;

        const zone = this.getZoneAt(worldX, worldY);
        if (zone) {
          this.zoneSpawnPoints[zone].push({ x: worldX, y: worldY });
        }
      }
    }
  }

  // --- 2. ОПРЕДЕЛЕНИЕ ЗОНЫ ПО КООРДИНАТАМ ---
  public getZoneAt(x: number, y: number): CurrentZoneType | null {
    if (!this.maskData) return null;
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return null;

    const gx = Math.floor((x / this.worldWidth) * this.MASK_SIZE);
    const gy = Math.floor((y / this.worldHeight) * this.MASK_SIZE);
    const index = (gy * this.MASK_SIZE + gx) * 4;

    const r = this.maskData[index];
    const g = this.maskData[index + 1];
    const b = this.maskData[index + 2];

    // 🟣 Фиолетовый (DEEP)
    if (r > 100 && b > 150 && g < 50) return CurrentZoneType.DEEP;
    // 🔵 Синий (COLD)
    if (b > 180 && r < 50 && g < 50) return CurrentZoneType.COLD;
    // 🟠 Оранжевый (WARM)
    if (r > 200 && g > 40 && b < 50) return CurrentZoneType.WARM;

    return null; // Суша (Черный)
  }

  public isWater(x: number, y: number): boolean {
    return this.getZoneAt(x, y) !== null;
  }

  // --- 3. ПОЛУЧЕНИЕ НАЧАЛЬНЫХ ТОЧЕК СПАВНА ДЛЯ ЧАСТИЦ ---
  // Гарантирует, что частицы создаются 1 раз при старте строго в своей зоне
  public getInitialParticlesForZone(zone: CurrentZoneType, count: number): Point2D[] {
    const points: Point2D[] = [];
    const pool = this.zoneSpawnPoints[zone];

    if (!pool || pool.length === 0) {
      // Фолбэк спавн если маска еще грузится
      for (let i = 0; i < count; i++) {
        points.push({ x: this.worldWidth * 0.2, y: this.worldHeight * 0.5 });
      }
      return points;
    }

    for (let i = 0; i < count; i++) {
      const randomPt = pool[Math.floor(Math.random() * pool.length)];
      // Добавляем небольшой случайный сдвиг в пределах ячейки
      points.push({
        x: randomPt.x + (Math.random() - 0.5) * 40,
        y: randomPt.y + (Math.random() - 0.5) * 40
      });
    }

    return points;
  }

  // --- 4. РАСЧЕТ ДВИЖЕНИЯ И УДЕРЖАНИЕ ЧАСТИЦ В ЗОНЕ ---
  /**
   * Рассчитывает вектор скорости частицы.
   * Если частица идет к границе своей зоны -- вектор плавно поворачивается, удерживая её внутри.
   */
  public getCurrentVectorForParticle(
    x: number,
    y: number,
    currentVx: number,
    currentVy: number,
    assignedZone: CurrentZoneType
  ): CurrentData {
    if (!this.isLoaded) {
      return {
        vx: 0,
        vy: 0,
        zoneType: assignedZone,
        targetColor: ZONE_COLOR_MAP[assignedZone],
        isWater: true
      };
    }

    // Базовое направление течения по умолчанию (плывём вдоль коридоров карты на север/северо-восток)
    let vx = currentVx;
    let vy = currentVy;

    if (Math.hypot(vx, vy) < 0.1) {
      vx = 0.5;
      vy = -0.5;
    }

    const speed = this.baseSpeed * ZONE_SPEED_MULTIPLIERS[assignedZone];
    const currentAngle = Math.atan2(vy, vx);
    const PROBE_DIST = 35; // Дистанция проверки стены впереди

    // Проверяем, останется ли частица в своей зоне при движении вперед
    const nextX = x + Math.cos(currentAngle) * PROBE_DIST;
    const nextY = y + Math.sin(currentAngle) * PROBE_DIST;

    if (this.getZoneAt(nextX, nextY) !== assignedZone) {
      // Впереди граница зоны или суша! Сканируем веер углов в поисках безопасного пути внутри родной зоны
      let bestAngle = currentAngle;
      let foundPath = false;

      for (let delta = 0.2; delta <= Math.PI; delta += 0.2) {
        for (const sign of [1, -1]) {
          const testAngle = currentAngle + delta * sign;
          const testX = x + Math.cos(testAngle) * PROBE_DIST;
          const testY = y + Math.sin(testAngle) * PROBE_DIST;

          if (this.getZoneAt(testX, testY) === assignedZone) {
            bestAngle = testAngle;
            foundPath = true;
            break;
          }
        }
        if (foundPath) break;
      }

      // Плавно разворачиваем вектор в сторону свободного коридора
      vx = Math.cos(bestAngle);
      vy = Math.sin(bestAngle);
    }

    // Нормализуем скорость
    const len = Math.hypot(vx, vy) || 1;
    const finalVx = (vx / len) * speed;
    const finalVy = (vy / len) * speed;

    return {
      vx: finalVx,
      vy: finalVy,
      zoneType: assignedZone,
      targetColor: ZONE_COLOR_MAP[assignedZone],
      isWater: true
    };
  }

  // Вспомогательный LERP цвета
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
