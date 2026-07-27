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

  // Базовый цвет для медленной / фоновой воды (тёмный океанический индиго)
  private readonly SLOW_WATER_COLOR = { r: 10, g: 26, b: 48 };

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

    // Временный холст для точечного расчета пикселей
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
          const zoneColor = this.hexToRgb(currentData.targetColor);
          
          // Нормализуем скорость (от 0 до 1), чтобы определить яркость течения
          const speedFactor = Math.min(Math.max((currentData.speed || 0) / 4.0, 0), 1);

          if (zoneColor && speedFactor > 0.05) {
            // Интерполяция между тёмной базовой водой и ярким цветом зоны
            data[idx]     = Math.round(this.lerp(this.SLOW_WATER_COLOR.r, zoneColor.r, speedFactor));
            data[idx + 1] = Math.round(this.lerp(this.SLOW_WATER_COLOR.g, zoneColor.g, speedFactor));
            data[idx + 2] = Math.round(this.lerp(this.SLOW_WATER_COLOR.b, zoneColor.b, speedFactor));
          } else {
            // Медленное течение -- заливаем тёмным базовым цветом
            data[idx]     = this.SLOW_WATER_COLOR.r;
            data[idx + 1] = this.SLOW_WATER_COLOR.g;
            data[idx + 2] = this.SLOW_WATER_COLOR.b;
          }
          data[idx + 3] = 255; // Полная плотность для всей воды
        } else {
          data[idx + 3] = 0; // Суша остается прозрачной
        }
        idx += 4;
      }
    }

    tempCtx.putImageData(imgData, 0, 0);

    // Применяем мягкое размытие (blur) при отрисовке на финальный холст
    this.offscreenCtx.clearRect(0, 0, this.GRID_SIZE, this.GRID_SIZE);
    this.offscreenCtx.filter = 'blur(10px)';
    this.offscreenCtx.drawImage(tempCanvas, 0, 0);

    this.isGenerated = true;

    // Создаём PixiJS текстуру с линейным сглаживанием
    const texture = PIXI.Texture.from(this.offscreenCanvas);
    if (texture.source) {
      texture.source.scaleMode = 'linear';
    }

    this.sprite = new PIXI.Sprite(texture);
    this.sprite.width = this.worldWidth;
    this.sprite.height = this.worldHeight;
    
    // Полупрозрачное мягкое наложение поверх текстуры океана
    this.sprite.alpha = 0.45;
    this.sprite.blendMode = 'soft-light';

    this.container.addChild(this.sprite);
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    if (!hex) return null;
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return null;
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16)
    };
  }
}
