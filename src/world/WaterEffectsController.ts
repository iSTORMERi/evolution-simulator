import * as PIXI from 'pixi.js';

interface BreakerWaveInstance {
  startY: number;       // Начальная Y-координата
  lengthY: number;      // Длина фронта волны
  progress: number;     // Прогресс: 0.0 -> 1.0
  speed: number;        // Скорость перемещения
  maxThickness: number; // Толщина массива
  isLarge: boolean;     // Крупная волна или мелкая
}

export class WaterEffectsController {
  public container: PIXI.Container;

  private wetSandGraphics: PIXI.Graphics;
  private seaWavesGraphics: PIXI.Graphics;
  private breakersGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;

  private mapWidth: number;
  private mapHeight: number;
  private coastalRatio: number;

  private animTime = 0;
  private activeBreakers: BreakerWaveInstance[] = [];
  private spawnTimer = 0;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.coastalRatio = coastalRatio;

    this.container = new PIXI.Container();

    this.wetSandGraphics = new PIXI.Graphics();
    this.seaWavesGraphics = new PIXI.Graphics();
    this.breakersGraphics = new PIXI.Graphics();
    this.foamGraphics = new PIXI.Graphics();

    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.seaWavesGraphics);
    this.container.addChild(this.breakersGraphics);
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

    this.handleBreakerSpawns(deltaSeconds);
    this.updateBreakers(deltaSeconds);

    const wavePhase = (Math.sin(this.animTime * 1.4) + 1) / 2;
    const waveReach = Math.pow(wavePhase, 0.75) * 220;

    const wetLag = (Math.sin(this.animTime * 1.4 - 0.4) + 1) / 2;
    const wetReach = Math.max(waveReach, wetLag * 260);

    this.renderWetSand(wetReach);
    this.renderSeaWaves();
    this.renderBreakers();
    this.renderFoam(waveReach);
  }

  private handleBreakerSpawns(deltaSeconds: number): void {
    this.spawnTimer += deltaSeconds;

    // Регулярный спавн (лимит до 25 активных волн)
    if (this.spawnTimer > 0.35 && this.activeBreakers.length < 25) {
      this.spawnTimer = 0;

      // 25% шанс гигантской волны, 75% шанс мелкого/среднего барашка
      const isLarge = Math.random() < 0.25;

      const lengthY = isLarge 
        ? 1800 + Math.random() * 1200  // Крупные: 1800-3000px
        : 500 + Math.random() * 700;    // Мелкие: 500-1200px

      const maxThickness = isLarge 
        ? 120 + Math.random() * 60     // Толстые валы
        : 40 + Math.random() * 45;      // Изящные мелкие гребни

      const speed = isLarge 
        ? 0.08 + Math.random() * 0.04  // Большие волны идут вальяжно и медленнее
        : 0.14 + Math.random() * 0.08;

      this.activeBreakers.push({
        startY: Math.random() * (this.mapHeight - lengthY),
        lengthY,
        progress: 0,
        speed,
        maxThickness,
        isLarge
      });
    }
  }

  private updateBreakers(deltaSeconds: number): void {
    for (let i = this.activeBreakers.length - 1; i >= 0; i--) {
      const b = this.activeBreakers[i];
      b.progress += deltaSeconds * b.speed;

      if (b.progress >= 1.0) {
        this.activeBreakers.splice(i, 1);
      }
    }
  }

  private renderBreakers(): void {
    this.breakersGraphics.clear();

    for (const b of this.activeBreakers) {
      const startY = Math.max(0, b.startY);
      const endY = Math.min(this.mapHeight, b.startY + b.lengthY);
      const stepY = 25;

      // Начинаем спавн дальше в море: от -1200px до +40px у берега
      const currentOffset = -1200 * (1 - b.progress) + 40 * b.progress;

      // Плавный запуск (Scale In) и плавная смерть у берега
      // До 0.25 прогресса волна МЕДЛЕННО прорастает и нарастает
      let fadeIn = 1.0;
      if (b.progress < 0.25) {
        fadeIn = Math.pow(b.progress / 0.25, 2.0); // Мягкая парабола проявления
      } else {
        fadeIn = Math.sin(((b.progress - 0.25) / 0.75) * Math.PI / 2 + Math.PI / 2);
      }

      const alpha = Math.sin(b.progress * Math.PI) * fadeIn;
      const currentThickness = b.maxThickness * Math.sin(b.progress * Math.PI) * fadeIn;

      if (alpha <= 0.02 || currentThickness < 2) continue;

      // 1. СВЕТЛАЯ И МЯГКАЯ ТЕНЬ ПОД ВОЛНОЙ (Более природный бирюзово-морской оттенок)
      const shadowColor = b.isLarge ? 0x0e5269 : 0x187087;
      this.breakersGraphics.beginFill(shadowColor, alpha * 0.4);

      for (let y = startY; y <= endY; y += stepY) {
        const baseX = this.getCoastlineX(y);
        const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
        const shadowOffset = currentOffset - currentThickness * edgeFade - (b.isLarge ? 35 : 18);

        if (y === startY) this.breakersGraphics.moveTo(baseX + shadowOffset, y);
        else this.breakersGraphics.lineTo(baseX + shadowOffset, y);
      }
      for (let y = endY; y >= startY; y -= stepY) {
        const baseX = this.getCoastlineX(y);
        const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
        this.breakersGraphics.lineTo(baseX + currentOffset - currentThickness * edgeFade, y);
      }
      this.breakersGraphics.closePath();
      this.breakersGraphics.endFill();

      // 2. ТЕЛО ВОЛНЫ (Яркий небесно-бирюзовый гребень)
      this.breakersGraphics.beginFill(0x60f0d8, alpha * 0.75);
      for (let y = startY; y <= endY; y += stepY) {
        const baseX = this.getCoastlineX(y);
        const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
        const rip = Math.sin(y * 0.012 + this.animTime * 3) * 15;
        const xPos = baseX + currentOffset + rip * edgeFade;

        if (y === startY) this.breakersGraphics.moveTo(xPos, y);
        else this.breakersGraphics.lineTo(xPos, y);
      }
      for (let y = endY; y >= startY; y -= stepY) {
        const baseX = this.getCoastlineX(y);
        const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
        const rip = Math.sin(y * 0.012 + this.animTime * 3) * 15;
        const xPos = baseX + currentOffset + rip * edgeFade - currentThickness * edgeFade;

        this.breakersGraphics.lineTo(xPos, y);
      }
      this.breakersGraphics.closePath();
      this.breakersGraphics.endFill();

      // 3. БЕЛАЯ ПЕНА НА ГРЕБНЕ (Зажигается ближе к берегу)
      if (b.progress > 0.3) {
        const foamAlpha = Math.sin((b.progress - 0.3) / 0.7 * Math.PI) * 0.85 * fadeIn;
        this.breakersGraphics.beginFill(0xffffff, foamAlpha);

        for (let y = startY; y <= endY; y += stepY) {
          const baseX = this.getCoastlineX(y);
          const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
          const foamRip = Math.cos(y * 0.02 + this.animTime * 5) * 20;
          const xPos = baseX + currentOffset + foamRip * edgeFade;

          if (y === startY) this.breakersGraphics.moveTo(xPos, y);
          else this.breakersGraphics.lineTo(xPos, y);
        }
        for (let y = endY; y >= startY; y -= stepY) {
          const baseX = this.getCoastlineX(y);
          const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
          const foamThickness = (b.isLarge ? (25 + Math.sin(y * 0.03) * 15) : (12 + Math.sin(y * 0.03) * 8)) * edgeFade;
          const xPos = baseX + currentOffset - foamThickness;

          this.breakersGraphics.lineTo(xPos, y);
        }
        this.breakersGraphics.closePath();
        this.breakersGraphics.endFill();
      }
    }
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

    const NUM_WAVES = 3;
    const stepY = 25;
    const waveSpeed = 0.22;

    for (let i = 0; i < NUM_WAVES; i++) {
      const progress = (this.animTime * waveSpeed + i / NUM_WAVES) % 1.0;
      const offset = -550 * (1 - progress) + 30 * progress;
      const alpha = Math.sin(progress * Math.PI) * 0.35;
      const thickness = 10 + progress * 30;

      if (alpha <= 0.01) continue;

      this.seaWavesGraphics.beginFill(0xe0ffff, alpha);
      this.seaWavesGraphics.moveTo(this.getCoastlineX(0) + offset, 0);

      for (let y = 0; y <= this.mapHeight; y += stepY) {
        const baseX = this.getCoastlineX(y);
        const ripple = Math.sin(y * 0.012 + this.animTime * 2.5 + i) * 20;
        this.seaWavesGraphics.lineTo(baseX + offset + ripple, y);
      }

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
