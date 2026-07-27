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

  private readonly GRID_SIZE = 160;
  private isGenerated: boolean = false;

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

    // 1. Создаем временный холст для сырой пиксельной сетки
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
          const rgb = this.hexToRgb(currentData.targetColor);
          if (rgb) {
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = 255;
          }
        } else {
          data[idx + 3] = 0; // Суша
        }
        idx += 4;
      }
    }

    tempCtx.putImageData(imgData, 0, 0);

    // 2. Переносим сырую сетку на основной холст С ГАУССОВЫМ РАЗМЫТИЕМ
    // blur(6px) на разрешении 160х160 даёт потрясающий мягкий градиент на карте 8000х8000
    this.offscreenCtx.clearRect(0, 0, this.GRID_SIZE, this.GRID_SIZE);
    this.offscreenCtx.filter = 'blur(6px)';
    this.offscreenCtx.drawImage(tempCanvas, 0, 0);

    this.isGenerated = true;

    // 3. Создаём текстуру PixiJS с линейной фильтрацией
    const texture = PIXI.Texture.from(this.offscreenCanvas);
    if (texture.source) {
      texture.source.scaleMode = 'linear'; // Линейное сглаживание масштабирования
    }

    this.sprite = new PIXI.Sprite(texture);
    this.sprite.width = this.worldWidth;
    this.sprite.height = this.worldHeight;
    
    // Мягкая прозрачность и органичный режим наложения на воду
    this.sprite.alpha = 0.3;
    this.sprite.blendMode = 'soft-light'; 

    this.container.addChild(this.sprite);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return null;
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16)
    };
  }
}
