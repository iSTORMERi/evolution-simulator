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

  private time: number = 0;
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();

    this.wetSandGraphics = new PIXI.Graphics();
    this.waveShadowGraphics = new PIXI.Graphics();
    this.waterBaseGraphics = new PIXI.Graphics();
    this.foamGraphics = new PIXI.Graphics();

    // Порядок слоев: Мокрый песок -> Тень вала -> Водяная подложка -> Пена
    this.container.addChild(this.wetSandGraphics);
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

    // Асимметричная фаза наката/отката (swash phase)
    const rawCycle = Math.sin(this.time * 1.2);
    const swashPhase = Math.pow((rawCycle + 1) / 2, 0.7); 
    const waveAdvance = swashPhase * 45; // Увеличенный ход волны в сторону берега

    // 1. Мокрый песок (широкая темная полоса на суше после отхода воды)
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      // Низкочастотный плавный шум по пространственной координате Y
      const organicNoise = Math.sin(pt.y * 0.003 + this.time * 0.4) * 12;
      const offset = 25 + organicNoise;
      
      if (i === 0) this.wetSandGraphics.moveTo(pt.x + offset, pt.y);
      else this.wetSandGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.wetSandGraphics.stroke({ color: 0x1f140a, width: 65, alpha: 0.22 });

    // 2. Глубокая тень приподнятой волны
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const waveNoise = Math.sin(pt.y * 0.005 + this.time * 0.8) * 10;
      const offset = waveAdvance + waveNoise - 20;

      if (i === 0) this.waveShadowGraphics.moveTo(pt.x + offset, pt.y);
      else this.waveShadowGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waveShadowGraphics.stroke({ color: 0x032d38, width: 40, alpha: 0.4 });

    // 3. Полупрозрачная бирюзовая подложка набегающего вала
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const waveNoise = Math.sin(pt.y * 0.005 + this.time * 0.8) * 10;
      const offset = waveAdvance + waveNoise - 10;

      if (i === 0) this.waterBaseGraphics.moveTo(pt.x + offset, pt.y);
      else this.waterBaseGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.waterBaseGraphics.stroke({ color: 0x22a8bd, width: 32, alpha: 0.5 });

    // 4. Основное тело бежево-белой бурлящей пены
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const foamNoise = Math.sin(pt.y * 0.008 + this.time * 1.5) * 8;
      const offset = waveAdvance + foamNoise - 4;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xebf7f7, width: 24, alpha: 0.75 });

    // 5. Белоснежная тонкая кромка переднего края прибоя
    for (let i = 0; i < this.shorePoints.length; i++) {
      const pt = this.shorePoints[i];
      const crestNoise = Math.cos(pt.y * 0.01 + this.time * 1.8) * 5;
      const offset = waveAdvance + crestNoise;

      if (i === 0) this.foamGraphics.moveTo(pt.x + offset, pt.y);
      else this.foamGraphics.lineTo(pt.x + offset, pt.y);
    }
    this.foamGraphics.stroke({ color: 0xffffff, width: 10, alpha: 0.95 });
  }
}
