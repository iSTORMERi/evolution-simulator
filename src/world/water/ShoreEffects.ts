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

  /**
   * Инициализация точек береговой линии из WorldMap
   */
  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
  }

  /**
   * Обновление анимации прибоя
   */
  public update(deltaSeconds: number): void {
    this.time += deltaSeconds;

    if (this.shorePoints.length === 0) return;

    this.drawWetSandAndFoam();
  }

  /**
   * Отрисовка мокрого песка и слоев пены
   */
  private drawWetSandAndFoam(): void {
    this.wetSandGraphics.clear();
    this.foamGraphics.clear();

    const waveOffset1 = Math.sin(this.time * 1.8) * 12;
    const waveOffset2 = Math.cos(this.time * 2.3) * 8;

    // 1. Мокрый песок (тёмная полупрозрачная полоса уреза воды)
    this.wetSandGraphics.beginPath();
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const offset = Math.sin(this.time * 1.5 + i * 0.1) * 6 + 15;
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.wetSandGraphics.fill({ color: 0x000000, alpha: 0.18 });

    // 2. Первичная полоса пены (кремово-бежевая)
    this.foamGraphics.beginPath();
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const sineWave = Math.sin(this.time * 2.0 + i * 0.15) * 10 + waveOffset1;
      if (i === 0) this.foamGraphics.moveTo(pt.x - 5 + sineWave, pt.y);
      else this.foamGraphics.lineTo(pt.x - 5 + sineWave, pt.y);
    }
    this.foamGraphics.fill({ color: 0xded2b8, alpha: 0.45 });

    // 3. Белоснежный край накатывающей волны
    this.foamGraphics.beginPath();
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const sineWave = Math.cos(this.time * 2.5 + i * 0.2) * 8 + waveOffset2;
      if (i === 0) this.foamGraphics.moveTo(pt.x - 12 + sineWave, pt.y);
      else this.foamGraphics.lineTo(pt.x - 12 + sineWave, pt.y);
    }
    this.foamGraphics.fill({ color: 0xffffff, alpha: 0.7 });
  }
}
