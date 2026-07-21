import * as PIXI from 'pixi.js';

interface BreakerWaveInstance {
  startY: number;
  lengthY: number;
  progress: number;
  speed: number;
  maxThickness: number;
  isLarge: boolean;
}

export class CoastalWaterController {
  public container: PIXI.Container;

  private wetSandGraphics: PIXI.Graphics;
  private seaWavesGraphics: PIXI.Graphics;
  private breakersGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;

  private mapWidth: number;
  private mapHeight: number;
  private coastalRatio: number;

  private deltaWaveMask?: (y: number) => number;

  private animTime = 0;
  private activeBreakers: BreakerWaveInstance[] = [];
  private spawnTimer = 0;
  private daylightFactor = 1.0;

  constructor(
    mapWidth: number, 
    mapHeight: number, 
    coastalRatio: number,
    deltaWaveMask?: (y: number) => number
  ) {
    this.mapWidth = mapWidth || 1000;
    this.mapHeight = mapHeight || 1000;
    this.coastalRatio = coastalRatio;
    this.deltaWaveMask = deltaWaveMask;

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

  private getMask(y: number): number {
    if (!this.deltaWaveMask) return 1.0;
    try {
      return this.deltaWaveMask(y);
    } catch (e) {
      return 1.0;
    }
  }

  public updateTimeState(hours: number): void {
    if (hours >= 10 && hours <= 16) {
      this.daylightFactor = 1.0;
    } else if (hours >= 6 && hours < 10) {
      this.daylightFactor = (hours - 6) / 4;
    } else if (hours > 16 && hours <= 20) {
      this.daylightFactor = 1.0 - (hours - 16) / 4;
    } else {
      this.daylightFactor = 0;
    }
  }

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

    if (this.spawnTimer > 0.35 && this.activeBreakers.length < 25) {
      this.spawnTimer = 0;
      
      const isLarge = Math.random() < 0.25;
      const lengthY = isLarge 
        ? 1800 + Math.random() * 1200 
        : 500 + Math.random() * 700;

      const candidateY = Math.random() * Math.max(100, this.mapHeight - lengthY);
      const midY = candidateY + lengthY / 2;

      if (this.getMask(midY) < 0.25) return;

      const maxThickness = isLarge 
        ? 120 + Math.random() * 60 
        : 40 + Math.random() * 45;

      const speed = isLarge 
        ? 0.08 + Math.random() * 0.04 
        : 0.14 + Math.random() * 0.08;

      this.activeBreakers.push({
        startY: candidateY,
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
      const stepY = 40; // Увеличен шаг для мобайла
      const currentOffset = -1200 * (1 - b.progress) + 40 * b.progress;

      let fadeIn = 1.0;
      if (b.progress < 0.25) {
        fadeIn = Math.pow(b.progress / 0.25, 2.0);
      } else {
        fadeIn = Math.sin(((b.progress - 0.25) / 0.75) * Math.PI / 2 + Math.PI / 2);
      }

      const midY = (startY + endY) / 2;
      const deltaMaskFactor = this.getMask(midY);

      const alpha = Math.sin(b.progress * Math.PI) * fadeIn * deltaMaskFactor;
      const currentThickness = b.maxThickness * Math.sin(b.progress * Math.PI) * fadeIn;

      if (alpha <= 0.02 || currentThickness < 2) continue;

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
    }
  }

  private renderWetSand(wetReach: number): void {
    this.wetSandGraphics.clear();
    this.wetSandGraphics.beginFill(0x8a724d, 0.45);

    const stepY = 50;
    this.wetSandGraphics.moveTo(this.getCoastlineX(0) + wetReach, 0);

    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const baseX = this.getCoastlineX(y);
      const mask = this.getMask(y);
      this.wetSandGraphics.lineTo(baseX + wetReach * mask, y);
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const baseX = this.getCoastlineX(y);
      const mask = this.getMask(y);
      this.wetSandGraphics.lineTo(baseX - 80 * mask, y);
    }

    this.wetSandGraphics.closePath();
    this.wetSandGraphics.endFill();
  }

  private renderSeaWaves(): void {
    this.seaWavesGraphics.clear();

    const NUM_WAVES = 3;
    const stepY = 50;
    const waveSpeed = 0.22;

    for (let i = 0; i < NUM_WAVES; i++) {
      const progress = (this.animTime * waveSpeed + i / NUM_WAVES) % 1.0;
      const offset = -550 * (1 - progress) + 30 * progress;
      const alpha = Math.sin(progress * Math.PI) * 0.35;
      const thickness = 10 + progress * 30;

      if (alpha <= 0.01) continue;

      this.seaWavesGraphics.beginFill(0xe0ffff, alpha);
      
      let started = false;
      for (let y = 0; y <= this.mapHeight; y += stepY) {
        const mask = this.getMask(y);
        if (mask < 0.1) continue; // Пропускаем устья рек

        const baseX = this.getCoastlineX(y);
        const ripple = Math.sin(y * 0.012 + this.animTime * 2.5 + i) * 20;

        if (!started) {
          this.seaWavesGraphics.moveTo(baseX + offset + ripple, y);
          started = true;
        } else {
          this.seaWavesGraphics.lineTo(baseX + offset + ripple, y);
        }
      }

      for (let y = this.mapHeight; y >= 0; y -= stepY) {
        const mask = this.getMask(y);
        if (mask < 0.1) continue;

        const baseX = this.getCoastlineX(y);
        const ripple = Math.sin(y * 0.012 + this.animTime * 2.5 + i) * 20;
        this.seaWavesGraphics.lineTo(baseX + offset + ripple - thickness, y);
      }

      if (started) {
        this.seaWavesGraphics.closePath();
        this.seaWavesGraphics.endFill();
      }
    }
  }

  private renderFoam(waveReach: number): void {
    this.foamGraphics.clear();
    const stepY = 40;

    this.foamGraphics.beginFill(0xffffff, 0.65);
    
    let started = false;
    for (let y = 0; y <= this.mapHeight; y += stepY) {
      const mask = this.getMask(y);
      if (mask < 0.15) continue;

      const baseX = this.getCoastlineX(y);
      const ripple = Math.sin(y * 0.015 + this.animTime * 3) * 25;

      if (!started) {
        this.foamGraphics.moveTo(baseX + waveReach * mask + ripple, y);
        started = true;
      } else {
        this.foamGraphics.lineTo(baseX + waveReach * mask + ripple, y);
      }
    }

    for (let y = this.mapHeight; y >= 0; y -= stepY) {
      const mask = this.getMask(y);
      if (mask < 0.15) continue;

      const baseX = this.getCoastlineX(y);
      const foamThickness = (50 + Math.cos(y * 0.008) * 30) * mask;
      this.foamGraphics.lineTo(baseX + waveReach * mask - foamThickness, y);
    }

    if (started) {
      this.foamGraphics.closePath();
      this.foamGraphics.endFill();
    }
  }
}
