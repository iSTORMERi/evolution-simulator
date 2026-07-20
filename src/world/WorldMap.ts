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

    // 1. Суша (Песок)
    graphics.beginFill(0xd0b485);
    graphics.drawRect(0, 0, this.width, this.height);
    graphics.endFill();

    // Слои глубины океана (от абиссали до прибрежной зоны)
    const oceanZones = [
      { color: 0x051a30, widthFactor: 1.00 }, // Самая глубокая бездна
      { color: 0x0a3254, widthFactor: 0.82 },
      { color: 0x0f5278, widthFactor: 0.62 },
      { color: 0x187891, widthFactor: 0.40 },
      { color: 0x22a89d, widthFactor: 0.18 }, // Бирюзовое мелководье
    ];

    // Отрисовка с высоким шагом детализации (stepY = 10) для идеальной гладкости
    for (const zone of oceanZones) {
      graphics.beginFill(zone.color);
      
      const zoneMaxX = coastX * zone.widthFactor;
      const stepY = 10; 

      graphics.moveTo(0, 0);
      for (let y = 0; y <= this.height; y += stepY) {
        // Плавная органическая волна берега
        const wave = Math.sin(y * 0.0015) * 220 + Math.cos(y * 0.0035) * 110;
        const x = zoneMaxX + wave * zone.widthFactor;
        graphics.lineTo(x, y);
      }

      graphics.lineTo(0, this.height);
      graphics.closePath();
      graphics.endFill();
    }

    this.container.addChild(graphics);
  }
}
