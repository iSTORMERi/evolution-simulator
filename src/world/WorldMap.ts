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

  // Модули спецэффектов воды
  private shoreEffects: ShoreEffects;
  private openWaterEffects: OpenWaterEffects;

  constructor(width: number, height: number) {
    this.container = new PIXI.Container();
    this.worldWidth = width;
    this.worldHeight = height;

    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    // Инициализация спецэффектов воды
    this.shoreEffects = new ShoreEffects();
    this.openWaterEffects = new OpenWaterEffects();

    this.initMap();
  }

  /**
   * Загрузка ассетов визуальной карты и маски зон
   */
  private async initMap(): Promise<void> {
    try {
      // 1. Загрузка визуальной текстуры
      const visualTexture = await PIXI.Assets.load('assets/ocean_visual.png');
      this.mapSprite = new PIXI.Sprite(visualTexture);
      this.mapSprite.width = this.worldWidth;
      this.mapSprite.height = this.worldHeight;
      this.container.addChild(this.mapSprite);

      // Добавляем эффекты воды поверх картинки карты
      this.container.addChild(this.openWaterEffects.container);
      this.container.addChild(this.shoreEffects.container);

      // 2. Безопасная загрузка маски зон через PixiJS
      const maskTexture = await PIXI.Assets.load('assets/ocean_zones_mask.png');
      const maskSource = maskTexture.source.resource as HTMLImageElement | HTMLCanvasElement;

      this.maskCanvas.width = maskTexture.width;
      this.maskCanvas.height = maskTexture.height;

      if (this.maskCtx) {
        this.maskCtx.drawImage(maskSource, 0, 0);
        
        // Считываем сырой массив пикселей
        this.maskData = this.maskCtx.getImageData(
          0, 
          0, 
          this.maskCanvas.width, 
          this.maskCanvas.height
        );

        // 🧹 Очистка памяти для предотвращения падений Safari на мобильных устройствах
        this.maskCanvas.width = 0;
        this.maskCanvas.height = 0;
        this.maskCtx = null;
      }

      this.isLoaded = true;

      // Автоматическое определение береговой линии и инициализация эффектов
      const shorePoints = this.getShorelinePoints();
      this.shoreEffects.initShoreline(shorePoints);
      this.openWaterEffects.init(shorePoints);

      console.log(`WorldMap: Карта и эффекты загружены. Найдено точек берега: ${shorePoints.length}`);

    } catch (error) {
      console.error('WorldMap: Ошибка при загрузке карт из assets/:', error);
    }
  }

  /**
   * Сканирование маски для автоматического построения координат береговой линии
   */
  public getShorelinePoints(): { x: number; y: number }[] {
    if (!this.maskData) return [];

    const points: { x: number; y: number }[] = [];
    const stepY = 25; // Шаг сканирования по высоте (чем меньше, тем точнее повторяется изгиб)

    for (let y = 0; y < this.worldHeight; y += stepY) {
      // Ищем границу перехода от суши к воде справа налево
      for (let x = this.worldWidth; x >= 0; x -= 15) {
        const zone = this.getZoneAt(x, y);
        if (zone.id !== LAND_ZONE_CONFIG.id) {
          points.push({ x, y });
          break;
        }
      }
    }

    return points;
  }

  /**
   * Преобразование RGB в HEX-строку вида "#rrggbb"
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Вычисление расстояния между двумя цветами
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
   * Определение зоны и её параметров по игровой координате (X, Y)
   */
  public getZoneAt(worldX: number, worldY: number): ZoneConfig {
    if (!this.isLoaded || !this.maskData) {
      return OCEAN_ZONES_CONFIG[0]; // Возвращаем дефолтную зону до загрузки
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

  public update(deltaSeconds: number): void {
    if (!this.isLoaded) return;

    // Обновляем анимацию волн и прибоя на каждом кадре
    this.openWaterEffects.update(deltaSeconds);
    this.shoreEffects.update(deltaSeconds);
  }

  public updateTimeState(_hours: number): void {
    // Резерв для эффектов смены дня и ночи
  }
}
