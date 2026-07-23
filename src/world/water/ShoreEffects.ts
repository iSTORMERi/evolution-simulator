// src/world/water/ShoreEffects.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

export class ShoreEffects {
  public container: PIXI.Container;

  private oceanFillGraphics: PIXI.Graphics; // Стационарная гладь в цвет открытой воды
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
    // 1. Цвет океана -> 2. Мокрый песок (на светлой зоне) -> 3. Кружево -> 
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

    // Асимметричная фаза наката/отката (swash phase)
    const rawCycle = Math.sin(this.time * 1.1);
    const swashPhase = Math.pow((rawCycle + 1) / 2, 0.65); 
    const waveAdvance = swashPhase * 55; // Плавный накат волны

    // 0. СТАЦИОНАРНАЯ ВОДНАЯ ГЛАДЬ (Цвет точно совпадает с основным океаном)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const baseOffset = -30 + Math.sin(pt.y * 0.003) * 5;
      
      if (i === 0) this.oceanFillGraphics.moveTo(pt.x + baseOffset, pt.y);
      else this.oceanFillGraphics.lineTo(pt.x + baseOffset, pt.y);
    }
    // Используем мягкий лазурный цвет океана (0x33cad6), без темного контраста
    this.oceanFillGraphics.stroke({ color: 0x33cad6, width: 140, alpha: 1.0 });

    // 1. МОКРЫЙ ПЕСОК (Калиброван ровно под светлую полосу песка на карте)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      // Органическое дыхание мокрого песка аккуратно по ширине светлой зоны
      const organicNoise = Math.sin(pt.y * 0.003 + this.time * 0.2) * 6;
      const offset = 22 + organicNoise; 
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    // Ширина 50px и темный цвет намокания идеально ложатся на светлую песчаную кайму
    this.wetSandGraphics.stroke({ color: 0x24180c, width: 52, alpha: 0.32 });

    // 2. ОСТАТОЧНОЕ КРУЖЕВО ПЕНЫ (Пузыри на переднем краю наката)
    const laceAlpha = Math.max(0, Math.sin(this.time * 1.1 + 0.4) * 0.75); 
    if (laceAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 2) {
        const pt = this.shorePoints[i];
        const bubbleNoise = Math.sin(pt.y * 0.04) * 10;
        const laceOffset = 42 + bubbleNoise; 
        
        const radius = 2.0 + Math.abs(Math.sin(pt.y * 0.1)) * 4.0;
        this.laceGraphics.circle(pt.x + laceOffset, pt.y, radius);
      }
      this.laceGraphics.fill({ color: 0xffffff, alpha: laceAlpha });
    }

    // 3. МЯГКАЯ ТЕНЬ НАБЕГАЮЩЕГО ВАЛА
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 10 + Math.sin(pt.y * 0.01) * 5;
      const offset = waveAdvance + multiNoise - 18;

      if (i === 0) this.waveShadowGraphics.moveTo(pt.x + offset, pt.y);
      else this.waveShadowGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waveShadowGraphics.stroke({ color: 0x032d38, width: 48, alpha: 0.35 });

    // 4. ПРОЗРАЧНАЯ БИРЮЗОВАЯ ВОДЯНАЯ ПОДУШКА
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const multiNoise = Math.sin(pt.y * 0.003 + this.time * 0.7) * 10 + Math.sin(pt.y * 0.01) * 5;
      const offset = waveAdvance + multiNoise - 6;

      if (i === 0) this.waterBaseGraphics.moveTo(pt.x + offset, pt.y);
      else this.waterBaseGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waterBaseGraphics.stroke({ color: 0x22a8bd, width: 38, alpha: 0.55 });

    // 5. РВАНАЯ ПЕНА ПРИБОЯ (Языки пены)
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
