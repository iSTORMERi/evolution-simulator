// src/world/water/OpenWaterEffects.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface WaveBreaker {
  x: number;
  y: number;
  radius: number;
  progress: number; // 0..1 (от рождения до затухания)
  speed: number;
}

export class OpenWaterEffects {
  public container: PIXI.Container;

  private breakersGraphics: PIXI.Graphics;
  private waveBreakers: WaveBreaker[] = [];
  private shorePoints: ShorePoint[] = [];

  constructor() {
    this.container = new PIXI.Container();
    this.breakersGraphics = new PIXI.Graphics();
    this.container.addChild(this.breakersGraphics);
  }

  public init(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    this.spawnBreakers();
  }

  private spawnBreakers(): void {
    this.waveBreakers = [];
    for (let i = 0; i < 10; i++) {
      if (this.shorePoints.length === 0) break;

      const randomPoint = this.shorePoints[Math.floor(Math.random() * this.shorePoints.length)];
      this.waveBreakers.push({
        x: randomPoint.x - 100 - Math.random() * 200, // Глубокая вода левее берега
        y: randomPoint.y + (Math.random() - 0.5) * 300,
        radius: 50 + Math.random() * 40,
        progress: Math.random(),
        speed: 0.12 + Math.random() * 0.08,
      });
    }
  }

  public update(deltaSeconds: number): void {
    if (this.shorePoints.length === 0) return;

    this.breakersGraphics.clear();

    for (const arc of this.waveBreakers) {
      arc.progress += deltaSeconds * arc.speed;

      if (arc.progress > 1) {
        arc.progress = 0;
        const randomPoint = this.shorePoints[Math.floor(Math.random() * this.shorePoints.length)];
        arc.x = randomPoint.x - 120 - Math.random() * 150;
        arc.y = randomPoint.y + (Math.random() - 0.5) * 300;
      }

      // Движение барашка волны в сторону берега
      const currentX = arc.x + arc.progress * 80;
      const alpha = Math.sin(arc.progress * Math.PI); // Прозрачность: 0 -> 1 -> 0

      // Тень волны
      this.breakersGraphics.beginPath();
      this.breakersGraphics.arc(currentX - 3, arc.y, arc.radius, -0.6, 0.6);
      this.breakersGraphics.stroke({ color: 0x0f4d5c, width: 5, alpha: alpha * 0.4 });

      // Белый гребень
      this.breakersGraphics.beginPath();
      this.breakersGraphics.arc(currentX, arc.y, arc.radius, -0.5, 0.5);
      this.breakersGraphics.stroke({ color: 0xffffff, width: 2.5, alpha: alpha * 0.8 });
    }
  }
}
