import * as PIXI from 'pixi.js';

export class WaterEffectsController {
  public container: PIXI.Container;

  private wetSandGraphics: PIXI.Graphics;
  private seaWavesGraphics: PIXI.Graphics;
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

    // Слой 1: Мокрый песок
    this.wetSandGraphics = new PIXI.Graphics();
    // Слой 2: Накатывающие гребни волн в море
    this.seaWavesGraphics = new PIXI.Graphics();
    // Слой 3: Основная пена прибоя на береговой линии
    this.foamGraphics = new PIXI.Graphics();

    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.seaWavesGraphics);
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

    // 1. Динамика основного берегового прибоя
    const wavePhase = (Math.sin(this.animTime * 1.4) + 1) / 2;
    const waveReach = Math.pow(wavePhase, 0.75) * 220;

    const wetLag = (Math.sin(this.animTime * 1.4 - 0.4) + 1) / 2;
    const wetReach = Math.max(waveReach, wetLag * 260);

    // Отрисовка всех трех составляющих прибрежной зоны
    this.renderWetSand(wetReach);
    this.renderSeaWaves();
    this.renderFoam(waveReach);
  }

  private renderWetSand(wetReach: number): void {
    this.wetSandGraphics.clear();
    this.wetSandGraphics.beginFill(0x8a724d, 0.45);

    const stepY = 30;

    this.wetSandGraphics.moveTo(this.getCoastlineX(0) + wetReach, 0);

    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const baseX = this.getCoastlineX(y);
      this.wetSandGraphics.lineTo(baseX + wetReach, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const baseX = this.getCoastlineX(y);
      this.wetSandGraphics.lineTo(baseX - 80, y);
    }

    this.wetSandGraphics.closePath();
    this.wetSandGraphics.endFill();
  }

  private renderSeaWaves(): void {
    this.seaWavesGraphics.clear();

    const NUM_WAVES = 3; // Количество одновременно идущих гребней
    const stepY = 25;
    const waveSpeed = 0.22; // Скорость движения к берегу

    for (let i = 0; i < NUM_WAVES; i++) {
      // Циклический прогресс от 0.0 (глубоко в море) до 1.0 (у берега)
      const progress = (this.animTime * waveSpeed + i / NUM_WAVES) % 1.0;

      // Дистанция от берега: от -550px до +30px
      const offset = -550 * (1 - progress) + 30 * progress;

      // Прозрачность: волна зажигается в море и растворяется при разбивании
      const alpha = Math.sin(progress * Math.PI) * 0.42;

      // Толщина волны: вырастает от 10px до 40px на мелководье
      const thickness = 10 + progress * 30;

      if (alpha <= 0.01) continue;

      this.seaWavesGraphics.beginFill(0xe0ffff, alpha);
      this.seaWavesGraphics.moveTo(this.getCoastlineX(0) + offset, 0);

      // Фронтальная сторона волны (с эффектом ряби)
      for (let y = 0; y <= this.mapHeight; y += stepY) {
        const baseX = this.getCoastlineX(y);
        const ripple = Math.sin(y * 0.012 + this.animTime * 2.5 + i) * 20;
        this.seaWavesGraphics.lineTo(baseX + offset + ripple, y);
      }

      // Тыльная сторона волны
      for (let y = this.mapHeight; y >= 0; y -= stepY) {
        const baseX = this.getCoastlineX(y);
        const ripple = Math.sin(y * 0.012 + this.animTime * 2.5 + i) * 20;
        this.seaWavesGraphics.lineTo(baseX + offset + ripple - thickness, y);
      }

      this.seaWavesGraphics.closePath();
      this.seaWavesGraphics.endFill();
    }
  }

  private renderFoam(waveReach: number): void {
    this.foamGraphics.clear();

    const stepY = 20;

    // 1. Основной массив береговой пены
    this.foamGraphics.beginFill(0xffffff, 0.65);
    this.foamGraphics.moveTo(this.getCoastlineX(0), 0);

    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const baseX = this.getCoastlineX(y);
      const ripple = Math.sin(y * 0.015 + this.animTime * 3) * 25;
      this.foamGraphics.lineTo(baseX + waveReach + ripple, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const baseX = this.getCoastlineX(y);
      const foamThickness = 50 + Math.cos(y * 0.008) * 30;
      this.foamGraphics.lineTo(baseX + waveReach - foamThickness, y);
    }

    this.foamGraphics.closePath();
    this.foamGraphics.endFill();

    // 2. Вторичная кружевная полоса
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
