// src/world/water/Waves.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface Wave {
  id: number;
  startIndex: number;
  endIndex: number;
  offset: number;     // Текущая дистанция от берега
  maxOffset: number;  // Начальная дистанция спавна (глубокая вода)
  speed: number;
  scale: number;      // Множитель размера (крупная / мелкая)
  lengthPoints: number;
}

export class Waves {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private shorePoints: ShorePoint[] = [];
  private activeWaves: Wave[] = [];

  private spawnTimer: number = 0;
  private maxActiveWaves: number = 5; // Максимум 5 волн одновременно для высокого FPS

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    this.activeWaves = [];
    
    if (this.shorePoints.length > 10) {
      // Инициализируем 2–3 волнами на разной глубине
      for (let i = 0; i < 3; i++) {
        this.spawnWave(true);
      }
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.shorePoints || this.shorePoints.length < 10) return;

    // Редкий спавн для чистой картинки и производительности
    this.spawnTimer += deltaSeconds;
    if (this.spawnTimer >= 1.5 && this.activeWaves.length < this.maxActiveWaves) {
      this.spawnWave(false);
      this.spawnTimer = 0;
    }

    this.graphics.clear();

    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];

      // Движение строго к берегу
      wave.offset -= deltaSeconds * wave.speed;

      // Полное растворение уреза воды
      if (wave.offset <= 2) {
        this.activeWaves.splice(i, 1);
        continue;
      }

      this.renderMassiveWave(wave);
    }
  }

  private spawnWave(randomProgress: boolean): void {
    const totalPoints = this.shorePoints.length;
    if (totalPoints < 15) return;

    // 70% мелких/средних волн, 30% крупных
    const isLarge = Math.random() < 0.3;
    const scale = isLarge ? (1.4 + Math.random() * 0.4) : (0.6 + Math.random() * 0.5);

    // Длина волны вдоль береговой линии
    const lengthRatio = isLarge ? 0.35 : 0.18;
    const lengthPoints = Math.floor(totalPoints * lengthRatio);
    const maxStartIndex = totalPoints - lengthPoints - 1;
    if (maxStartIndex <= 0) return;

    const startIndex = Math.floor(Math.random() * maxStartIndex);
    const endIndex = startIndex + lengthPoints;

    // Далёкий спавн (300–450px в глубине океана)
    const maxOffset = 300 + Math.random() * 150;
    const initialOffset = randomProgress ? 20 + Math.random() * maxOffset : maxOffset;

    this.activeWaves.push({
      id: Math.random(),
      startIndex,
      endIndex,
      offset: initialOffset,
      maxOffset,
      speed: 20 + Math.random() * 10,
      scale,
      lengthPoints,
    });
  }

  private renderMassiveWave(wave: Wave): void {
    const total = wave.endIndex - wave.startIndex;
    if (total < 2) return;

    // Жизненный цикл волны: 1.0 (глубина) -> 0.0 (берег)
    const progress = wave.offset / wave.maxOffset;

    // Плавное появление из глубины (0 -> 1) и плавная смерть у берега
    let lifeFade = 1;
    if (progress > 0.8) {
      lifeFade = (1 - progress) / 0.2;
    } else if (progress < 0.15) {
      lifeFade = progress / 0.15;
    }

    // Динамический рост толщины тела волны по мере приближения к берегу
    const growthFactor = Math.sin((1 - progress) * Math.PI * 0.8);
    const baseThickness = (8 + growthFactor * 28) * wave.scale; 

    // Векторы переднего и заднего края волны
    const frontEdge: { x: number; y: number }[] = [];
    const backEdge: { x: number; y: number }[] = [];

    for (let i = wave.startIndex; i <= wave.endIndex; i++) {
      const curr = this.shorePoints[i];
      const prev = this.shorePoints[Math.max(0, i - 1)];
      const next = this.shorePoints[Math.min(this.shorePoints.length - 1, i + 1)];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;

      // Нормаль в океан
      const nx = -dy / len;
      const ny = dx / len;

      const relIndex = (i - wave.startIndex) / total;
      // Синусоидальное затухание по краям (форма линзы/капли)
      const shapeFactor = Math.sin(relIndex * Math.PI);
      const pointThickness = baseThickness * shapeFactor;

      // Передний край (гребень) и задний край (тень/тело)
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

    // --- 1. ТЕМНАЯ ОБЪЕМНАЯ ТЕНЬ (ПОД ВОЛНОЙ) ---
    this.graphics.beginPath();
    this.graphics.moveTo(frontEdge[0].x, frontEdge[0].y);
    for (let i = 1; i < frontEdge.length; i++) {
      this.graphics.lineTo(frontEdge[i].x, frontEdge[i].y);
    }
    for (let i = backEdge.length - 1; i >= 0; i--) {
      this.graphics.lineTo(backEdge[i].x + 4, backEdge[i].y + 4);
    }
    this.graphics.closePath();
    this.graphics.fill({ color: 0x02232d, alpha: 0.35 * lifeFade });

    // --- 2. МАССИВНОЕ БИРЮЗОВОЕ ТЕЛО ВОЛНЫ ---
    // По мере приближения к берегу тело волны превращается в пену (альфа падает)
    const bodyAlpha = Math.max(0, (progress - 0.1) / 0.9) * 0.85 * lifeFade;
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

    // --- 3. ТРАНСФОРМАЦИЯ В СГУСТОК ПЕНЫ (У БЕРЕГА) ---
    // Когда offset < 80px, белая пена перекрывает всю площадь волны
    const foamFactor = progress < 0.3 ? (1 - progress / 0.3) : 0;
    const foamAlpha = (0.4 + foamFactor * 0.55) * lifeFade;

    this.graphics.beginPath();
    this.graphics.moveTo(frontEdge[0].x, frontEdge[0].y);
    for (let i = 1; i < frontEdge.length; i++) {
      this.graphics.lineTo(frontEdge[i].x, frontEdge[i].y);
    }
    // В конце пути пена немного «расплывается» назад по песку
    const foamSpread = 1 + foamFactor * 0.6;
    for (let i = backEdge.length - 1; i >= 0; i--) {
      const bx = frontEdge[i].x + (backEdge[i].x - frontEdge[i].x) * foamSpread;
      const by = frontEdge[i].y + (backEdge[i].y - frontEdge[i].y) * foamSpread;
      this.graphics.lineTo(bx, by);
    }
    this.graphics.closePath();
    this.graphics.fill({ color: 0xffffff, alpha: foamAlpha });
  }
}
