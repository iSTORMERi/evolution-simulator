// src/world/water/Waves.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface FrontWave {
  id: number;
  startIndex: number;
  endIndex: number;
  offset: number;     // Дистанция от берега
  maxOffset: number;  // Начальная точка спавна
  speed: number;
  length: number;
  isMajor: boolean;
}

export class Waves {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private shorePoints: ShorePoint[] = [];
  private activeWaves: FrontWave[] = [];

  private spawnTimer: number = 0;
  private maxActiveWaves: number = 8; // Оптимальное количество для эстетичного вида

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    this.activeWaves = [];
    
    if (this.shorePoints.length > 10) {
      // Равномерно заполняем пространство несколькими аккуратными волнами
      for (let i = 0; i < 4; i++) {
        this.spawnWave(true);
      }
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.shorePoints || this.shorePoints.length < 10) return;

    // Редкий, естественный спавн волн
    this.spawnTimer += deltaSeconds;
    if (this.spawnTimer >= 0.8 && this.activeWaves.length < this.maxActiveWaves) {
      this.spawnWave(false);
      this.spawnTimer = 0;
    }

    this.graphics.clear();

    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];

      wave.offset -= deltaSeconds * wave.speed;

      // Убираем волну незадолго до полного касания берега (чтобы не было нагромождения)
      if (wave.offset <= 8) {
        this.activeWaves.splice(i, 1);
        continue;
      }

      this.renderParallelWave(wave);
    }
  }

  private spawnWave(randomProgress: boolean): void {
    const totalPoints = this.shorePoints.length;
    if (totalPoints < 15) return;

    // Короткие естественные дуги (15–30% от длины берега)
    const wavePointLength = Math.floor(totalPoints * (0.15 + Math.random() * 0.15)); 
    const maxStartIndex = totalPoints - wavePointLength - 1;
    if (maxStartIndex <= 0) return;

    const startIndex = Math.floor(Math.random() * maxStartIndex);
    const endIndex = startIndex + wavePointLength;

    // Глубокий спавн в океане (120–280px от берега)
    const maxOffset = 140 + Math.random() * 140; 
    const initialOffset = randomProgress ? 20 + Math.random() * maxOffset : maxOffset;

    const isMajor = Math.random() < 0.35;

    this.activeWaves.push({
      id: Math.random(),
      startIndex,
      endIndex,
      offset: initialOffset,
      maxOffset,
      speed: 22 + Math.random() * 12,
      length: wavePointLength,
      isMajor,
    });
  }

  private renderParallelWave(wave: FrontWave): void {
    const points: { x: number; y: number; edgeAlpha: number; nx: number; ny: number }[] = [];

    for (let i = wave.startIndex; i <= wave.endIndex; i++) {
      const curr = this.shorePoints[i];
      const prev = this.shorePoints[Math.max(0, i - 1)];
      const next = this.shorePoints[Math.min(this.shorePoints.length - 1, i + 1)];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;

      const nx = -dy / len;
      const ny = dx / len;

      const relativeIdx = i - wave.startIndex;
      // Синусоидальное затухание по краям самой волны (гладкие кончики)
      const edgeFactor = Math.sin((relativeIdx / wave.length) * Math.PI);

      points.push({
        x: curr.x + nx * wave.offset,
        y: curr.y + ny * wave.offset,
        edgeAlpha: edgeFactor,
        nx,
        ny
      });
    }

    if (points.length < 2) return;

    // Прогресс пути: 1 (глубина) -> 0 (берег)
    const progress = wave.offset / wave.maxOffset;
    
    // Альфа-профиль: плавный прояв в глубине и плавное таяние у берега
    let lifeAlpha = 1;
    if (progress > 0.75) {
      lifeAlpha = (1 - progress) / 0.25; // Проявление из океана
    } else if (progress < 0.2) {
      lifeAlpha = progress / 0.2; // Таяние у прибоя
    }

    // 1. Мягкая тень основания волны
    const shadowWidth = wave.isMajor ? 18 : 12;
    this.drawStroke(points, lifeAlpha * 0.35, 0x042c38, shadowWidth, 0);

    // 2. Яркое лазурное тело
    const bodyWidth = wave.isMajor ? 9 : 6;
    this.drawStroke(points, lifeAlpha * 0.75, 0x32cde3, bodyWidth, 1.5);

    // 3. Тонкий беловатый гребень пены
    const crestWidth = wave.isMajor ? 4.5 : 2.5;
    this.drawStroke(points, lifeAlpha * 0.9, 0xffffff, crestWidth, 3);
  }

  private drawStroke(
    points: { x: number; y: number; edgeAlpha: number; nx: number; ny: number }[],
    baseAlpha: number,
    color: number,
    lineWidth: number,
    advanceOffset: number
  ): void {
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Сглаживание прозрачности на концах дуги
      const segmentAlpha = baseAlpha * Math.pow((p1.edgeAlpha + p2.edgeAlpha) / 2, 1.5);
      if (segmentAlpha < 0.02) continue;

      const x1 = p1.x + p1.nx * advanceOffset;
      const y1 = p1.y + p1.ny * advanceOffset;
      const x2 = p2.x + p2.nx * advanceOffset;
      const y2 = p2.y + p2.ny * advanceOffset;

      this.graphics.moveTo(x1, y1);
      this.graphics.lineTo(x2, y2);
      this.graphics.stroke({ color, width: lineWidth, alpha: segmentAlpha, cap: 'round' });
    }
  }
}
