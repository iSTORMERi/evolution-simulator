// src/world/water/ShoreEffects.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

export class ShoreEffects {
  public container: PIXI.Container;

  private oceanFillGraphics: PIXI.Graphics; 
  private wetSandGraphics: PIXI.Graphics;
  private waveShadowGraphics: PIXI.Graphics;
  private waterBaseGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;
  private laceGraphics: PIXI.Graphics;

  private time: number = 0;
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();

    this.oceanFillGraphics = new PIXI.Graphics();
    this.wetSandGraphics = new PIXI.Graphics();
    this.waveShadowGraphics = new PIXI.Graphics();
    this.waterBaseGraphics = new PIXI.Graphics();
    this.foamGraphics = new PIXI.Graphics();
    this.laceGraphics = new PIXI.Graphics();

    // Порядок слоев: 
    // 1. Статичный океан -> 2. Мокрый песок -> 3. Кружево -> 
    // 4. Тень вала -> 5. Бирюзовая подложка -> 6. Пена
    this.container.addChild(this.oceanFillGraphics);
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

    this.oceanFillGraphics.clear();
    this.wetSandGraphics.clear();
    this.waveShadowGraphics.clear();
    this.waterBaseGraphics.clear();
    this.foamGraphics.clear();
    this.laceGraphics.clear();

    // Динамика наката
    const rawCycle = Math.sin(this.time * 1.1);
    const swashPhase = Math.pow((rawCycle + 1) / 2, 0.65); 
    const waveAdvance = swashPhase * 50; 

    // 0. ФИКСИРОВАННАЯ ПОДЛОЖКА ОКЕАНА (Точный пипетки-цвет 0x1dcadb, широкая заливка влево)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const baseOffset = -50 + Math.sin(pt.y * 0.003) * 4;
      
      if (i === 0) this.oceanFillGraphics.moveTo(pt.x + baseOffset, pt.y);
      else this.oceanFillGraphics.lineTo(pt.x + baseOffset, pt.y);
    }
    // Используем идеальный лазурный оттенок прибрежной зоны и ширину 180px
    this.oceanFillGraphics.stroke({ color: 0x1dcadb, width: 180, alpha: 1.0 });

    // 1. МОКРЫЙ ПЕСОК (Сдвинут вправо на светлую кайму суши!)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const organicNoise = Math.sin(pt.y * 0.003 + this.time * 0.2) * 8;
      // offset +48 выносит мокрый песок точно на светлую полосу песка
      const offset = 48 + organicNoise; 
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    // Сочный тёмный след намокания (ширина 70px)
    this.wetSandGraphics.stroke({ color: 0x221508, width: 70, alpha: 0.38 });

    // 2. ОСТАТОЧНОЕ КРУЖЕВО ПЕНЫ
    const laceAlpha = Math.max(0, Math.sin(this.time * 1.1 + 0.3) * 0.75); 
    if (laceAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 2) {
        const pt = this.shorePoints[i];
        const bubbleNoise = Math.sin(pt.y * 0.04) * 10;
        const laceOffset = 45 + bubbleNoise; 
        
        const radius = 2.0 + Math.abs(Math.sin(pt.y * 0.1)) * 4.0;
        this.laceGraphics.circle(pt.x + laceOffset, pt.y, radius);
      }
      this.laceGraphics.fill({ color: 0xffffff, alpha: laceAlpha });
    }

    // 3. МЯГКАЯ ТЕНЬ НАБЕГАЮЩЕГО ВАЛА
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 10 + Math.sin(pt.y * 0.01) * 5;
      const offset = waveAdvance + multiNoise - 22;

      if (i === 0) this.waveShadowGraphics.moveTo(pt.x + offset, pt.y);
      else this.waveShadowGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waveShadowGraphics.stroke({ color: 0x022c36, width: 50, alpha: 0.35 });

    // 4. ПРОЗРАЧНАЯ БИРЮЗОВАЯ ВОДЯНАЯ ПОДУШКА
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 10 + Math.sin(pt.y * 0.01) * 5;
      const offset = waveAdvance + multiNoise - 8;

      if (i === 0) this.waterBaseGraphics.moveTo(pt.x + offset, pt.y);
      else this.waterBaseGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waterBaseGraphics.stroke({ color: 0x22abbf, width: 40, alpha: 0.55 });

    // 5. РВАНАЯ ПЕНА ПРИБОЯ (Языки)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const foamTongues = Math.sin(pt.y * 0.003 + this.time * 1.2) * 10 + Math.sin(pt.y * 0.012 + this.time * 2.0) * 8;
      const offset = waveAdvance + foamTongues;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xe4f7f7, width: 34, alpha: 0.82 });

    // 6. БЕЛОСНЕЖНЫЙ ГРЕБЕНЬ
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const crestTongues = Math.sin(pt.y * 0.003 + this.time * 1.2) * 10 + Math.cos(pt.y * 0.015 + this.time * 2.2) * 6;
      const offset = waveAdvance + crestTongues + 3;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xffffff, width: 12, alpha: 0.95 });
  }
}
