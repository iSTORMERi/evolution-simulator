// src/world/water/ShoreEffects.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

export class ShoreEffects {
  public container: PIXI.Container;

  private wetSandGraphics: PIXI.Graphics;
  private waveShadowGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;

  private time: number = 0;
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();

    this.wetSandGraphics = new PIXI.Graphics();
    this.waveShadowGraphics = new PIXI.Graphics();
    this.foamGraphics = new PIXI.Graphics();

    // Порядок слоев: Мокрый песок -> Тень волны -> Пена
    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.waveShadowGraphics);
    this.container.addChild(this.foamGraphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
  }

  public update(deltaSeconds: number): void {
    this.time += deltaSeconds;

    if (this.shorePoints.length === 0) return;

    this.wetSandGraphics.clear();
    this.waveShadowGraphics.clear();
    this.foamGraphics.clear();

    // Асимметричная фаза волны: быстрый накат (swash), медленный откат (backwash)
    const rawCycle = Math.sin(this.time * 1.6);
    const swashPhase = Math.pow((rawCycle + 1) / 2, 0.6); // 0..1 с уплощением вершины
    const waveAdvance = swashPhase * 35; // Амплитуда движения волны (px)

    // 1. Мокрый песок (след от откатывающейся воды)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const organicNoise = Math.sin(pt.y * 0.02 + this.time * 0.5) * 8;
      const offset = 18 + organicNoise;
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.wetSandGraphics.stroke({ color: 0x2b1e10, width: 45, alpha: 0.18 });

    // 2. Тень приподнятого вала воды (создаёт объём)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const microNoise = Math.sin(this.time * 2.2 + i * 0.1) * 6;
      const offset = -waveAdvance + microNoise - 8;

      if (i === 0) this.waveShadowGraphics.moveTo(pt.x + offset, pt.y);
      else this.waveShadowGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waveShadowGraphics.stroke({ color: 0x073d4a, width: 28, alpha: 0.35 });

    // 3. Основное тело пенистого наката (широкая мягкая бежевая полоса)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const noise = Math.sin(this.time * 2.0 + i * 0.12) * 10;
      const offset = -waveAdvance + noise;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xe8e2d1, width: 22, alpha: 0.65 });

    // 4. Белоснежный гребень волны (яркая кромка прибоя)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const crestNoise = Math.cos(this.time * 2.8 + i * 0.18) * 5;
      const offset = -waveAdvance + crestNoise - 4;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xffffff, width: 10, alpha: 0.9 });
  }
}
