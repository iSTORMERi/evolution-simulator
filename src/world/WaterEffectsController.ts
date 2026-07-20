import * as PIXI from 'pixi.js';

export class WaterEffectsController {
  public container: PIXI.Container;

  private wetSandGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;

  private mapWidth: number;
  private mapHeight: number;
  private coastalRatio: number;

  private animTime = 0;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.coastalRatio = coastalRatio;

    this.container = new PIXI.Container();

    // 1. Мокрый песок
    this.wetSandGraphics = new PIXI.Graphics();
    // 2. Эпическая пена
    this.foamGraphics = new PIXI.Graphics();

    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.foamGraphics);
  }

  private getCoastlineX(y: number): number {
    const baseOceanWidth = this.mapWidth * this.coastalRatio;
    const wave1 = Math.sin(y * 0.0002) * 600;
    const wave2 = Math.cos(y * 0.0006) * 300;
    const wave3 = Math.sin(y * 0.0015) * 120;

    return baseOceanWidth + wave1 + wave2 + wave3;
  }

  public updateTimeState(_hours: number): void {}

  public update(deltaSeconds: number): void {
    this.animTime += deltaSeconds;

    // Увеличили амплитуду наката до 220px (было 50px)
    const wavePhase = (Math.sin(this.animTime * 1.4) + 1) / 2;
    const waveReach = Math.pow(wavePhase, 0.75) * 220; 

    // Мокрый след накрывает берег еще шире (до 260px)
    const wetLag = (Math.sin(this.animTime * 1.4 - 0.4) + 1) / 2;
    const wetReach = Math.max(waveReach, wetLag * 260);

    this.renderWetSand(wetReach);
    this.renderFoam(waveReach);
  }

  private renderWetSand(wetReach: number): void {
    this.wetSandGraphics.clear();
    // Насыщенная широкая полоса намокшего песка
    this.wetSandGraphics.beginFill(0x8a724d, 0.45);

    const stepY = 30; // Чуть больше шаг для оптимального рендера массивной фигуры

    this.wetSandGraphics.moveTo(this.getCoastlineX(0) + wetReach, 0);

    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const baseX = this.getCoastlineX(y);
      this.wetSandGraphics.lineTo(baseX + wetReach, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const baseX = this.getCoastlineX(y);
      // Заходим под воду чуть глубже для плавности
      this.wetSandGraphics.lineTo(baseX - 80, y);
    }

    this.wetSandGraphics.closePath();
    this.wetSandGraphics.endFill();
  }

  private renderFoam(waveReach: number): void {
    this.foamGraphics.clear();

    const stepY = 20;

    // --- 1. Основной мощный массив пены ---
    this.foamGraphics.beginFill(0xffffff, 0.65);
    this.foamGraphics.moveTo(this.getCoastlineX(0), 0);

    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const baseX = this.getCoastlineX(y);
      // Масштабные зазубрены на волне
      const ripple = Math.sin(y * 0.015 + this.animTime * 3) * 25;
      this.foamGraphics.lineTo(baseX + waveReach + ripple, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const baseX = this.getCoastlineX(y);
      // Толщина шлейфа пены увеличилась до 50-80px
      const foamThickness = 50 + Math.cos(y * 0.008) * 30;
      this.foamGraphics.lineTo(baseX + waveReach - foamThickness, y);
    }

    this.foamGraphics.closePath();
    this.foamGraphics.endFill();

    // --- 2. Вторичная широкая кружевная полоса ---
    if (waveReach > 30) {
      this.foamGraphics.beginFill(0xd0f8ff, 0.40);
      const trailOffset = waveReach * 0.55;

      this.foamGraphics.moveTo(this.getCoastlineX(0), 0);
      for (let y = 0; y <= this.mapHeight; y += stepY) {
        const baseX = this.getCoastlineX(y);
        const trailRipple = Math.cos(y * 0.02 + this.animTime * 2) * 15;
        this.foamGraphics.lineTo(baseX + trailOffset + trailRipple, y);
      }

      for (let y = this.mapHeight; y >= 0; y -= stepY) {
        const baseX = this.getCoastlineX(y);
        this.foamGraphics.lineTo(baseX + trailOffset - 35, y);
      }

      this.foamGraphics.closePath();
      this.foamGraphics.endFill();
    }
  }
}
