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

    // 1. Слой мокрого песка (рисуется снизу)
    this.wetSandGraphics = new PIXI.Graphics();
    // 2. Слой пены и прибоя (рисуется поверх)
    this.foamGraphics = new PIXI.Graphics();

    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.foamGraphics);
  }

  // Расчет изгиба береговой линии (точно повторяет форму из WorldMap)
  private getCoastlineX(y: number): number {
    const baseOceanWidth = this.mapWidth * this.coastalRatio;
    const wave1 = Math.sin(y * 0.0002) * 600;
    const wave2 = Math.cos(y * 0.0006) * 300;
    const wave3 = Math.sin(y * 0.0015) * 120;

    return baseOceanWidth + wave1 + wave2 + wave3;
  }

  public updateTimeState(_hours: number): void {
    // В будущем здесь можно менять прозрачность или цвет пены в зависимости от времени суток
  }

  public update(deltaSeconds: number): void {
    this.animTime += deltaSeconds;

    // Фаза движения прибоя (несимметричная волна: резкий накат, плавный откат)
    const wavePhase = (Math.sin(this.animTime * 1.6) + 1) / 2; // 0.0 -> 1.0
    const waveReach = Math.pow(wavePhase, 0.75) * 50; // Накат до 50px на песок

    // Эффект инерции для мокрого песка (он сохнет с небольшим отставанием от волны)
    const wetLag = (Math.sin(this.animTime * 1.6 - 0.5) + 1) / 2;
    const wetReach = Math.max(waveReach, wetLag * 25);

    this.renderWetSand(wetReach);
    this.renderFoam(waveReach);
  }

  private renderWetSand(wetReach: number): void {
    this.wetSandGraphics.clear();
    // Насыщенный темно-песочный цвет с мягкой прозрачностью
    this.wetSandGraphics.beginFill(0x8a724d, 0.40);

    const stepY = 25; // Оптимальный шаг отрисовки для производительности

    this.wetSandGraphics.moveTo(this.getCoastlineX(0) + wetReach, 0);

    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const baseX = this.getCoastlineX(y);
      this.wetSandGraphics.lineTo(baseX + wetReach, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const baseX = this.getCoastlineX(y);
      this.wetSandGraphics.lineTo(baseX - 20, y);
    }

    this.wetSandGraphics.closePath();
    this.wetSandGraphics.endFill();
  }

  private renderFoam(waveReach: number): void {
    this.foamGraphics.clear();

    const stepY = 15;

    // --- 1. Основная густая пена на гребне прибоя ---
    this.foamGraphics.beginFill(0xffffff, 0.60);
    this.foamGraphics.moveTo(this.getCoastlineX(0), 0);

    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const baseX = this.getCoastlineX(y);
      // Небольшая динамическая микро-рябь на краю волны
      const ripple = Math.sin(y * 0.04 + this.animTime * 4) * 5;
      this.foamGraphics.lineTo(baseX + waveReach + ripple, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const baseX = this.getCoastlineX(y);
      const foamThickness = 14 + Math.cos(y * 0.02) * 6;
      this.foamGraphics.lineTo(baseX + waveReach - foamThickness, y);
    }

    this.foamGraphics.closePath();
    this.foamGraphics.endFill();

    // --- 2. Вторичная тонкая кружевная нить пены при откате ---
    if (waveReach > 10) {
      this.foamGraphics.beginFill(0xd0f8ff, 0.35);
      const trailOffset = waveReach * 0.45;

      this.foamGraphics.moveTo(this.getCoastlineX(0), 0);
      for (let y = 0; y <= this.mapHeight; y += stepY) {
        const baseX = this.getCoastlineX(y);
        this.foamGraphics.lineTo(baseX + trailOffset, y);
      }

      for (let y = this.mapHeight; y >= 0; y -= stepY) {
        const baseX = this.getCoastlineX(y);
        this.foamGraphics.lineTo(baseX + trailOffset - 7, y);
      }

      this.foamGraphics.closePath();
      this.foamGraphics.endFill();
    }
  }
}
