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

  // Увеличиваем разрешение до 512х512 для исключения пиксельных ступенек
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

    const stepX = this.worldWidth / this.GRID_SIZE;
    const stepY = this.worldHeight / this.GRID_SIZE;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.GRID_SIZE;
    tempCanvas.height = this.GRID_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imgData = tempCtx.createImageData(this.GRID_SIZE, this.GRID_SIZE);
    const data = imgData.data;

    let idx = 0;
    for (let gy = 0; gy < this.GRID_SIZE; gy++) {
      for (let gx = 0; gx < this.GRID_SIZE; gx++) {
        const worldX = (gx + 0.5) * stepX;
        const worldY = (gy + 0.5) * stepY;

        const currentData = this.currentsManager.getCurrentAt(worldX, worldY);

        if (currentData.isWater) {
          data[idx]     = this.DARK_OCEAN_COLOR.r;
          data[idx + 1] = this.DARK_OCEAN_COLOR.g;
          data[idx + 2] = this.DARK_OCEAN_COLOR.b;
          data[idx + 3] = 255; 
        } else {
          data[idx + 3] = 0; 
        }
        idx += 4;
      }
    }

    tempCtx.putImageData(imgData, 0, 0);

    // Размытие 16px на высоком разрешении даёт безупречно мягкий прибой
    this.offscreenCtx.clearRect(0, 0, this.GRID_SIZE, this.GRID_SIZE);
    this.offscreenCtx.filter = 'blur(16px)';
    this.offscreenCtx.drawImage(tempCanvas, 0, 0);

    this.isGenerated = true;

    // Создаём текстуру PixiJS с линейной фильтрацией
    const texture = PIXI.Texture.from(this.offscreenCanvas);
    if (texture.source) {
      texture.source.scaleMode = 'linear';
    }

    this.sprite = new PIXI.Sprite(texture);
    this.sprite.width = this.worldWidth;
    this.sprite.height = this.worldHeight;
    
    this.sprite.alpha = 0.65;
    this.sprite.blendMode = 'multiply';

    this.container.addChild(this.sprite);
  }
}
