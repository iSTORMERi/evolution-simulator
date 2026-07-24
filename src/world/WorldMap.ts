// src/world/WorldMap.ts

import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from './zoneConfig';
import { ZoneConfig } from './types';
import { ShoreEffects, Waves } from './water';

export class WorldMap {
  public container: PIXI.Container;

  private worldWidth: number;
  private worldHeight: number;

  private mapSprite?: PIXI.Sprite;
  
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D | null;
  private maskData?: ImageData;

  // Canvas, CanvasSource и спрайт для подсвечивающего оверлея
  private highlightCanvas: HTMLCanvasElement;
  private highlightCtx: CanvasRenderingContext2D | null;
  private highlightCanvasSource?: PIXI.CanvasSource;
  private highlightSprite?: PIXI.Sprite;

  private isLoaded: boolean = false;

  private shoreEffects: ShoreEffects;
  private waves: Waves;

  private targetMarker: PIXI.Graphics;
  
  // Кэш для цвета подсветки, если клик произошел до загрузки ассетов
  private pendingHighlightColor: string | null = null;

  constructor(width: number, height: number) {
    this.container = new PIXI.Container();
    this.worldWidth = width;
    this.worldHeight = height;

    // Контекст для маски (определение биомов)
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    // Контекст для рисования подсвечивающей заливки
    this.highlightCanvas = document.createElement('canvas');
    this.highlightCtx = this.highlightCanvas.getContext('2d');

    this.shoreEffects = new ShoreEffects();
    this.waves = new Waves();

    this.targetMarker = new PIXI.Graphics();
    this.targetMarker.visible = false;

    this.initMap();
  }

  private async initMap(): Promise<void> {
    try {
      // 1. Загрузка визуальной карты
      const visualTexture = await PIXI.Assets.load('assets/ocean_visual.png');
      this.mapSprite = new PIXI.Sprite(visualTexture);
      this.mapSprite.width = this.worldWidth;
      this.mapSprite.height = this.worldHeight;
      this.container.addChild(this.mapSprite);

      // 2. Создаем CanvasSource и спрайт оверлея подсветки
      this.highlightCanvasSource = new PIXI.CanvasSource({ resource: this.highlightCanvas });
      const highlightTexture = new PIXI.Texture({ source: this.highlightCanvasSource });

      this.highlightSprite = new PIXI.Sprite(highlightTexture);
      this.highlightSprite.width = this.worldWidth;
      this.highlightSprite.height = this.worldHeight;
      this.container.addChild(this.highlightSprite);

      // 3. Слои берега, волн и маркера
      this.container.addChild(this.shoreEffects.container);
      this.container.addChild(this.waves.container);

      this.initTargetMarker();
      this.container.addChild(this.targetMarker);

      // 4. Загрузка маски биомов
      const img = new Image();
      img.src = 'assets/ocean_zones_mask.png';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Mask image not found'));
      });

      this.maskCanvas.width = img.width;
      this.maskCanvas.height = img.height;

      this.highlightCanvas.width = img.width;
      this.highlightCanvas.height = img.height;

      if (this.maskCtx) {
        this.maskCtx.drawImage(img, 0, 0);
        this.maskData = this.maskCtx.getImageData(0, 0, img.width, img.height);
      }

      this.isLoaded = true;

      // Применяем отложенную подсветку, если пользователь тапал во время загрузки
      if (this.pendingHighlightColor !== null) {
        this.applyHighlightOverlay(this.pendingHighlightColor);
      }

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

    g.circle(0, 2, 14);
    g.fill({ color: 0x000000, alpha: 0.35 });

    g.circle(0, 0, 13);
    g.fill({ color: 0xE65100, alpha: 1.0 });
  }

  /**
   * Подсветка зоны и установка точки прицела
   */
  public highlightZone(hexColor: string | null, worldX?: number, worldY?: number): void {
    this.pendingHighlightColor = hexColor;

    if (this.isLoaded) {
      this.applyHighlightOverlay(hexColor);
    }

    if (hexColor && worldX !== undefined && worldY !== undefined) {
      this.targetMarker.position.set(worldX, worldY);
      this.targetMarker.visible = true;
    } else {
      this.targetMarker.visible = false;
    }
  }

  /**
   * Генерация подсвечивающего оверлея через Canvas 2D с синхронизацией GPU
   */
  private applyHighlightOverlay(hexColor: string | null): void {
    if (!this.highlightCtx || !this.maskData || !this.highlightSprite) return;

    const w = this.maskCanvas.width;
    const h = this.maskCanvas.height;

    // Сброс предыдущей заливки
    this.highlightCtx.clearRect(0, 0, w, h);

    if (!hexColor) {
      this.highlightCanvasSource?.update();
      return;
    }

    const cleanHex = hexColor.replace('#', '');
    const targetR = parseInt(cleanHex.substring(0, 2), 16);
    const targetG = parseInt(cleanHex.substring(2, 4), 16);
    const targetB = parseInt(cleanHex.substring(4, 6), 16);

    const maskPixels = this.maskData.data;
    const overlayImgData = this.highlightCtx.createImageData(w, h);
    const overlayPixels = overlayImgData.data;

    // Оптимальный допуск (35), сглаживающий неточности HEX в zoneConfig,
    // но при этом чётко разделяющий соседние зоны
    const COLOR_TOLERANCE = 35;

    // Закрашиваем совпавшие пиксели неоново-бирюзовым цветом с полупрозрачностью
    for (let i = 0; i < maskPixels.length; i += 4) {
      const r = maskPixels[i];
      const g = maskPixels[i + 1];
      const b = maskPixels[i + 2];

      const dist = Math.sqrt((r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2);

      if (dist < COLOR_TOLERANCE) {
        overlayPixels[i]     = 0;   // R
        overlayPixels[i + 1] = 220; // G (Сочная бирюза)
        overlayPixels[i + 2] = 255; // B
        overlayPixels[i + 3] = 110; // Alpha (~43% прозрачности)
      }
    }

    this.highlightCtx.putImageData(overlayImgData, 0, 0);

    // Вызываем update(), чтобы заставить PixiJS перегрузить Canvas в видеопамять
    this.highlightCanvasSource?.update();
  }

  private smoothLine(points: { x: number; y: number }[], iterations: number = 3): { x: number; y: number }[] {
    if (points.length < 3) return points;

    let currentPoints = points;

    for (let i = 0; i < iterations; i++) {
      const newPoints: { x: number; y: number }[] = [];
      newPoints.push(currentPoints[0]);

      for (let j = 0; j < currentPoints.length - 1; j++) {
        const p0 = currentPoints[j];
        const p1 = currentPoints[j + 1];

        const q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
        const r = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };

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

    const stepY = Math.max(2, Math.floor(maskH / 150)); 
    const stepX = 2; 

    for (let py = 0; py < maskH; py += stepY) {
      let foundShoreX = -1;

      for (let px = maskW - 1; px >= 0; px -= stepX) {
        const index = (py * maskW + px) * 4;
        const r = data[index];
        const b = data[index + 2];

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
    const first = rawPoints[0];
    const second = rawPoints[1];
    const topDirX = first.x - second.x;
    const topDirY = first.y - second.y;
    const topLen = Math.hypot(topDirX, topDirY) || 1;
    
    const extendedTop = {
      x: first.x + (topDirX / topLen) * margin,
      y: first.y - margin,
    };

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
