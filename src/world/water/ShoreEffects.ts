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
  private waterBaseGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;
  private laceGraphics: PIXI.Graphics;

  private time: number = 0;
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();

    this.wetSandGraphics = new PIXI.Graphics();
    this.waveShadowGraphics = new PIXI.Graphics();
    this.waterBaseGraphics = new PIXI.Graphics();
    this.foamGraphics = new PIXI.Graphics();
    this.laceGraphics = new PIXI.Graphics();

    // Порядок слоев: Мокрый песок -> Кружево на песке -> Тень вала -> Водяная подложка -> Пена
    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.laceGraphics);
    this.container.addChild(this.waveShadowGraphics);
    this.container.addChild(this.waterBaseGraphics);
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
    this.waterBaseGraphics.clear();
    this.foamGraphics.clear();
    this.laceGraphics.clear();

    // Асимметричная фаза наката/отката (swash phase)
    const rawCycle = Math.sin(this.time * 1.1);
    const swashPhase = Math.pow((rawCycle + 1) / 2, 0.65); 
    const waveAdvance = swashPhase * 65; // Мощный накат волны до 65px в сторону суши

    // 1. Мокрый песок (массивный след глубоко на берегу)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const organicNoise = Math.sin(pt.y * 0.002 + this.time * 0.3) * 18;
      const offset = 35 + organicNoise;
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.wetSandGraphics.stroke({ color: 0x1a1107, width: 105, alpha: 0.25 });

    // 2. Остаточная сетка/кружево пены на мокром песке при откате воды
    const backwashAlpha = Math.max(0, (1 - swashPhase) * 0.5); // Проявляется только при отходе воды
    if (backwashAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 3) {
        const pt = this.shorePoints[i];
        // Псевдорандомные островки кружева
        const bubbleNoise = Math.sin(pt.y * 0.05) * 15;
        const laceOffset = 20 + bubbleNoise;
        
        this.laceGraphics.circle(pt.x + laceOffset, pt.y, 3 + Math.abs(Math.sin(pt.y)) * 4);
      }
      this.laceGraphics.fill({ color: 0xffffff, alpha: backwashAlpha });
    }

    // 3. Широкая глубокая тень вала набегающей воды
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 12 + Math.sin(pt.y * 0.01) * 6;
      const offset = waveAdvance + multiNoise - 25;

      if (i === 0) this.waveShadowGraphics.moveTo(pt.x + offset, pt.y);
      else this.waveShadowGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waveShadowGraphics.stroke({ color: 0x02252e, width: 65, alpha: 0.42 });

    // 4. Пышная бирюзовая подложка воды
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 12 + Math.sin(pt.y * 0.01) * 6;
      const offset = waveAdvance + multiNoise - 12;

      if (i === 0) this.waterBaseGraphics.moveTo(pt.x + offset, pt.y);
      else this.waterBaseGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waterBaseGraphics.stroke({ color: 0x1f9cb0, width: 50, alpha: 0.55 });

    // 5. Рваное тело бурлящей пены (суперпозиция двух шумов дает неравномерные языки)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      // Двухчастотный шум заставляет пену вытягиваться неравномерными языками
      const foamTongues = Math.sin(pt.y * 0.003 + this.time * 1.2) * 10 + Math.sin(pt.y * 0.012 + this.time * 2.0) * 8;
      const offset = waveAdvance + foamTongues - 4;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xe4f7f7, width: 42, alpha: 0.8 });

    // 6. Передний ярко-белый гребень прибоя
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const crestTongues = Math.sin(pt.y * 0.003 + this.time * 1.2) * 10 + Math.cos(pt.y * 0.015 + this.time * 2.2) * 6;
      const offset = waveAdvance + crestTongues + 2;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xffffff, width: 14, alpha: 0.95 });
  }
}
