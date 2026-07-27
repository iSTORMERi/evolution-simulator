import * as PIXI from 'pixi.js';
import { OceanCurrentsManager } from '../simulation/OceanCurrentsManager';

export class CurrentsBackgroundOverlay {
  public container: PIXI.Container;
  private sprite: PIXI.Sprite | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private currentsManager: OceanCurrentsManager;
  private worldWidth: number;
  private worldHeight: number;

  private readonly GRID_SIZE = 512;
  private isGenerated: boolean = false;

  // Цвет глубинного затемнения океана (глубокий тёмно-синий)
  private readonly DARK_OCEAN_COLOR = { r: 4, g: 12, b: 26 };

  constructor(
    currentsManager: OceanCurrentsManager, 
    worldWidth: number = 8000, 
    worldHeight: number = 8000
  ) {
    this.container = new PIXI.Container();
    this.currentsManager = currentsManager;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.GRID_SIZE;
    this.offscreenCanvas.height = this.GRID_SIZE;

    const ctx = this.offscreenCanvas.getContext('2d');
    if (!ctx) throw new Error('Offscreen context unavailable');
    this.offscreenCtx = ctx;

    this.tryPreload();
  }

  private tryPreload(): void {
    const checkInterval = setInterval(() => {
      if (this.currentsManager.isLoaded) {
        this.generateMap();
        clearInterval(checkInterval);
      }
    }, 100);
  }

  public generateMap(): void {
    if (this.isGenerated) return;

    const size = this.GRID_SIZE;
    const stepX = this.worldWidth / size;
    const stepY = this.worldHeight / size;

    // 1. Создаем математическую 32-битную сетку значений (1.0 - вода, 0.0 - суша)
    let alphaGrid = new Float32Array(size * size);

    for (let gy = 0; gy < size; gy++) {
      for (let gx = 0; gx < size; gx++) {
        const worldX = (gx + 0.5) * stepX;
        const worldY = (gy + 0.5) * stepY;
        const currentData = this.currentsManager.getCurrentAt(worldX, worldY);
        alphaGrid[gy * size + gx] = currentData.isWater ? 1.0 : 0.0;
      }
    }

    // 2. Чистый JS Гауссов блёр (3 прохода разделимого Box Blur дают идеальное Гауссово размытие)
    alphaGrid = this.applyFastGaussianBlur(alphaGrid, size, size, 10, 3);

    // 3. Записываем математически чистый градиент в пиксели холста
    const imgData = this.offscreenCtx.createImageData(size, size);
    const data = imgData.data;

    for (let i = 0; i < size * size; i++) {
      const idx = i * 4;
      // Плавное затухание (smoothstep) для растворения границы у прибоя
      const rawAlpha = alphaGrid[i];
      const smoothAlpha = rawAlpha * rawAlpha * (3 - 2 * rawAlpha); // Функция Smoothstep

      data[idx]     = this.DARK_OCEAN_COLOR.r;
      data[idx + 1] = this.DARK_OCEAN_COLOR.g;
      data[idx + 2] = this.DARK_OCEAN_COLOR.b;
      data[idx + 3] = Math.round(smoothAlpha * 255);
    }

    this.offscreenCtx.putImageData(imgData, 0, 0);
    this.isGenerated = true;

    // 4. Создаём текстуру PixiJS с высокой точностью фильтрации
    const texture = PIXI.Texture.from(this.offscreenCanvas);
    if (texture.source) {
      texture.source.scaleMode = 'linear';
    }

    this.sprite = new PIXI.Sprite(texture);
    this.sprite.width = this.worldWidth;
    this.sprite.height = this.worldHeight;
    
    this.sprite.alpha = 0.7;
    this.sprite.blendMode = 'multiply';

    this.container.addChild(this.sprite);
  }

  /**
   * Быстрый и математически точный Гауссов блёр на Float32 без артефактов бандинга
   */
  private applyFastGaussianBlur(
    src: Float32Array, 
    width: number, 
    height: number, 
    radius: number, 
    passes: number
  ): Float32Array {
    let current = new Float32Array(src);
    let temp = new Float32Array(width * height);

    for (let pass = 0; pass < passes; pass++) {
      // Горизонтальный размывающий проход
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let r = -radius; r <= radius; r++) {
          const x = Math.min(Math.max(r, 0), width - 1);
          sum += current[y * width + x];
        }
        for (let x = 0; x < width; x++) {
          temp[y * width + x] = sum / (radius * 2 + 1);
          const removeX = Math.min(Math.max(x - radius, 0), width - 1);
          const addX = Math.min(Math.max(x + radius + 1, 0), width - 1);
          sum += current[y * width + addX] - current[y * width + removeX];
        }
      }

      // Вертикальный размывающий проход
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let r = -radius; r <= radius; r++) {
          const y = Math.min(Math.max(r, 0), height - 1);
          sum += temp[y * width + x];
        }
        for (let y = 0; y < height; y++) {
          current[y * width + x] = sum / (radius * 2 + 1);
          const removeY = Math.min(Math.max(y - radius, 0), height - 1);
          const addY = Math.min(Math.max(y + radius + 1, 0), height - 1);
          sum += temp[x + addY * width] - temp[x + removeY * width];
        }
      }
    }

    return current;
  }
}
