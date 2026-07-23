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

      // 3. Сканируем берег и сглаживаем его
      const shorePoints = this.getShorelinePoints();
      this.shoreEffects.initShoreline(shorePoints);
      this.openWaterEffects.init(shorePoints);

    } catch (error) {
      console.error('WorldMap: Ошибка при загрузке ассетов:', error);
    }
  }

  /**
   * Сглаживание ломаной линии (Алгоритм обрезки углов Чайкина)
   */
  private smoothLine(points: { x: number; y: number }[], iterations: number = 3): { x: number; y: number }[] {
    if (points.length < 3) return points;

    let currentPoints = points;

    for (let i = 0; i < iterations; i++) {
      const newPoints: { x: number; y: number }[] = [];
      
      // Сохраняем первую точку
      newPoints.push(currentPoints[0]);

      for (let j = 0; j < currentPoints.length - 1; j++) {
        const p0 = currentPoints[j];
        const p1 = currentPoints[j + 1];

        // Создаем две новые точки на 25% и 75% отрезка
        const q = {
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y
        };
        const r = {
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y
        };

        newPoints.push(q);
        newPoints.push(r);
      }

      // Сохраняем последнюю точку
      newPoints.push(currentPoints[currentPoints.length - 1]);
      currentPoints = newPoints;
    }

    return currentPoints;
  }

  public getShorelinePoints(): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    
    if (!this.maskData) return points;

    const maskW = this.maskData.width;
    const maskH = this.maskData.height;
    const data = this.maskData.data;

    // Шаг сканирования по высоте маски (~150 точек для хорошей детализации)
    const stepY = Math.max(2, Math.floor(maskH / 150)); 
    const stepX = 2; 

    for (let py = 0; py < maskH; py += stepY) {
      let foundShoreX = -1;

      // Сканируем с правой границы (суша) налево (в сторону океана)
      for (let px = maskW - 1; px >= 0; px -= stepX) {
        const index = (py * maskW + px) * 4;
        
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        // Детектор воды: синий канал должен заметно преобладать над красным
        // Песок имеет много красного/зеленого, вода - синего.
        if (b > r + 20) {
          foundShoreX = px;
          break;
        }
      }

      if (foundShoreX !== -1) {
        // Смещаем координату немного влево (-5 пикселей маски), 
        // чтобы линия гарантированно находилась в воде
        const waterOffsetX = Math.max(0, foundShoreX - 5);
        
        const worldX = (waterOffsetX / maskW) * this.worldWidth;
        const worldY = (py / maskH) * this.worldHeight;
        points.push({ x: worldX, y: worldY });
      }
    }

    // Возвращаем сглаженный массив точек
    return this.smoothLine(points, 4);
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
