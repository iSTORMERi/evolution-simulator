import * as PIXI from 'pixi.js';

export class WorldMap {
  public container: PIXI.Container;
  private width: number;
  private height: number;
  private coastalRatio: number;

  constructor(width: number, height: number, coastalRatio: number = 0.50) {
    this.width = width;
    this.height = height;
    this.coastalRatio = coastalRatio;

    this.container = new PIXI.Container();
    this.generateMap();
  }

  private generateMap(): void {
    const graphics = new PIXI.Graphics();
    const coastX = this.width * this.coastalRatio;

    // 1. Базовый суша (Песок)
    graphics.beginFill(0xd2b48c); // Натуральный песчаный цвет
    graphics.drawRect(0, 0, this.width, this.height);
    graphics.endFill();

    // === ГРАДИЕНТНЫЕ СЛОИ ОКЕАНА ===
    // Цвета зон глубины:
    // Abyssal (Бездна) -> Bathyal (Глубоководная) -> Neritic (Мелководье) -> Littoral (Прибрежная)
    const oceanZones = [
      { color: 0x031024, widthFactor: 1.00 }, // Абиссаль (Темный глубокий океан)
      { color: 0x082545, widthFactor: 0.85 }, // Батиаль
      { color: 0x0d4b75, widthFactor: 0.65 }, // Неритик
      { color: 0x148396, widthFactor: 0.40 }, // Мелководная бирюза
      { color: 0x20b2aa, widthFactor: 0.15 }, // Прибрежная волна
    ];

    // Рисуем слои с органическим изгибом береговой линии
    for (const zone of oceanZones) {
      graphics.beginFill(zone.color);
      
      const zoneMaxX = coastX * zone.widthFactor;
      const stepY = 80;

      graphics.moveTo(0, 0);
      for (let y = 0; y <= this.height; y += stepY) {
        // Волнистая линия берега с несколькими гармониками шумности
        const wave = Math.sin(y * 0.003) * 120 + Math.cos(y * 0.008) * 60;
        const x = (zoneMaxX + wave * zone.widthFactor);
        graphics.lineTo(x, y);
      }

      graphics.lineTo(0, this.height);
      graphics.closePath();
      graphics.endFill();
    }

    this.container.addChild(graphics);
  }
}
