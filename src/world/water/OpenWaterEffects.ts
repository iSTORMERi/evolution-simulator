// src/world/water/OpenWaterEffects.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface WaveBreaker {
  x: number;
  y: number;
  radius: number;
  progress: number; // 0..1 (от рождения до затухания)
  speed: number;
  maxTravel: number; // Дистанция движения к берегу
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
    // Увеличили количество барашков до 15 для большей плотности эффектов
    for (let i = 0; i < 15; i++) {
      if (this.shorePoints.length === 0) break;

      const randomPoint = this.shorePoints[Math.floor(Math.random() * this.shorePoints.length)];
      this.waveBreakers.push({
        x: randomPoint.x - 200 - Math.random() * 400, // Глубокая вода левее берега
        y: randomPoint.y + (Math.random() - 0.5) * 200,
        radius: 70 + Math.random() * 60, // Увеличенный радиус дуги
        progress: Math.random(),
        speed: 0.15 + Math.random() * 0.1,
        maxTravel: 100 + Math.random() * 80,
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
        arc.x = randomPoint.x - 250 - Math.random() * 350;
        arc.y = randomPoint.y + (Math.random() - 0.5) * 200;
        arc.radius = 70 + Math.random() * 60;
      }

      // Движение барашка волны в сторону берега (влево -> вправо)
      const currentX = arc.x + arc.progress * arc.maxTravel;
      // Плавное появление и затухание через синус
      const alpha = Math.sin(arc.progress * Math.PI); 

      // Динамическое расширение дуги по мере приближения к берегу
      const currentRadius = arc.radius + arc.progress * 15;

      // 1. Тёмная тень передней кромки волны
      this.breakersGraphics.arc(currentX - 4, arc.y, currentRadius, -0.6, 0.6);
      this.breakersGraphics.stroke({ color: 0x053340, width: 8, alpha: alpha * 0.45 });

      // 2. Бирюзовая подложка воды
      this.breakersGraphics.arc(currentX - 1, arc.y, currentRadius, -0.55, 0.55);
      this.breakersGraphics.stroke({ color: 0x229bb3, width: 6, alpha: alpha * 0.6 });

      // 3. Белоснежный гребень пены
      this.breakersGraphics.arc(currentX, arc.y, currentRadius, -0.5, 0.5);
      this.breakersGraphics.stroke({ color: 0xffffff, width: 4.5, alpha: alpha * 0.9 });
    }
  }
}
