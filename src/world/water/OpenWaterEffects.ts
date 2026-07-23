// src/world/water/OpenWaterEffects.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface WaterCaustic {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
  phase: number;
}

export class OpenWaterEffects {
  public container: PIXI.Container;

  private oceanGraphics: PIXI.Graphics;
  private shorePoints: ShorePoint[] = [];
  private caustics: WaterCaustic[] = [];
  private time: number = 0;

  constructor() {
    this.container = new PIXI.Container();
    this.oceanGraphics = new PIXI.Graphics();
    this.container.addChild(this.oceanGraphics);
  }

  public init(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    this.initCaustics();
  }

  private initCaustics(): void {
    this.caustics = [];
    // Генерируем мягкие свечения/блики в глубокой воде
    for (let i = 0; i < 20; i++) {
      if (this.shorePoints.length === 0) break;

      const randomPoint = this.shorePoints[Math.floor(Math.random() * this.shorePoints.length)];
      this.caustics.push({
        x: randomPoint.x - 300 - Math.random() * 500, // Глубокая часть океана
        y: randomPoint.y + (Math.random() - 0.5) * 400,
        size: 30 + Math.random() * 50,
        alpha: 0.1 + Math.random() * 0.2,
        speed: 0.5 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public update(deltaSeconds: number): void {
    if (this.shorePoints.length === 0) return;

    this.time += deltaSeconds;
    this.oceanGraphics.clear();

    // Рендер мягких светлых бликов каустики на глубине
    for (const c of this.caustics) {
      const pulse = Math.sin(this.time * c.speed + c.phase);
      const currentAlpha = c.alpha * (0.6 + pulse * 0.4);
      const currentSize = c.size + pulse * 6;

      // Мягкое очертание глубокого блика
      this.oceanGraphics.ellipse(c.x, c.y, currentSize, currentSize * 0.6);
      this.oceanGraphics.fill({ color: 0x6ee2f5, alpha: currentAlpha });
    }
  }
}
