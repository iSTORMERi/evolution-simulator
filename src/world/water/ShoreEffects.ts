// src/world/water/ShoreEffects.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

export class ShoreEffects {
  public container: PIXI.Container;

  private wetSandGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;

  private time: number = 0;
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();

    this.wetSandGraphics = new PIXI.Graphics();
    this.foamGraphics = new PIXI.Graphics();

    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.foamGraphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
  }

  public update(deltaSeconds: number): void {
    this.time += deltaSeconds;

    if (this.shorePoints.length === 0) return;

    // В PixiJS v8 clear() автоматически сбрасывает пути, beginPath() не нужен
    this.wetSandGraphics.clear();
    this.foamGraphics.clear();

    const waveOffset1 = Math.sin(this.time * 1.8) * 10;
    const waveOffset2 = Math.cos(this.time * 2.3) * 6;

    // 1. Мокрый песок
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const offset = Math.sin(this.time * 1.5 + i * 0.1) * 5 + 10;
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.wetSandGraphics.stroke({ color: 0x000000, width: 22, alpha: 0.18 });

    // 2. Базовая пена
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const sineWave = Math.sin(this.time * 2.0 + i * 0.15) * 8 + waveOffset1;
      if (i === 0) this.foamGraphics.moveTo(pt.x - 4 + sineWave, pt.y);
      else this.foamGraphics.lineTo(pt.x - 4 + sineWave, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xded2b8, width: 14, alpha: 0.55 });

    // 3. Белоснежный край волны
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const sineWave = Math.cos(this.time * 2.5 + i * 0.2) * 6 + waveOffset2;
      if (i === 0) this.foamGraphics.moveTo(pt.x - 10 + sineWave, pt.y);
      else this.foamGraphics.lineTo(pt.x - 10 + sineWave, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xffffff, width: 8, alpha: 0.85 });
  }
}
