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

  public getShorelinePoints(): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const stepY = 25; 
    
    if (this.maskData) {
      for (let y = 0; y < this.worldHeight; y += stepY) {
        let foundLand = false;
        // Сканируем справа налево
        for (let x = this.worldWidth; x >= 0; x -= 15) {
          const zone = this.getZoneAt(x, y);
          
          if (zone.id === LAND_ZONE_CONFIG.id) {
            foundLand = true; // Подтверждаем, что нашли сушу
          } else if (foundLand) {
            // Как только после суши встретили воду - ставим точку берега
            points.push({ x, y });
            break;
          }
        }
      }
    }

    // 🔥 ПРЕДОХРАНИТЕЛЬ: Если маска не сработала, рисуем тестовую линию, 
    // чтобы ты точно увидел работу эффектов на экране
    if (points.length < 5) {
      console.warn('WorldMap: Берег по маске не найден! Рисуем тестовую линию берега.');
      for (let y = 0; y < this.worldHeight; y += stepY) {
        // Примерно повторяем изгиб твоего берега со скриншота (около 75% экрана по ширине)
        const fakeX = this.worldWidth * 0.75 + Math.sin(y * 0.001) * 300;
        points.push({ x: fakeX, y });
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

    // Увеличили допуск погрешности цветов с 30 до 80 на случай артефактов сжатия png
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
