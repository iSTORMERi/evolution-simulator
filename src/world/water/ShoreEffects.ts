// src/world/water/ShoreEffects.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

interface FoamParticle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  life: number; // время жизни пузырька на песке
}

export class ShoreEffects {
  public container: PIXI.Container;

  // Слои эффектов
  private oceanBaseGraphics: PIXI.Graphics; // Стационарная лазурная подложка
  private wetSandGraphics: PIXI.Graphics;   // Широкая зона мокрого песка
  private shallowWaterGraphics: PIXI.Graphics; // Движущийся широкий пласт лазурной воды
  private foamLaceGraphics: PIXI.Graphics;   // Переплетенные косы пены
  private residualFoamGraphics: PIXI.Graphics; // Остаточные островки пены на песке и в воде

  private time: number = 0;
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();

    this.oceanBaseGraphics = new PIXI.Graphics();
    this.wetSandGraphics = new PIXI.Graphics();
    this.shallowWaterGraphics = new PIXI.Graphics();
    this.foamLaceGraphics = new PIXI.Graphics();
    this.residualFoamGraphics = new PIXI.Graphics();

    // Иерархия слоев от нижней к верхней
    this.container.addChild(this.oceanBaseGraphics);
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

    this.oceanBaseGraphics.clear();
    this.wetSandGraphics.clear();
    this.shallowWaterGraphics.clear();
    this.foamLaceGraphics.clear();
    this.residualFoamGraphics.clear();

    // === 1. РАСЧЕТ ДИНАМИКИ ВОЛНЫ (Накат / Откат) ===
    // Асимметричная фаза: быстрый накат, медленный откат
    const cycle = Math.sin(this.time * 0.9);
    const swash = Math.pow((cycle + 1) / 2, 0.7); // 0.0 (полный откат) -> 1.0 (максимальный накат)
    
    const maxSwashDistance = 55; // Насколько далеко волна заходит на песок
    const waveOffset = swash * maxSwashDistance;

    // === 2. СТАЦИОНАРНАЯ ЛАЗУРНАЯ ПОДЛОЖКА (Закрывает зазоры, цвет прибрежной лазури) ===
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const organicCurve = Math.sin(pt.y * 0.002) * 8;
      const offset = -40 + organicCurve; // Уходит глубоко в сторону моря
      
      if (i === 0) this.oceanBaseGraphics.moveTo(pt.x + offset, pt.y);
      else this.oceanBaseGraphics.lineTo(pt.x + offset, pt.y);
    }
    // Широкий плотный массив цвета прибрежной лазурной воды
    this.oceanBaseGraphics.stroke({ color: 0x24cad8, width: 160, alpha: 0.95 });


    // === 3. ЗОНА МОКРОГО ПЕСКА (Широкая полоса на границе суши) ===
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      // Медленно меняющийся рельеф намокания
      const wetNoise = Math.sin(pt.y * 0.004 + this.time * 0.15) * 12;
      const offset = 35 + wetNoise; // Располагается прямо на светлом песке
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    // Сочная широкая полоса темного мокрого песка (ширина 90px)
    this.wetSandGraphics.stroke({ color: 0x22160a, width: 90, alpha: 0.32 });


    // === 4. ДВИЖУЩИЙСЯ ПЛАСТ МЕЛКОВОДНОЙ ВОДЫ (Лазурный массив) ===
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const waterNoise = Math.sin(pt.y * 0.003 + this.time * 0.8) * 10 + Math.sin(pt.y * 0.01) * 5;
      const offset = waveOffset + waterNoise - 15;

      if (i === 0) this.shallowWaterGraphics.moveTo(pt.x + offset, pt.y);
      else this.shallowWaterGraphics.lineTo(pt.x + offset, pt.y);
    }
    // Яркая полупрозрачная лазурная вода, затапливающая берег (ширина 80px)
    this.shallowWaterGraphics.stroke({ color: 0x42e3f0, width: 80, alpha: 0.45 });


    // === 5. ОСТАТОЧНАЯ ПЕНА (В море до наката и на песке после отката) ===
    // А) Пена в море (заметна на фазе отката/затишья)
    const seaFoamAlpha = (1 - swash) * 0.4;
    if (seaFoamAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 3) {
        const pt = this.shorePoints[i];
        const seaNoise = Math.sin(pt.y * 0.03 + this.time) * 12;
        const seaOffset = -15 + seaNoise;
        this.residualFoamGraphics.circle(pt.x + seaOffset, pt.y, 2 + Math.abs(Math.sin(pt.y)) * 3);
      }
      this.residualFoamGraphics.fill({ color: 0xe0ffff, alpha: seaFoamAlpha });
    }

    // Б) Остаточное кружево на песке (остается впереди, когда волна уходит назад)
    const shoreLaceAlpha = Math.max(0, (1 - swash) * 0.65);
    if (shoreLaceAlpha > 0.05) {
      for (let i = 0; i < this.shorePoints.length; i += 2) {
        const pt = this.shorePoints[i];
        const sandLaceNoise = Math.sin(pt.y * 0.05) * 14;
        const laceOffset = 42 + sandLaceNoise; // Вынесена далеко на берег
        
        const bubbleSize = 2.5 + Math.sin(pt.y * 0.2) * 2;
        this.residualFoamGraphics.circle(pt.x + laceOffset, pt.y, bubbleSize);
      }
      this.residualFoamGraphics.fill({ color: 0xffffff, alpha: shoreLaceAlpha });
    }


    // === 6. КОРСЕТ / КОСЫ ПЕНЫ (Неоднородная сетка из переплетающихся линий) ===
    // Вместо 1 линии рисуем 3 перекрещивающиеся нити с разными частотами шума:
    const strandConfigs = [
      { width: 18, alpha: 0.85, speed: 1.0, freq1: 0.003, freq2: 0.015, shift: 0 },   // Главный фронт
      { width: 10, alpha: 0.65, speed: 1.3, freq1: 0.006, freq2: 0.025, shift: -8 },  // Внутренняя коса
      { width: 7,  alpha: 0.50, speed: 0.8, freq1: 0.002, freq2: 0.030, shift: +6 },  // Внешняя рваная жила
    ];

    strandConfigs.forEach(config => {
      for (let i = 0; i < this.shorePoints.length; i++) {
        const pt = this.shorePoints[i];
        
        // Сложный интерферирующий шум для создания ажурных "кос"
        const wave1 = Math.sin(pt.y * config.freq1 + this.time * config.speed * 1.2) * 14;
        const wave2 = Math.cos(pt.y * config.freq2 + this.time * config.speed * 1.8) * 8;
        const offset = waveOffset + wave1 + wave2 + config.shift;

        if (i === 0) this.foamLaceGraphics.moveTo(pt.x + offset, pt.y);
        else this.foamLaceGraphics.lineTo(pt.x + offset, pt.y);
      }
      this.foamLaceGraphics.stroke({ color: 0xf2ffff, width: config.width, alpha: config.alpha });
    });

    // Белоснежные яркие акценты в узлах переплетения пены
    for (let i = 0; i < this.shorePoints.length; i += 2) {
      const pt = this.shorePoints[i];
      const crestNoise = Math.sin(pt.y * 0.003 + this.time * 1.2) * 14 + Math.cos(pt.y * 0.015 + this.time * 1.8) * 8;
      const offset = waveOffset + crestNoise + 2;

      if (i === 0) this.foamLaceGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamLaceGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamLaceGraphics.stroke({ color: 0xffffff, width: 6, alpha: 0.95 });
  }
}
