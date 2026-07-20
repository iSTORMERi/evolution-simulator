import * as PIXI from 'pixi.js';

export class WaterEffectsController {
  public container: PIXI.Container;

  private sunGlintGraphics: PIXI.Graphics;
  private ripplesGraphics: PIXI.Graphics;
  private coastalFoamGraphics: PIXI.Graphics;
  private biolumGraphics: PIXI.Graphics;

  private mapWidth: number;
  private mapHeight: number;
  private coastalRatio: number;

  private animTime = 0;
  private sunGlintAlpha = 0.8;
  private isNight = false;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.coastalRatio = coastalRatio;

    this.container = new PIXI.Container();

    this.sunGlintGraphics = new PIXI.Graphics();
    this.ripplesGraphics = new PIXI.Graphics();
    this.biolumGraphics = new PIXI.Graphics();
    this.coastalFoamGraphics = new PIXI.Graphics();

    // Порядок слоев
    this.container.addChild(this.ripplesGraphics);
    this.container.addChild(this.sunGlintGraphics);
    this.container.addChild(this.biolumGraphics);
    this.container.addChild(this.coastalFoamGraphics);

    this.drawBaseRipples();
  }

  /**
   * Рисует мягкую органическую рябы по всей воде
   */
  private drawBaseRipples(): void {
    this.ripplesGraphics.clear();
    const oceanWidth = this.mapWidth * this.coastalRatio;

    // Рисуем мягкие, нерегулярные линии ряби
    this.ripplesGraphics.lineStyle(1.5, 0xffffff, 0.08);

    for (let y = 50; y < this.mapHeight; y += 120) {
      for (let x = 50; x < oceanWidth; x += 300) {
        const length = 80 + Math.sin(x + y) * 40;
        const curve = Math.cos(x * 0.01) * 15;

        this.ripplesGraphics.moveTo(x, y);
        this.ripplesGraphics.quadraticCurveTo(x + length / 2, y + curve, x + length, y + Math.sin(y) * 5);
      }
    }
  }

  /**
   * Обновляем световой блик (солнечный или лунный) и биолюминесценцию
   */
  public updateTimeState(hours: number): void {
    const oceanWidth = this.mapWidth * this.coastalRatio;
    const centerX = oceanWidth * 0.45;
    const centerY = this.mapHeight * 0.5;

    this.sunGlintGraphics.clear();

    if (hours >= 7.0 && hours <= 18.0) {
      // === ДЕНЬ: Яркий, мягкий, рассеянный солнечный блик на океане ===
      this.isNight = false;

      // Положение солнца на воде слегка смещается в зависимости от времени дня
      const sunOffsetY = (hours - 12.5) * 300;

      // Мягкое радиолинейное пятно солнечного блеска
      this.sunGlintGraphics.beginFill(0xffffff, 0.15);
      this.sunGlintGraphics.drawEllipse(centerX, centerY + sunOffsetY, 1800, 2400);
      this.sunGlintGraphics.endFill();

      this.sunGlintGraphics.beginFill(0xffffff, 0.25);
      this.sunGlintGraphics.drawEllipse(centerX, centerY + sunOffsetY, 1000, 1400);
      this.sunGlintGraphics.endFill();

      this.sunGlintGraphics.beginFill(0xffffff, 0.45);
      this.sunGlintGraphics.drawEllipse(centerX, centerY + sunOffsetY, 400, 600);
      this.sunGlintGraphics.endFill();

      this.sunGlintAlpha = 1.0;
    } else if ((hours > 5.0 && hours < 7.0) || (hours > 18.0 && hours < 20.0)) {
      // === РАССВЕТ / ЗАКАТ: Теплый золотисто-алый дорожный блик ===
      this.isNight = false;
      const sunOffsetY = hours > 12 ? 1200 : -1200;

      this.sunGlintGraphics.beginFill(0xffa066, 0.2);
      this.sunGlintGraphics.drawEllipse(centerX, centerY + sunOffsetY, 1400, 2800);
      this.sunGlintGraphics.endFill();

      this.sunGlintGraphics.beginFill(0xffd1a1, 0.35);
      this.sunGlintGraphics.drawEllipse(centerX, centerY + sunOffsetY, 600, 1200);
      this.sunGlintGraphics.endFill();

      this.sunGlintAlpha = 0.8;
    } else {
      // === НОЧЬ: Узкая серебристая лунная дорожка ===
      this.isNight = true;

      this.sunGlintGraphics.beginFill(0x99ccff, 0.12);
      this.sunGlintGraphics.drawEllipse(centerX, centerY, 600, 3500);
      this.sunGlintGraphics.endFill();

      this.sunGlintGraphics.beginFill(0xe6f2ff, 0.25);
      this.sunGlintGraphics.drawEllipse(centerX, centerY, 200, 2000);
      this.sunGlintGraphics.endFill();

      this.sunGlintAlpha = 0.6;
    }

    // Биолюминесценция ночью
    this.biolumGraphics.clear();
    if (this.isNight) {
      this.biolumGraphics.beginFill(0x00f3ff, 0.15);
      this.drawCoastalShape(this.biolumGraphics, oceanWidth, 80);
      this.biolumGraphics.endFill();
    }
  }

  /**
   * Рисует полосу, повторяющую изгибы береговой линии
   */
  private drawCoastalShape(g: PIXI.Graphics, baseX: number, widthOffset: number): void {
    const stepY = 100;

    g.moveTo(baseX - widthOffset, 0);
    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const wavyX = baseX + Math.sin(y * 0.003) * 120 + Math.cos(y * 0.008) * 60;
      g.lineTo(wavyX - widthOffset, y);
    }
    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const wavyX = baseX + Math.sin(y * 0.003) * 120 + Math.cos(y * 0.008) * 60;
      g.lineTo(wavyX, y);
    }
    g.closePath();
  }

  /**
   * Кадровый апдейт (анимация дышащей воды и пены)
   */
  public update(deltaSeconds: number): void {
    this.animTime += deltaSeconds;

    // 1. Плавное покачивание ряби
    this.ripplesGraphics.x = Math.sin(this.animTime * 0.5) * 12;
    this.ripplesGraphics.y = Math.cos(this.animTime * 0.3) * 8;

    // 2. Пульсация и дрейф солнечного блика
    this.sunGlintGraphics.alpha = this.sunGlintAlpha + Math.sin(this.animTime * 1.5) * 0.05;
    this.sunGlintGraphics.scale.set(1 + Math.sin(this.animTime * 0.8) * 0.02);

    // 3. Органическая пенная волна прибоя вдоль линии берега
    const foamOffset = (Math.sin(this.animTime * 1.8) + 1) * 15;
    const oceanWidth = this.mapWidth * this.coastalRatio;

    this.coastalFoamGraphics.clear();
    this.coastalFoamGraphics.beginFill(0xffffff, 0.25 + Math.sin(this.animTime * 1.8) * 0.1);
    this.drawCoastalShape(this.coastalFoamGraphics, oceanWidth, 20 + foamOffset);
    this.coastalFoamGraphics.endFill();
  }
}
