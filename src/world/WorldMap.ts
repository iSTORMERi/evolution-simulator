import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_COLOR } from './zoneConfig';

export class WorldMap {
  public container: PIXI.Container;
  private width: number;
  private height: number;
  private oceanWidthRatio: number;

  constructor(width: number, height: number, oceanWidthRatio: number = 0.65) {
    this.container = new PIXI.Container();
    this.width = width;
    this.height = height;
    this.oceanWidthRatio = oceanWidthRatio;

    this.renderMap();
  }

  private renderMap(): void {
    this.container.removeChildren();

    const oceanTotalWidth = this.width * this.oceanWidthRatio;
    let currentX = 0;

    // 1. Отрисовка океанических зон
    OCEAN_ZONES_CONFIG.forEach((zone) => {
      const zoneWidth = oceanTotalWidth * zone.widthRatio;
      
      const graphics = new PIXI.Graphics();
      graphics.beginFill(zone.color);
      graphics.drawRect(currentX, 0, zoneWidth, this.height);
      graphics.endFill();

      this.container.addChild(graphics);

      currentX += zoneWidth;
    });

    // 2. Отрисовка суши
    const landWidth = this.width - oceanTotalWidth;
    const landGraphics = new PIXI.Graphics();
    landGraphics.beginFill(LAND_COLOR);
    landGraphics.drawRect(oceanTotalWidth, 0, landWidth, this.height);
    landGraphics.endFill();

    this.container.addChild(landGraphics);
  }

  // Метод автоматического подгона карты под размер экрана
  public fitToScreen(screenWidth: number, screenHeight: number): void {
    const scaleX = screenWidth / this.width;
    const scaleY = screenHeight / this.height;
    // Масштабируем карту, чтобы она целиком влезала в экран устройства
    const scale = Math.min(scaleX, scaleY);
    
    this.container.scale.set(scale);
    // Центрируем
    this.container.x = (screenWidth - this.width * scale) / 2;
    this.container.y = (screenHeight - this.height * scale) / 2;
  }
}
