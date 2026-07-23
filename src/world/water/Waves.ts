// src/world/water/Waves.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface FrontWave {
  id: number;
  startIndex: number;
  endIndex: number;
  offset: number;     // Дистанция от берега (в пикселях)
  maxOffset: number;  // Начальная дистанция спавна (например, 120px)
  speed: number;
  alpha: number;
  length: number;
  isMajor: boolean;
}

export class Waves {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private shorePoints: ShorePoint[] = [];
  private activeWaves: FrontWave[] = [];

  private spawnTimer: number = 0;
  private maxActiveWaves: number = 8; // Много плотных фронтов

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    this.activeWaves = [];
    
    // При старте заполняем сразу несколькими волнами на разной дистанции
    if (this.shorePoints.length > 10) {
      for (let i = 0; i < 5; i++) {
        this.spawnWave(true);
      }
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.shorePoints || this.shorePoints.length < 10) return;

    // Таймер спавна
    this.spawnTimer += deltaSeconds;
    if (this.spawnTimer >= 0.4 && this.activeWaves.length < this.maxActiveWaves) {
      this.spawnWave(false);
      this.spawnTimer = 0;
    }

    this.graphics.clear();

    // Обновляем и рендерим волны
    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];

      // Волна движется К БЕРЕГУ (уменьшаем offset до 0)
      wave.offset -= deltaSeconds * wave.speed;

      if (wave.offset <= 5) {
        this.activeWaves.splice(i, 1);
        continue;
      }

      this.renderParallelWave(wave);
    }
  }

  private spawnWave(randomProgress: boolean): void {
    const totalPoints = this.shorePoints.length;
    if (totalPoints < 15) return;

    // Длина волны вдоль берега (в количестве точек)
    const wavePointLength = Math.floor(25 + Math.random() * 45); 
    const maxStartIndex = totalPoints - wavePointLength - 1;
    if (maxStartIndex <= 0) return;

    const startIndex = Math.floor(Math.random() * maxStartIndex);
    const endIndex = startIndex + wavePointLength;

    const maxOffset = 100 + Math.random() * 80; // Начинают в 100-180px от берега
    const initialOffset = randomProgress ? Math.random() * maxOffset : maxOffset;

    const isMajor = Math.random() < 0.4;

    this.activeWaves.push({
      id: Math.random(),
      startIndex,
      endIndex,
      offset: initialOffset,
      maxOffset,
      speed: 25 + Math.random() * 15, // Скорость движения к берегу
      alpha: 1,
      length: wavePointLength,
      isMajor,
    });
  }

  private renderParallelWave(wave: FrontWave): void {
    const points: { x: number; y: number; edgeAlpha: number }[] = [];

    // Вычисляем параллельные точки со смещением влево (в океан)
    for (let i = wave.startIndex; i <= wave.endIndex; i++) {
      const curr = this.shorePoints[i];
      const prev = this.shorePoints[Math.max(0, i - 1)];
      const next = this.shorePoints[Math.min(this.shorePoints.length - 1, i + 1)];

      // Касательный вектор вдоль берега
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;

      // Нормаль наружу (в сторону воды, т.е. влево)
      const nx = -dy / len;
      const ny = dx / len;

      // Прозрачность по краям волны (затухание на концах дуги)
      const relativeIdx = i - wave.startIndex;
      const edgeFactor = Math.sin((relativeIdx / wave.length) * Math.PI);

      // Координата с перпендикулярным сдвигом в океан
      points.push({
        x: curr.x + nx * wave.offset,
        y: curr.y + ny * wave.offset,
        edgeAlpha: edgeFactor,
      });
    }

    if (points.length < 2) return;

    // Прогресс движения (1 -> зарождение в глубине, 0 -> прибой у берега)
    const progress = wave.offset / wave.maxOffset;
    
    // Прозрачность волны (плавное появление и затухание у самого берега)
    let globalAlpha = 1;
    if (progress > 0.85) {
      globalAlpha = (1 - progress) / 0.15; // Появление
    } else if (progress < 0.15) {
      globalAlpha = progress / 0.15; // Затухание у берега
    }

    // Рендерим линию сглаженными отрезками
    // 1. Тёмная глубинная тень
    this.drawCurvedLine(points, globalAlpha * (wave.isMajor ? 0.5 : 0.3), 0x053340, wave.isMajor ? 12 : 7, 0);

    // 2. Бирюзовое гребневое тело
    this.drawCurvedLine(points, globalAlpha * 0.75, 0x2ecbe0, wave.isMajor ? 6 : 4, 1.5);

    // 3. Белоснежная пена на вершине
    this.drawCurvedLine(points, globalAlpha * 0.9, 0xffffff, wave.isMajor ? 3.5 : 2, 3);
  }

  private drawCurvedLine(
    points: { x: number; y: number; edgeAlpha: number }[],
    baseAlpha: number,
    color: number,
    lineWidth: number,
    advanceOffset: number
  ): void {
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const segmentAlpha = baseAlpha * ((p1.edgeAlpha + p2.edgeAlpha) / 2);

      if (segmentAlpha < 0.02) continue;

      this.graphics.moveTo(p1.x + advanceOffset, p1.y);
      this.graphics.lineTo(p2.x + advanceOffset, p2.y);
      this.graphics.stroke({ color, width: lineWidth, alpha: segmentAlpha });
    }
  }
}
