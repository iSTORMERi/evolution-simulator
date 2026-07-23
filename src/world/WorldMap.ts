// src/world/WorldMap.ts

import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from './zoneConfig';
import { ZoneConfig } from './types';
import { ShoreEffects, Waves } from './water';
import { BiomeHighlightFilter } from './BiomeHighlightFilter';

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
  private waves: Waves;

  // Поля для подсветки и маркера прицела
  private highlightFilter?: BiomeHighlightFilter;
  private targetMarker: PIXI.Graphics;

  constructor(width: number, height: number) {
    this.container = new PIXI.Container();
    this.worldWidth = width;
    this.worldHeight = height;

    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    this.shoreEffects = new ShoreEffects();
    this.waves = new Waves();

    // Создаем маркер точки тапа
    this.targetMarker = new PIXI.Graphics();
    this.targetMarker.visible = false;

    this.initMap();
  }

  private async initMap(): Promise<void> {
    try {
      // 1. Загрузка визуальной текстуры карты (PixiJS)
      const visualTexture = await PIXI.Assets.load('assets/ocean_visual.png');
      this.mapSprite = new PIXI.Sprite(visualTexture);
      this.mapSprite.width = this.worldWidth;
      this.mapSprite.height = this.worldHeight;
      this.container.addChild(this.mapSprite);

      // 2. Строгий порядок визуальных слоев:
      // Карта -> Береговые эффекты -> Волны поверх берега -> Прицел
      this.container.addChild(this.shoreEffects.container);
      this.container.addChild(this.waves.container);

      this.initTargetMarker();
      this.container.addChild(this.targetMarker);

      // 3. Загрузка маски через нативный HTML Image (абсолютная стабильность для чтения пикселей)
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
        // СОХРАНЯЕМ maskData и НЕ сбрасываем width/height холста!
        this.maskData = this.maskCtx.getImageData(0, 0, img.width, img.height);
        
        // 4. Безопасная инициализация шейдера подсветки
        try {
          const maskPixiTexture = PIXI.Texture.from(img);
          this.highlightFilter = new BiomeHighlightFilter(maskPixiTexture, img.width, img.height);
          this.mapSprite.filters = [this.highlightFilter];
        } catch (shaderError) {
          console.warn('WorldMap: Ошибка при инициализации шейдера подсветки (пропущено для сохранения эффектов):', shaderError);
        }
      }

      this.isLoaded = true;

      // 5. Построение берега и запуск эффектов волн и пены
      const shorePoints = this.getShorelinePoints();
      this.shoreEffects.initShoreline(shorePoints);
      this.waves.initShoreline(shorePoints);

    } catch (error) {
      console.error('WorldMap: Ошибка при загрузке ассетов:', error);
    }
  }

  private initTargetMarker(): void {
    const g = this.targetMarker;
    g.clear();
    
    // Внешнее светящееся кольцо
    g.circle(0, 0, 14);
    g.stroke({ width: 2, color: 0x38bdf8, alpha: 0.8 });
    
    // Внутренняя точка
    g.circle(0, 0, 5);
    g.fill({ color: 0x0ea5e9, alpha: 1.0 });
    
    // Прицел
    g.moveTo(-20, 0).lineTo(-8, 0);
    g.moveTo(8, 0).lineTo(20, 0);
    g.moveTo(0, -20).lineTo(0, -8);
    g.moveTo(0, 8).lineTo(0, 20);
    g.stroke({ width: 2, color: 0x38bdf8, alpha: 0.9 });
  }

  /**
   * Подсветка зоны и установка точки прицела
   */
  public highlightZone(hexColor: string | null, worldX?: number, worldY?: number): void {
    if (this.highlightFilter) {
      this.highlightFilter.setHighlightedZone(hexColor);
    }

    if (hexColor && worldX !== undefined && worldY !== undefined) {
      this.targetMarker.position.set(worldX, worldY);
      this.targetMarker.visible = true;
    } else {
      this.targetMarker.visible = false;
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
      
      newPoints.push(currentPoints[0]);

      for (let j = 0; j < currentPoints.length - 1; j++) {
        const p0 = currentPoints[j];
        const p1 = currentPoints[j + 1];

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

      newPoints.push(currentPoints[currentPoints.length - 1]);
      currentPoints = newPoints;
    }

    return currentPoints;
  }

  public getShorelinePoints(): { x: number; y: number }[] {
    const rawPoints: { x: number; y: number }[] = [];
    
    if (!this.maskData) return rawPoints;

    const maskW = this.maskData.width;
    const maskH = this.maskData.height;
    const data = this.maskData.data;

    // Шаг сканирования по высоте маски (~150 точек для детализации)
    const stepY = Math.max(2, Math.floor(maskH / 150)); 
    const stepX = 2; 

    for (let py = 0; py < maskH; py += stepY) {
      let foundShoreX = -1;

      // Сканируем с правой границы (суша) налево (в сторону океана)
      for (let px = maskW - 1; px >= 0; px -= stepX) {
        const index = (py * maskW + px) * 4;
        
        const r = data[index];
        const b = data[index + 2];

        // Детектор воды: синий канал преобладает над красным
        if (b > r + 20) {
          foundShoreX = px;
          break;
        }
      }

      if (foundShoreX !== -1) {
        const waterOffsetX = Math.max(0, foundShoreX - 5);
        
        const worldX = (waterOffsetX / maskW) * this.worldWidth;
        const worldY = (py / maskH) * this.worldHeight;
        rawPoints.push({ x: worldX, y: worldY });
      }
    }

    if (rawPoints.length < 2) return rawPoints;

    const margin = 250; 

    // Точка-продление наверх
    const first = rawPoints[0];
    const second = rawPoints[1];
    const topDirX = first.x - second.x;
    const topDirY = first.y - second.y;
    const topLen = Math.hypot(topDirX, topDirY) || 1;
    
    const extendedTop = {
      x: first.x + (topDirX / topLen) * margin,
      y: first.y - margin,
    };

    // Точка-продление вниз
    const last = rawPoints[rawPoints.length - 1];
    const prevLast = rawPoints[rawPoints.length - 2];
    const botDirX = last.x - prevLast.x;
    const botDirY = last.y - prevLast.y;
    const botLen = Math.hypot(botDirX, botDirY) || 1;

    const extendedBottom = {
      x: last.x + (botDirX / botLen) * margin,
      y: last.y + margin,
    };

    const extendedPoints = [extendedTop, ...rawPoints, extendedBottom];

    return this.smoothLine(extendedPoints, 4);
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
    this.waves.update(deltaSeconds);
    this.shoreEffects.update(deltaSeconds);
  }

  public updateTimeState(_hours: number): void {}
}
