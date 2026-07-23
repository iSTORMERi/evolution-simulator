// src/world/water/ShoreEffects.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

export class ShoreEffects {
  public container: PIXI.Container;

  private oceanFillGraphics: PIXI.Graphics; // Стационарная мелководная гладь
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
    // 1. Стационарный океан (закрывает дыры) -> 2. Мокрый песок -> 3. Кружево -> 
    // 4. Тень вала -> 5. Водяная подложка -> 6. Пена
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

    // Асимметричная фаза наката/отката (swash phase)
    const rawCycle = Math.sin(this.time * 1.1);
    const swashPhase = Math.pow((rawCycle + 1) / 2, 0.65); 
    const waveAdvance = swashPhase * 60; // Накат волны

    // 0. СТАЦИОНАРНЫЙ ПРИБРЕЖНЫЙ ОКЕАН (Перекрывает песчаный зазор при движении волны)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      // Фиксированный пласт с легким естественным изгибом, без сильного смещения вперед
      const baseOffset = -25 + Math.sin(pt.y * 0.003) * 5;
      
      if (i === 0) this.oceanFillGraphics.moveTo(pt.x + baseOffset, pt.y);
      else this.oceanFillGraphics.lineTo(pt.x + baseOffset, pt.y);
    }
    // Цвет прибрежной мелководной волны (130px кисть уходит глубоко налево в океан)
    this.oceanFillGraphics.stroke({ color: 0x1f9cb0, width: 130, alpha: 0.95 });

    // 1. Мокрый песок (массивная темная полоса на суше)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const organicNoise = Math.sin(pt.y * 0.002 + this.time * 0.3) * 18;
      const offset = 40 + organicNoise;
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.wetSandGraphics.stroke({ color: 0x1a1107, width: 110, alpha: 0.28 });

    // 2. Остаточные кружевные пузыри пены (Вынесены ВПЕРЕД на песок)
    // Появляются, когда волна доходит до пика наката и начинает откатываться
    const laceAlpha = Math.max(0, Math.sin(this.time * 1.1 + 0.5) * 0.6); 
    if (laceAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 2) {
        const pt = this.shorePoints[i];
        // Выносим кружево на 35-55px вперед относительно базовой линии
        const bubbleNoise = Math.sin(pt.y * 0.04) * 12;
        const laceOffset = 45 + bubbleNoise; 
        
        const radius = 2.5 + Math.abs(Math.sin(pt.y * 0.1)) * 4.5;
        this.laceGraphics.circle(pt.x + laceOffset, pt.y, radius);
      }
      this.laceGraphics.fill({ color: 0xffffff, alpha: laceAlpha });
    }

    // 3. Широкая тень волны
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 12 + Math.sin(pt.y * 0.01) * 6;
      const offset = waveAdvance + multiNoise - 20;

      if (i === 0) this.waveShadowGraphics.moveTo(pt.x + offset, pt.y);
      else this.waveShadowGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waveShadowGraphics.stroke({ color: 0x02252e, width: 55, alpha: 0.38 });

    // 4. Набегающая бирюзовая подложка
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 12 + Math.sin(pt.y * 0.01) * 6;
      const offset = waveAdvance + multiNoise - 8;

      if (i === 0) this.waterBaseGraphics.moveTo(pt.x + offset, pt.y);
      else this.waterBaseGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waterBaseGraphics.stroke({ color: 0x24aabf, width: 45, alpha: 0.6 });

    // 5. Рваное тело пены (языки прибоя)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const foamTongues = Math.sin(pt.y * 0.003 + this.time * 1.2) * 10 + Math.sin(pt.y * 0.012 + this.time * 2.0) * 8;
      const offset = waveAdvance + foamTongues;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xe4f7f7, width: 38, alpha: 0.82 });

    // 6. Передний белоснежный гребень
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const crestTongues = Math.sin(pt.y * 0.003 + this.time * 1.2) * 10 + Math.cos(pt.y * 0.015 + this.time * 2.2) * 6;
      const offset = waveAdvance + crestTongues + 4;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xffffff, width: 12, alpha: 0.95 });
  }
}
