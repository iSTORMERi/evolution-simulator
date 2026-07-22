// src/world/WorldMap.ts

import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from './zoneConfig';
import { ZoneConfig } from './types';

export class WorldMap {
  public container: PIXI.Container;

  private worldWidth: number;
  private worldHeight: number;

  private mapSprite?: PIXI.Sprite;
  
  // Canvas в памяти для быстрой выборки пикселей из маски
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D | null;
  private maskData?: ImageData;

  private isLoaded: boolean = false;

  constructor(width: number, height: number) {
    this.container = new PIXI.Container();
    this.worldWidth = width;
    this.worldHeight = height;

    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    this.initMap();
  }

  /**
   * Загрузка ассетов визуальной карты и маски зон
   */
  private async initMap(): Promise<void> {
    try {
      // 1. Загрузка визуальной текстуры
      const visualTexture = await PIXI.Assets.load('/assets/ocean_visual.jpeg');
      this.mapSprite = new PIXI.Sprite(visualTexture);
      this.mapSprite.width = this.worldWidth;
      this.mapSprite.height = this.worldHeight;
      this.container.addChild(this.mapSprite);

      // 2. Загрузка и подготовка маски зон для считывания координат
      const maskImage = new Image();
      maskImage.src = '/assets/ocean_zones_mask.png';
      
      await new Promise<void>((resolve, reject) => {
        maskImage.onload = () => resolve();
        maskImage.onerror = (err) => reject(err);
      });

      // Располагаем маску на фоновом Canvas
      this.maskCanvas.width = maskImage.naturalWidth;
      this.maskCanvas.height = maskImage.naturalHeight;

      if (this.maskCtx) {
        this.maskCtx.drawImage(maskImage, 0, 0);
        // Кешируем пиксельные данные для мгновенного доступа
        this.maskData = this.maskCtx.getImageData(
          0, 
          0, 
          this.maskCanvas.width, 
          this.maskCanvas.height
        );
      }

      this.isLoaded = true;
      console.log('WorldMap: Визуальная карта и маска зон успешно загружены.');

    } catch (error) {
      console.error('WorldMap: Ошибка при загрузке карт из /assets/:', error);
    }
  }

  /**
   * Преобразование RGB в HEX-строку вида "#rrggbb"
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Вычисление расстояния между двумя цветами (для допуска по погрешности сжатия)
   */
  private colorDistance(hex1: string, hex2: string): number {
    const r1 = parseInt(hex1.substring(1, 3), 16);
    const g1 = parseInt(hex1.substring(3, 5), 16);
    const b1 = parseInt(hex1.substring(5, 7), 16);

    const r2 = parseInt(hex2.substring(1, 3), 16);
    const g2 = parseInt(hex2.substring(3, 5), 16);
    const b2 = parseInt(hex2.substring(5, 7), 16);

    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  /**
   * Главная функция игры: Определение зоны и её параметров по игровой координате (X, Y)
   */
  public getZoneAt(worldX: number, worldY: number): ZoneConfig {
    if (!this.isLoaded || !this.maskData) {
      return OCEAN_ZONES_CONFIG[0]; // Возвращаем дефолтную зону до загрузки
    }

    // Перевод мировых координат в координаты пикселей маски
    const normalizedX = Math.max(0, Math.min(1, worldX / this.worldWidth));
    const normalizedY = Math.max(0, Math.min(1, worldY / this.worldHeight));

    const pixelX = Math.floor(normalizedX * (this.maskCanvas.width - 1));
    const pixelY = Math.floor(normalizedY * (this.maskCanvas.height - 1));

    // Считывание RGBA пикселя
    const index = (pixelY * this.maskCanvas.width + pixelX) * 4;
    const r = this.maskData.data[index];
    const g = this.maskData.data[index + 1];
    const b = this.maskData.data[index + 2];

    const sampledHex = this.rgbToHex(r, g, b);

    // 1. Проверяем совпадение с сушей
    if (this.colorDistance(sampledHex, LAND_ZONE_CONFIG.hexColor) < 30) {
      return LAND_ZONE_CONFIG;
    }

    // 2. Ищем наиболее близкую зону океана
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

  public update(_deltaSeconds: number): void {
    // Здесь можно вызывать обновленя анимаций, если они понадобятся
  }

  public updateTimeState(_hours: number): void {
    // Логика смены времени суток/освещения при необходимости
  }
}
