import * as PIXI from 'pixi.js';

export class WaterEffectsController {
  public container: PIXI.Container;

  private coastalFoamGraphics: PIXI.Graphics;
  private mapWidth: number;
  private mapHeight: number;
  private coastalRatio: number;

  private animTime = 0;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.coastalRatio = coastalRatio;

    this.container = new PIXI.Container();
    this.coastalFoamGraphics = new PIXI.Graphics();
    
    this.container.addChild(this.coastalFoamGraphics);
  }

  public updateTimeState(_hours: number): void {
    // Вся цветовая гамма и переходы света управляются через LightingController
  }

  public update(deltaSeconds: number): void {
    this.animTime += deltaSeconds;

    // Мягкий прибой пены вдоль гладкого берега
    const coastX = this.mapWidth * this.coastalRatio;
    const waveOffset = (Math.sin(this.animTime * 1.5) + 1) * 10;

    this.coastalFoamGraphics.clear();
    this.coastalFoamGraphics.beginFill(0xffffff, 0.22);

    const stepY = 15;
    const widthFactor = 0.18; // Вдоль линии прибрежной бирюзы

    this.coastalFoamGraphics.moveTo(0, 0);
    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const wave = Math.sin(y * 0.0015) * 220 + Math.cos(y * 0.0035) * 110;
      const x = (coastX * widthFactor) + wave * widthFactor + waveOffset;
      this.coastalFoamGraphics.lineTo(x, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const wave = Math.sin(y * 0.0015) * 220 + Math.cos(y * 0.0035) * 110;
      const x = (coastX * widthFactor) + wave * widthFactor - 12;
      this.coastalFoamGraphics.lineTo(x, y);
    }

    this.coastalFoamGraphics.closePath();
    this.coastalFoamGraphics.endFill();
  }
}
