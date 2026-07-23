// src/world/water/ShoreEffects.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

export class ShoreEffects {
  public container: PIXI.Container;

  private wetSandGraphics: PIXI.Graphics;       // Огромный массив мокрого песка
  private shallowWaterGraphics: PIXI.Graphics; // Прозрачный пласт набегающей воды
  private foamLaceGraphics: PIXI.Graphics;     // Переплетенные косы пены
  private residualFoamGraphics: PIXI.Graphics; // Пузыри и кружево пены

  private time: number = 0;
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();

    this.wetSandGraphics = new PIXI.Graphics();
    this.shallowWaterGraphics = new PIXI.Graphics();
    this.residualFoamGraphics = new PIXI.Graphics();
    this.foamLaceGraphics = new PIXI.Graphics();

    // Слои: 1. Мокрый песок -> 2. Вода -> 3. Пузыри -> 4. Косы пены
    this.container.addChild(this.wetSandGraphics);
    this.container.addChild(this.shallowWaterGraphics);
    this.container.addChild(this.residualFoamGraphics);
    this.container.addChild(this.foamLaceGraphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
  }

  public update(deltaSeconds: number): void {
    this.time += deltaSeconds;

    if (this.shorePoints.length === 0) return;

    this.wetSandGraphics.clear();
    this.shallowWaterGraphics.clear();
    this.residualFoamGraphics.clear();
    this.foamLaceGraphics.clear();

    // Расчет движения волны
    const cycle = Math.sin(this.time * 0.9);
    const swash = Math.pow((cycle + 1) / 2, 0.7); // 0.0 -> 1.0
    const waveAdvance = swash * 55;

    // === 1. МАССИВНАЯ ЗОНА МОКРОГО ПЕСКА (Увеличенная в разы) ===
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const wetNoise = Math.sin(pt.y * 0.002 + this.time * 0.15) * 16;
      // Сдвигаем глубоко на берег
      const offset = 65 + wetNoise;
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    // Ширина 220px укрывает весь прибрежный песок сочной тёмной влажностью
    this.wetSandGraphics.stroke({ color: 0x221508, width: 220, alpha: 0.35 });

    // === 2. ДВИЖУЩАЯСЯ ЛАЗУРНАЯ ВОДА (Без лишних задних полос) ===
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const waterNoise = Math.sin(pt.y * 0.003 + this.time * 0.8) * 10 + Math.sin(pt.y * 0.01) * 5;
      const offset = waveAdvance + waterNoise - 10;

      if (i === 0) this.shallowWaterGraphics.moveTo(pt.x + offset, pt.y);
      else this.shallowWaterGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.shallowWaterGraphics.stroke({ color: 0x42e3f0, width: 75, alpha: 0.4 });

    // === 3. ОСТАТОЧНЫЕ ПУЗЫРИ ПЕНЫ НА ПЕСКЕ И В МОРЕ ===
    // В море до наката
    const seaFoamAlpha = (1 - swash) * 0.45;
    if (seaFoamAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 3) {
        const pt = this.shorePoints[i];
        const seaNoise = Math.sin(pt.y * 0.03 + this.time) * 12;
        const seaOffset = -10 + seaNoise;
        this.residualFoamGraphics.circle(pt.x + seaOffset, pt.y, 2 + Math.abs(Math.sin(pt.y)) * 3);
      }
      this.residualFoamGraphics.fill({ color: 0xe0ffff, alpha: seaFoamAlpha });
    }

    // На песке после отката
    const shoreLaceAlpha = Math.max(0, (1 - swash) * 0.7);
    if (shoreLaceAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 2) {
        const pt = this.shorePoints[i];
        const sandLaceNoise = Math.sin(pt.y * 0.04) * 16;
        const laceOffset = 50 + sandLaceNoise;
        
        const bubbleSize = 2.5 + Math.sin(pt.y * 0.2) * 2.5;
        this.residualFoamGraphics.circle(pt.x + laceOffset, pt.y, bubbleSize);
      }
      this.residualFoamGraphics.fill({ color: 0xffffff, alpha: shoreLaceAlpha });
    }

    // === 4. ПЕРЕПЛЕТЁННЫЕ КОСЫ ПЕНЫ ===
    const strandConfigs = [
      { width: 16, alpha: 0.85, speed: 1.0, freq1: 0.003, freq2: 0.015, shift: 0 },
      { width: 10, alpha: 0.65, speed: 1.3, freq1: 0.006, freq2: 0.025, shift: -7 },
      { width: 6,  alpha: 0.50, speed: 0.8, freq1: 0.002, freq2: 0.030, shift: +6 },
    ];

    strandConfigs.forEach(config => {
      for (let i = 0; i < this.shorePoints.length; i++) {
        const pt = this.shorePoints[i];
        const wave1 = Math.sin(pt.y * config.freq1 + this.time * config.speed * 1.2) * 14;
        const wave2 = Math.cos(pt.y * config.freq2 + this.time * config.speed * 1.8) * 8;
        const offset = waveAdvance + wave1 + wave2 + config.shift;

        if (i === 0) this.foamLaceGraphics.moveTo(pt.x + offset, pt.y);
        else this.foamLaceGraphics.lineTo(pt.x + offset, pt.y);
      }
      this.foamLaceGraphics.stroke({ color: 0xf2ffff, width: config.width, alpha: config.alpha });
    });

    // Белоснежный тонкий фронт
    for (let i = 0; i < this.shorePoints.length; i += 2) {
      const pt = this.shorePoints[i];
      const crestNoise = Math.sin(pt.y * 0.003 + this.time * 1.2) * 14 + Math.cos(pt.y * 0.015 + this.time * 1.8) * 8;
      const offset = waveAdvance + crestNoise + 2;

      if (i === 0) this.foamLaceGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamLaceGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamLaceGraphics.stroke({ color: 0xffffff, width: 5, alpha: 0.95 });
  }
}
