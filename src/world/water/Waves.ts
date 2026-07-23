// water/Waves.ts

import * as PIXI from 'pixi.js';

export interface ShorePoint {
  x: number;
  y: number;
}

interface WaveInstance {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  
  length: number;
  curvature: number;
  isMajor: boolean;
  
  progress: number; // 0.0 -> 1.0
  speed: number;
  maxAlpha: number;
}

export class Waves {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private waves: WaveInstance[] = [];
  private shorePoints: ShorePoint[] = [];
  
  private spawnTimer: number = 0;
  private nextSpawnInterval: number = 1.0;
  private waveIdCounter: number = 0;

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
  }

  public update(deltaSeconds: number): void {
    if (this.shorePoints.length < 2) return;

    this.spawnTimer += deltaSeconds;
    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnWave();
      this.spawnTimer = 0;
      this.nextSpawnInterval = 0.7 + Math.random() * 1.3;
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
    const shoreIndex = Math.floor(Math.random() * (this.shorePoints.length - 10)) + 5;
    const targetPt = this.shorePoints[shoreIndex];

    const prevPt = this.shorePoints[Math.max(0, shoreIndex - 5)];
    const nextPt = this.shorePoints[Math.min(this.shorePoints.length - 1, shoreIndex + 5)];
    
    const shoreAngle = Math.atan2(nextPt.y - prevPt.y, nextPt.x - prevPt.x);
    // Вектор строго на берег
    const waveAngle = shoreAngle - Math.PI / 2;

    // Спавн в океане (дистанция 130 - 220px от берега)
    const startDistance = 130 + Math.random() * 90;
    const startX = targetPt.x - Math.cos(waveAngle) * startDistance;
    const startY = targetPt.y - Math.sin(waveAngle) * startDistance;

    // 25% крупных волн, 75% мелких
    const isMajor = Math.random() < 0.25;
    const length = isMajor ? 250 + Math.random() * 130 : 80 + Math.random() * 90;

    this.waves.push({
      id: this.waveIdCounter++,
      x: startX,
      y: startY,
      targetX: targetPt.x,
      targetY: targetPt.y,
      angle: waveAngle,
      length: length,
      curvature: 20 + Math.random() * 12,
      isMajor: isMajor,
      progress: 0,
      speed: isMajor ? 0.20 + Math.random() * 0.06 : 0.30 + Math.random() * 0.10,
      maxAlpha: isMajor ? 0.95 : 0.75,
    });
  }

  private renderWave(wave: WaveInstance): void {
    const currentX = wave.x + (wave.targetX - wave.x) * wave.progress;
    const currentY = wave.y + (wave.targetY - wave.y) * wave.progress;

    // Плавное появление (0-0.2) и затухание у прибоя (0.75-1.0)
    let currentAlpha = wave.maxAlpha;
    if (wave.progress < 0.2) {
      currentAlpha *= (wave.progress / 0.2);
    } else if (wave.progress > 0.75) {
      currentAlpha *= (1 - (wave.progress - 0.75) / 0.25);
    }

    const foamFactor = Math.min(1.0, wave.progress * 1.3);
    const perpAngle = wave.angle + Math.PI / 2;

    const segments = 16;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) - 0.5;
      const distAlongFront = t * wave.length;
      // Параболический изгиб: центр вырывается ВПЕРЕД к берегу
      const curveForward = (1 - 4 * t * t) * wave.curvature;

      const px = currentX + Math.cos(perpAngle) * distAlongFront + Math.cos(wave.angle) * curveForward;
      const py = currentY + Math.sin(perpAngle) * distAlongFront + Math.sin(wave.angle) * curveForward;

      points.push({ x: px, y: py });
    }

    // 1. Темный массивный вал сзади
    const shadowWidth = wave.isMajor ? 26 : 14;
    this.graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.graphics.lineTo(points[i].x, points[i].y);
    }
    this.graphics.stroke({ color: 0x0a4d58, width: shadowWidth, alpha: currentAlpha * 0.7 });

    // 2. Яркое бирюзовое тело волны
    const bodyWidth = wave.isMajor ? 16 : 9;
    this.graphics.moveTo(
      points[0].x + Math.cos(wave.angle) * 3, 
      points[0].y + Math.sin(wave.angle) * 3
    );
    for (let i = 1; i < points.length; i++) {
      this.graphics.lineTo(
        points[i].x + Math.cos(wave.angle) * 3, 
        points[i].y + Math.sin(wave.angle) * 3
      );
    }
    this.graphics.stroke({ color: 0x36d5e3, width: bodyWidth, alpha: currentAlpha * 0.85 });

    // 3. Белоснежный пенистый гребень спереди
    const crestWidth = (wave.isMajor ? 9 : 5) * foamFactor;
    this.graphics.moveTo(
      points[0].x + Math.cos(wave.angle) * 6, 
      points[0].y + Math.sin(wave.angle) * 6
    );
    for (let i = 1; i < points.length; i++) {
      const noise = Math.sin(i * 1.5 + wave.id) * 2;
      this.graphics.lineTo(
        points[i].x + Math.cos(wave.angle) * (6 + noise), 
        points[i].y + Math.sin(wave.angle) * (6 + noise)
      );
    }
    this.graphics.stroke({ color: 0xffffff, width: Math.max(2, crestWidth), alpha: currentAlpha * 0.95 });
  }
}
