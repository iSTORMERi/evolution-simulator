// src/world/water/Waves.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface WaveInstance {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  waveAngle: number;
  length: number;
  curvature: number;
  isMajor: boolean;
  progress: number;
  speed: number;
  maxAlpha: number;
}

export class Waves {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private waves: WaveInstance[] = [];
  private shorePoints: ShorePoint[] = [];
  
  private spawnTimer: number = 0;
  private nextSpawnInterval: number = 0.5;

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    // Сразу генерируем пару волн при инициализации
    for (let i = 0; i < 3; i++) {
      this.spawnWave();
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.shorePoints || this.shorePoints.length < 2) return;

    this.spawnTimer += deltaSeconds;
    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnWave();
      this.spawnTimer = 0;
      this.nextSpawnInterval = 0.6 + Math.random() * 1.0;
    }

    this.graphics.clear();

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i];
      wave.progress += deltaSeconds * wave.speed;

      if (wave.progress >= 1.0) {
        this.waves.splice(i, 1);
        continue;
      }

      this.renderWave(wave);
    }
  }

  private spawnWave(): void {
    if (this.shorePoints.length < 10) return;

    const shoreIndex = Math.floor(Math.random() * (this.shorePoints.length - 10)) + 5;
    const targetPt = this.shorePoints[shoreIndex];

    // Вычисляем угол движения строго от глубокой воды (слева/сверху) к выбранной точке берега
    // Спавним точку старта на зафиксированном офсете в глубине океана (-150px по X, -100px по Y)
    const oceanOffsetX = -180 - Math.random() * 80;
    const oceanOffsetY = (Math.random() - 0.5) * 100;

    const startX = targetPt.x + oceanOffsetX;
    const startY = targetPt.y + oceanOffsetY;

    // Вектор от старта к цели
    const waveAngle = Math.atan2(targetPt.y - startY, targetPt.x - startX);

    const isMajor = Math.random() < 0.3;
    const length = isMajor ? 260 + Math.random() * 120 : 100 + Math.random() * 90;

    this.waves.push({
      id: Math.random(),
      startX: startX,
      startY: startY,
      targetX: targetPt.x,
      targetY: targetPt.y,
      waveAngle: waveAngle,
      length: length,
      curvature: 25 + Math.random() * 10,
      isMajor: isMajor,
      progress: Math.random() * 0.2, // Небольшой разброс начальной фазы
      speed: isMajor ? 0.22 + Math.random() * 0.06 : 0.35 + Math.random() * 0.1,
      maxAlpha: isMajor ? 0.95 : 0.8,
    });
  }

  private renderWave(wave: WaveInstance): void {
    const currentX = wave.startX + (wave.targetX - wave.startX) * wave.progress;
    const currentY = wave.startY + (wave.targetY - wave.startY) * wave.progress;

    // Прозрачность: рост -> пик -> угасание у берега
    let alpha = wave.maxAlpha;
    if (wave.progress < 0.15) {
      alpha *= (wave.progress / 0.15);
    } else if (wave.progress > 0.8) {
      alpha *= (1 - (wave.progress - 0.8) / 0.2);
    }

    const perpAngle = wave.waveAngle + Math.PI / 2;
    const segments = 16;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) - 0.5;
      const distAlongFront = t * wave.length;
      
      // Дуга ВЫГНУТА ВПЕРЕД по направлению движения (к берегу)
      const curveForward = (1 - 4 * t * t) * wave.curvature;

      const px = currentX + Math.cos(perpAngle) * distAlongFront + Math.cos(wave.waveAngle) * curveForward;
      const py = currentY + Math.sin(perpAngle) * distAlongFront + Math.sin(wave.waveAngle) * curveForward;

      points.push({ x: px, y: py });
    }

    // 1. Тёмная широкая тень волны сзади
    const shadowWidth = wave.isMajor ? 24 : 14;
    this.graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.graphics.lineTo(points[i].x, points[i].y);
    }
    this.graphics.stroke({ color: 0x074550, width: shadowWidth, alpha: alpha * 0.7 });

    // 2. Бирюзовое тело
    const bodyWidth = wave.isMajor ? 14 : 8;
    this.graphics.moveTo(
      points[0].x + Math.cos(wave.waveAngle) * 3, 
      points[0].y + Math.sin(wave.waveAngle) * 3
    );
    for (let i = 1; i < points.length; i++) {
      this.graphics.lineTo(
        points[i].x + Math.cos(wave.waveAngle) * 3, 
        points[i].y + Math.sin(wave.waveAngle) * 3
      );
    }
    this.graphics.stroke({ color: 0x36d5e3, width: bodyWidth, alpha: alpha * 0.85 });

    // 3. Белый передний гребень
    const crestWidth = wave.isMajor ? 8 : 4;
    this.graphics.moveTo(
      points[0].x + Math.cos(wave.waveAngle) * 6, 
      points[0].y + Math.sin(wave.waveAngle) * 6
    );
    for (let i = 1; i < points.length; i++) {
      this.graphics.lineTo(
        points[i].x + Math.cos(wave.waveAngle) * 6, 
        points[i].y + Math.sin(wave.waveAngle) * 6
      );
    }
    this.graphics.stroke({ color: 0xffffff, width: crestWidth, alpha: alpha * 0.95 });
  }
}
