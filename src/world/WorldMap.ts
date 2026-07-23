// src/world/WorldMap.ts

import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from './zoneConfig';
import { ZoneConfig } from './types';
import { ShoreEffects, OpenWaterEffects } from './water';

export class WorldMap {
  public container: PIXI.Container;

  private worldWidth: number;
  private worldHeight: number;

  private mapSprite?: PIXI.Sprite;
  
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D | null;
  private maskData?: ImageData;

  private isLoaded: boolean = false;

  private shoreEffects: ShoreEffects;
  private openWaterEffects: OpenWaterEffects;

  constructor(width: number, height: number) {
    this.container = new PIXI.Container();
    this.worldWidth = width;
    this.worldHeight = height;

    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    this.shoreEffects = new ShoreEffects();
    this.openWaterEffects = new OpenWaterEffects();

    this.initMap();
  }

  private async initMap(): Promise<void> {
    try {
      // 1. Загрузка визуальной текстуры (PixiJS)
      const visualTexture = await PIXI.Assets.load('assets/ocean_visual.png');
      this.mapSprite = new PIXI.Sprite(visualTexture);
      this.mapSprite.width = this.worldWidth;
      this.mapSprite.height = this.worldHeight;
      this.container.addChild(this.mapSprite);

      this.container.addChild(this.openWaterEffects.container);
      this.container.addChild(this.shoreEffects.container);

      // 2. Безопасная загрузка маски через нативный HTML Image (обходит баги Pixi v8)
      const img = new Image();
      img.src = 'assets/ocean_zones_mask.png';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Mask image not found'));
      });

      this.maskCanvas.width = img.width;
      this.maskCanvas.height = img.height;

      if (this.maskCtx) {
        this.maskCtx.drawImage(img, 0, 0);
        this.maskData = this.maskCtx.getImageData(0, 0, img.width, img.height);
        
        // Очистка Canvas
        this.maskCanvas.width = 0;
        this.maskCanvas.height = 0;
      }

      this.isLoaded = true;

      // 3. Сканируем берег
      const shorePoints = this.getShorelinePoints();
      this.shoreEffects.initShoreline(shorePoints);
      this.openWaterEffects.init(shorePoints);

    } catch (error) {
      console.error('WorldMap: Ошибка при загрузке ассетов:', error);
    }
  }

  /**
   * Улучшенный алгоритм сканирования берега на основе детекции контраста
   */
  public getShorelinePoints(): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    
    if (!this.maskData) return points;

    const maskW = this.maskData.width;
    const maskH = this.maskData.height;
    const data = this.maskData.data;

    // Шаг сканирования по высоте маски (~100-150 точек по всей длине)
    const stepY = Math.max(2, Math.floor(maskH / 150)); 
    // Шаг сканирования по ширине маски для высокой точности
    const stepX = 2; 

    for (let py = 0; py < maskH; py += stepY) {
      let foundShoreX = -1;

      // Сканируем с правой границы (суша) налево (в сторону океана)
      for (let px = maskW - 1; px >= stepX; px -= stepX) {
        const currIndex = (py * maskW + px) * 4;
        const prevIndex = (py * maskW + (px - stepX)) * 4;

        const r1 = data[currIndex];
        const g1 = data[currIndex + 1];
        const b1 = data[currIndex + 2];

        const r2 = data[prevIndex];
        const g2 = data[prevIndex + 1];
        const b2 = data[prevIndex + 2];

        // Расчет контраста между соседними пикселями
        const colorDelta = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

        // Перепад контраста > 35 сигнализирует о переходе границы зон (песок -> вода)
        if (colorDelta > 35) {
          foundShoreX = px;
          break;
        }
      }

      // Перевод пиксельных координат маски в мировые координаты PixiJS (8000x8000)
      if (foundShoreX !== -1) {
        const worldX = (foundShoreX / maskW) * this.worldWidth;
        const worldY = (py / maskH) * this.worldHeight;
        points.push({ x: worldX, y: worldY });
      }
    }

    return points;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private colorDistance(hex1: string, hex2: string): number {
    const r1 = parseInt(hex1.substring(1, 3), 16);
    const g1 = parseInt(hex1.substring(3, 5), 16);
    const b1 = parseInt(hex1.substring(5, 7), 16);

    const r2 = parseInt(hex2.substring(1, 3), 16);
    const g2 = parseInt(hex2.substring(3, 5), 16);
    const b2 = parseInt(hex2.substring(5, 7), 16);

    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  public getZoneAt(worldX: number, worldY: number): ZoneConfig {
    if (!this.isLoaded || !this.maskData) {
      return OCEAN_ZONES_CONFIG[0]; 
    }

    const normalizedX = Math.max(0, Math.min(1, worldX / this.worldWidth));
    const normalizedY = Math.max(0, Math.min(1, worldY / this.worldHeight));

    const pixelX = Math.floor(normalizedX * (this.maskData.width - 1));
    const pixelY = Math.floor(normalizedY * (this.maskData.height - 1));

    const index = (pixelY * this.maskData.width + pixelX) * 4;
    const r = this.maskData.data[index];
    const g = this.maskData.data[index + 1];
    const b = this.maskData.data[index + 2];

    const sampledHex = this.rgbToHex(r, g, b);

    if (this.colorDistance(sampledHex, LAND_ZONE_CONFIG.hexColor) < 80) {
      return LAND_ZONE_CONFIG;
    }

    let closestZone = OCEAN_ZONES_CONFIG[0];
    let minDistance = Infinity;

    for (const zone of OCEAN_ZONES_CONFIG) {
      const dist = this.colorDistance(sampledHex, zone.hexColor);
      if (dist < minDistance) {
        minDistance = dist;
        closestZone = zone;
      }
    }

    return closestZone;
  }

  public update(deltaSeconds: number): void {
    if (!this.isLoaded) return;
    this.openWaterEffects.update(deltaSeconds);
    this.shoreEffects.update(deltaSeconds);
  }

  public updateTimeState(_hours: number): void {}
}
