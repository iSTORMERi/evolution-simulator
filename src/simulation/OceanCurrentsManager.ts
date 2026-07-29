import * as PIXI from 'pixi.js';

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
  private maskCanvas: HTMLCanvasElement | null = null; // Canvas с чистым силуэтом воды
  private darkeningSprite: PIXI.Sprite | null = null;  // Спрайт затемнения PIXI

  private overlayOpacity: number = 0.6;
  private overlayBlur: number = 12;

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
      // Поддержка относительных путей для Vite и GitHub Pages
      const baseUrl = (import.meta as any).env?.BASE_URL || './';
      const maskPath = `${baseUrl.replace(/\/$/, '')}/assets/ocean_surface_mask.png`;

      img.src = maskPath;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load mask at ${maskPath}`));
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

      // Генерируем отдельную альфа-маску только для воды (суша = прозрачная)
      this.generateWaterAlphaCanvas();

      this.buildSpawnTables();
      this.isLoaded = true;

      // Если спрайт затемнения успели создать до завершения загрузки маски -- обновляем его!
      if (this.darkeningSprite) {
        this.refreshDarkeningTexture();
      }

      console.log('[OceanCurrentsManager] Layer 1 Surface Mask successfully loaded.');
    } catch (e) {
      console.warn('[OceanCurrentsManager] Предупреждение: маска PNG не загружена, включаем процедурный фолбэк.', e);
      this.generateFallbackSpawnPoints();
      this.isLoaded = true; // Гарантируем запуск физики течений
    }
  }

  /**
   * Генерация монохромной маски воды с прозрачной сушей для точного затемнения
   */
  private generateWaterAlphaCanvas(): void {
    if (!this.maskData) return;

    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = this.MASK_SIZE;
    alphaCanvas.height = this.MASK_SIZE;
    const ctx = alphaCanvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(this.MASK_SIZE, this.MASK_SIZE);

    for (let i = 0; i < this.maskData.length; i += 4) {
      const r = this.maskData[i];
      const g = this.maskData[i + 1];
      const b = this.maskData[i + 2];

      // Проверяем принадлежность к любой из трех зон океана
      const isWater = (r > 100 && b > 150 && g < 50) ||
                      (b > 180 && r < 50 && g < 50) ||
                      (r > 200 && g > 40 && b < 50);

      if (isWater) {
        imgData.data[i] = 255;     // R
        imgData.data[i + 1] = 255; // G
        imgData.data[i + 2] = 255; // B
        imgData.data[i + 3] = 255; // Альфа-канал (видимая вода)
      } else {
        imgData.data[i + 3] = 0;   // Полная прозрачность для суши
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.maskCanvas = alphaCanvas;
  }

  /**
   * ГЕНЕРАЦИЯ ЗАТЕМНЯЮЩЕГО СЛОЯ ОКЕАНА С МЯГКОЙ БЕРЕГОВОЙ ЛИНИЕЙ
   */
  public createDarkeningOverlay(opacity: number = 0.6, blurRadius: number = 12): PIXI.Sprite {
    this.overlayOpacity = opacity;
    this.overlayBlur = blurRadius;

    if (this.darkeningSprite) return this.darkeningSprite;

    this.darkeningSprite = new PIXI.Sprite();
    this.refreshDarkeningTexture();

    // Масштабируем спрайт на весь игровой мир (быстро и без перегрузки GPU)
    this.darkeningSprite.width = this.worldWidth;
    this.darkeningSprite.height = this.worldHeight;

    this.darkeningSprite.alpha = 0;
    this.darkeningSprite.visible = false;

    return this.darkeningSprite;
  }

  /**
   * Пересоздание текстуры затемнения на лету
   */
  private refreshDarkeningTexture(): void {
    if (!this.darkeningSprite) return;

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = this.MASK_SIZE;
    renderCanvas.height = this.MASK_SIZE;
    const ctx = renderCanvas.getContext('2d');

    if (ctx) {
      if (this.maskCanvas) {
        // 1. Применяем размытие для мягкого градиента у берега
        ctx.filter = `blur(${this.overlayBlur}px)`;

        // 2. Рисуем маску океана
        ctx.drawImage(this.maskCanvas, 0, 0, this.MASK_SIZE, this.MASK_SIZE);

        // 3. Закрашиваем силуэт океана темным сине-черным цветом
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = `rgba(5, 12, 28, ${this.overlayOpacity})`;
        ctx.fillRect(0, 0, this.MASK_SIZE, this.MASK_SIZE);
      } else {
        // Временный прямоугольник пока маска загружается
        ctx.fillStyle = `rgba(5, 12, 28, ${this.overlayOpacity})`;
        ctx.fillRect(0, 0, this.MASK_SIZE, this.MASK_SIZE);
      }
    }

    this.darkeningSprite.texture = PIXI.Texture.from(renderCanvas);
  }

  /**
   * Анимация плавного появления/исчезновения затемнения
   */
  public updateDarkening(deltaSeconds: number, showCurrents: boolean, fadeSpeed: number = 2.5): void {
    if (!this.darkeningSprite) return;

    const targetAlpha = showCurrents ? 1.0 : 0.0;

    if (showCurrents) {
      this.darkeningSprite.visible = true;
    }

    if (Math.abs(this.darkeningSprite.alpha - targetAlpha) > 0.01) {
      this.darkeningSprite.alpha += (targetAlpha - this.darkeningSprite.alpha) * deltaSeconds * fadeSpeed;
    } else {
      this.darkeningSprite.alpha = targetAlpha;
      if (targetAlpha === 0) {
        this.darkeningSprite.visible = false;
      }
    }
  }

  // Процедурная генерация спавн-точек если PNG не доступен
  private generateFallbackSpawnPoints(): void {
    const zones = [CurrentZoneType.DEEP, CurrentZoneType.COLD, CurrentZoneType.WARM];
    const pointsPerZone = 400;

    for (const zone of zones) {
      for (let i = 0; i < pointsPerZone; i++) {
        this.zoneSpawnPoints[zone].push({
          x: Math.random() * this.worldWidth,
          y: Math.random() * this.worldHeight
        });
      }
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
    if (!this.maskData) {
      // Фолбэк зон по высоте если маска не была загружена
      if (y < this.worldHeight * 0.33) return CurrentZoneType.COLD;
      if (y < this.worldHeight * 0.66) return CurrentZoneType.DEEP;
      return CurrentZoneType.WARM;
    }
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
  public getInitialParticlesForZone(zone: CurrentZoneType, count: number): Point2D[] {
    const points: Point2D[] = [];
    const pool = this.zoneSpawnPoints[zone];

    if (!pool || pool.length === 0) {
      for (let i = 0; i < count; i++) {
        points.push({
          x: Math.random() * this.worldWidth,
          y: Math.random() * this.worldHeight
        });
      }
      return points;
    }

    for (let i = 0; i < count; i++) {
      const randomPt = pool[Math.floor(Math.random() * pool.length)];
      points.push({
        x: randomPt.x + (Math.random() - 0.5) * 40,
        y: randomPt.y + (Math.random() - 0.5) * 40
      });
    }

    return points;
  }

  // --- 4. РАСЧЕТ ДВИЖЕНИЯ И УДЕРЖАНИЕ ЧАСТИЦ В ЗОНЕ ---
  public getCurrentVectorForParticle(
    x: number,
    y: number,
    currentVx: number,
    currentVy: number,
    assignedZone: CurrentZoneType
  ): CurrentData {
    let vx = currentVx;
    let vy = currentVy;

    if (Math.hypot(vx, vy) < 0.1) {
      vx = 0.5;
      vy = -0.5;
    }

    const speed = this.baseSpeed * ZONE_SPEED_MULTIPLIERS[assignedZone];
    const currentAngle = Math.atan2(vy, vx);
    const PROBE_DIST = 35; // Дистанция проверки стены впереди

    const nextX = x + Math.cos(currentAngle) * PROBE_DIST;
    const nextY = y + Math.sin(currentAngle) * PROBE_DIST;

    if (this.getZoneAt(nextX, nextY) !== assignedZone) {
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

      vx = Math.cos(bestAngle);
      vy = Math.sin(bestAngle);
    }

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
