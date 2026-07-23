// src/world/water/Waves.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface Wave {
  id: number;
  startIndex: number;
  endIndex: number;
  offset: number;     // Текущая дистанция от берега
  maxOffset: number;  // Начальная дистанция спавна
  speed: number;
  scale: number;      // Множитель размера
  isRipple: boolean;  // Мелкая рябь/барашек
}

export class Waves {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private shorePoints: ShorePoint[] = [];
  private activeWaves: Wave[] = [];

  private rippleTimer: number = 0;
  private majorTimer: number = 0;
  private maxActiveWaves: number = 14; // Достаточно для плотного живописного океана

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    this.activeWaves = [];
    
    if (this.shorePoints.length > 10) {
      // Спавним стартовый набор: пару крупных и несколько мелких
      for (let i = 0; i < 2; i++) this.spawnWave(true, false);
      for (let i = 0; i < 5; i++) this.spawnWave(true, true);
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.shorePoints || this.shorePoints.length < 10) return;

    // 1. Частый спавн мелких волн (каждые 0.4 сек)
    this.rippleTimer += deltaSeconds;
    if (this.rippleTimer >= 0.4 && this.activeWaves.length < this.maxActiveWaves) {
      this.spawnWave(false, true);
      this.rippleTimer = 0;
    }

    // 2. Редкий спавн крупных фронтов (каждые 3.0 сек)
    this.majorTimer += deltaSeconds;
    if (this.majorTimer >= 3.0 && this.activeWaves.length < this.maxActiveWaves) {
      this.spawnWave(false, false);
      this.majorTimer = 0;
    }

    this.graphics.clear();

    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];

      wave.offset -= deltaSeconds * wave.speed;

      if (wave.offset <= 2) {
        this.activeWaves.splice(i, 1);
        continue;
      }

      this.renderMassiveWave(wave);
    }
  }

  private spawnWave(randomProgress: boolean, isRipple: boolean): void {
    const totalPoints = this.shorePoints.length;
    if (totalPoints < 15) return;

    let scale: number;
    let lengthRatio: number;
    let maxOffset: number;
    let speed: number;

    if (isRipple) {
      // Параметры мелких волн-барашков
      scale = 0.25 + Math.random() * 0.3;          // Маленький размер
      lengthRatio = 0.08 + Math.random() * 0.12;   // Короткие дуги (8–20% от длины берега)
      maxOffset = 100 + Math.random() * 180;       // Зарождаются ближе к берегу
      speed = 22 + Math.random() * 15;
    } else {
      // Параметры крупных валов
      scale = 1.0 + Math.random() * 0.4;           // Впечатляющий массивный размер
      lengthRatio = 0.3 + Math.random() * 0.2;     // Длинные фронты
      maxOffset = 300 + Math.random() * 150;       // Далекий спавн в глубине
      speed = 18 + Math.random() * 8;
    }

    const lengthPoints = Math.floor(totalPoints * lengthRatio);
    const maxStartIndex = totalPoints - lengthPoints - 1;
    if (maxStartIndex <= 0) return;

    const startIndex = Math.floor(Math.random() * maxStartIndex);
    const endIndex = startIndex + lengthPoints;

    const initialOffset = randomProgress ? 15 + Math.random() * maxOffset : maxOffset;

    this.activeWaves.push({
      id: Math.random(),
      startIndex,
      endIndex,
      offset: initialOffset,
      maxOffset,
      speed,
      scale,
      isRipple,
    });
  }

  private renderMassiveWave(wave: Wave): void {
    const total = wave.endIndex - wave.startIndex;
    if (total < 2) return;

    const progress = wave.offset / wave.maxOffset;

    // Плавный прояв из океана и угасание у берега
    let lifeFade = 1;
    if (progress > 0.8) {
      lifeFade = (1 - progress) / 0.2;
    } else if (progress < 0.12) {
      lifeFade = progress / 0.12;
    }

    // Динамический рост толщины
    const growthFactor = Math.sin((1 - progress) * Math.PI * 0.85);
    const baseThickness = (6 + growthFactor * 26) * wave.scale;

    const frontEdge: { x: number; y: number }[] = [];
    const backEdge: { x: number; y: number }[] = [];

    for (let i = wave.startIndex; i <= wave.endIndex; i++) {
      const curr = this.shorePoints[i];
      const prev = this.shorePoints[Math.max(0, i - 1)];
      const next = this.shorePoints[Math.min(this.shorePoints.length - 1, i + 1)];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;

      const nx = -dy / len;
      const ny = dx / len;

      const relIndex = (i - wave.startIndex) / total;
      const shapeFactor = Math.sin(relIndex * Math.PI); // Форма капли/линзы
      const pointThickness = baseThickness * shapeFactor;

      frontEdge.push({
        x: curr.x + nx * wave.offset,
        y: curr.y + ny * wave.offset,
      });

      backEdge.push({
        x: curr.x + nx * (wave.offset + pointThickness),
        y: curr.y + ny * (wave.offset + pointThickness),
      });
    }

    if (frontEdge.length < 2) return;

    // --- 1. ТЕНЬ ВОЛНЫ ---
    this.graphics.beginPath();
    this.graphics.moveTo(frontEdge[0].x, frontEdge[0].y);
    for (let i = 1; i < frontEdge.length; i++) {
      this.graphics.lineTo(frontEdge[i].x, frontEdge[i].y);
    }
    const shadowOffset = wave.isRipple ? 2 : 4;
    for (let i = backEdge.length - 1; i >= 0; i--) {
      this.graphics.lineTo(backEdge[i].x + shadowOffset, backEdge[i].y + shadowOffset);
    }
    this.graphics.closePath();
    this.graphics.fill({ color: 0x02232d, alpha: (wave.isRipple ? 0.2 : 0.35) * lifeFade });

    // --- 2. БИРЮЗОВОЕ ТЕЛО ---
    const bodyAlpha = Math.max(0, (progress - 0.08) / 0.92) * 0.8 * lifeFade;
    if (bodyAlpha > 0.02) {
      this.graphics.beginPath();
      this.graphics.moveTo(frontEdge[0].x, frontEdge[0].y);
      for (let i = 1; i < frontEdge.length; i++) {
        this.graphics.lineTo(frontEdge[i].x, frontEdge[i].y);
      }
      for (let i = backEdge.length - 1; i >= 0; i--) {
        this.graphics.lineTo(backEdge[i].x, backEdge[i].y);
      }
      this.graphics.closePath();
      this.graphics.fill({ color: 0x22c2d6, alpha: bodyAlpha });
    }

    // --- 3. БЕЛАЯ ПЕНА ---
    const foamFactor = progress < 0.35 ? (1 - progress / 0.35) : 0;
    const foamAlpha = (0.35 + foamFactor * 0.6) * lifeFade;

    this.graphics.beginPath();
    this.graphics.moveTo(frontEdge[0].x, frontEdge[0].y);
    for (let i = 1; i < frontEdge.length; i++) {
      this.graphics.lineTo(frontEdge[i].x, frontEdge[i].y);
    }
    const foamSpread = 1 + foamFactor * (wave.isRipple ? 0.3 : 0.6);
    for (let i = backEdge.length - 1; i >= 0; i--) {
      const bx = frontEdge[i].x + (backEdge[i].x - frontEdge[i].x) * foamSpread;
      const by = frontEdge[i].y + (backEdge[i].y - frontEdge[i].y) * foamSpread;
      this.graphics.lineTo(bx, by);
    }
    this.graphics.closePath();
    this.graphics.fill({ color: 0xffffff, alpha: foamAlpha });
  }
}
