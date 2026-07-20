import * as PIXI from 'pixi.js';

interface BreakerWaveInstance {
  startY: number;       // Начальная Y-координата центра волны
  lengthY: number;      // Длина фронта волны (теперь короткая)
  progress: number;     // Прогресс движения: 0.0 -> 1.0
  speed: number;        // Скорость перемещения
  maxThickness: number; // Толщина массива воды
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

    // 1. Динамический спавн массовых коротких валов
    this.handleBreakerSpawns(deltaSeconds);
    this.updateBreakers(deltaSeconds);

    // 2. Береговой прибой
    const wavePhase = (Math.sin(this.animTime * 1.4) + 1) / 2;
    const waveReach = Math.pow(wavePhase, 0.75) * 220;

    const wetLag = (Math.sin(this.animTime * 1.4 - 0.4) + 1) / 2;
    const wetReach = Math.max(waveReach, wetLag * 260);

    this.renderWetSand(wetReach);
    this.renderSeaWaves();
    this.renderBreakers();
    this.renderFoam(waveReach);
  }

  // --- Логика спавна коротких и частых волн ---
  private handleBreakerSpawns(deltaSeconds: number): void {
    this.spawnTimer += deltaSeconds;

    // Спавним волну каждые 0.4 секунды, лимит повысили до 20 штук на побережье
    if (this.spawnTimer > 0.4 && this.activeBreakers.length < 20) {
      this.spawnTimer = 0;
      this.activeBreakers.push({
        startY: Math.random() * (this.mapHeight - 2000),
        lengthY: 800 + Math.random() * 1000,    // Короткие локальные волны (800–1800px)
        progress: 0,
        speed: 0.12 + Math.random() * 0.1,    // Разная динамика движения
        maxThickness: 110 + Math.random() * 70  // МАССИВНЫЕ валы (110–180px толщиной)
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

  // --- Отрисовка массивных коротких валов ---
  private renderBreakers(): void {
    this.breakersGraphics.clear();

    for (const b of this.activeBreakers) {
      const startY = Math.max(0, b.startY);
      const endY = Math.min(this.mapHeight, b.startY + b.lengthY);
      const stepY = 25;

      const currentOffset = -600 * (1 - b.progress) + 40 * b.progress;
      const alpha = Math.sin(b.progress * Math.PI);
      const currentThickness = b.maxThickness * Math.sin(b.progress * Math.PI);

      if (alpha <= 0.05) continue;

      // 1. МАССИВНАЯ ТЕНЬ ПОД ВОЛНОЙ (Создает глубокий объем)
      this.breakersGraphics.beginFill(0x021324, alpha * 0.55);
      for (let y = startY; y <= endY; y += stepY) {
        const baseX = this.getCoastlineX(y);
        const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
        const shadowOffset = currentOffset - currentThickness * edgeFade - 45;

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

      // 2. ТЕЛО МАССИВНОЙ ВОЛНЫ (Яркий бирюзовый гребень)
      this.breakersGraphics.beginFill(0x40e0d0, alpha * 0.8);
      for (let y = startY; y <= endY; y += stepY) {
        const baseX = this.getCoastlineX(y);
        const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
        const rip = Math.sin(y * 0.012 + this.animTime * 3) * 20;
        const xPos = baseX + currentOffset + rip * edgeFade;

        if (y === startY) this.breakersGraphics.moveTo(xPos, y);
        else this.breakersGraphics.lineTo(xPos, y);
      }
      for (let y = endY; y >= startY; y -= stepY) {
        const baseX = this.getCoastlineX(y);
        const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
        const rip = Math.sin(y * 0.012 + this.animTime * 3) * 20;
        const xPos = baseX + currentOffset + rip * edgeFade - currentThickness * edgeFade;

        this.breakersGraphics.lineTo(xPos, y);
      }
      this.breakersGraphics.closePath();
      this.breakersGraphics.endFill();

      // 3. ПЛОТНАЯ БЕЛАЯ ПЕНА НА ГРЕБНЕ (Широкий взрыв прибоя)
      if (b.progress > 0.25) {
        const foamAlpha = Math.sin((b.progress - 0.25) / 0.75 * Math.PI) * 0.9;
        this.breakersGraphics.beginFill(0xffffff, foamAlpha);

        for (let y = startY; y <= endY; y += stepY) {
          const baseX = this.getCoastlineX(y);
          const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
          const foamRip = Math.cos(y * 0.02 + this.animTime * 5) * 25;
          const xPos = baseX + currentOffset + foamRip * edgeFade;

          if (y === startY) this.breakersGraphics.moveTo(xPos, y);
          else this.breakersGraphics.lineTo(xPos, y);
        }
        for (let y = endY; y >= startY; y -= stepY) {
          const baseX = this.getCoastlineX(y);
          const edgeFade = Math.sin(((y - startY) / b.lengthY) * Math.PI);
          // Толщина пены вырастает до 60px
          const foamThickness = (35 + Math.sin(y * 0.03) * 25) * edgeFade;
          const xPos = baseX + currentOffset - foamThickness;

          this.breakersGraphics.lineTo(xPos, y);
        }
        this.breakersGraphics.closePath();
        this.breakersGraphics.endFill();
      }
    }
  }

  // --- Базовые слои ---
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
