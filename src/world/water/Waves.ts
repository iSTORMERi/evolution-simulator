// src/world/water/Waves.ts

import * as PIXI from 'pixi.js';
import { ShorePoint } from './ShoreEffects';

interface FrontWave {
  id: number;
  startIndex: number;
  endIndex: number;
  offset: number;     // Дистанция от берега
  maxOffset: number;  // Начальная дистанция спавна (глубокая вода)
  speed: number;
  length: number;
  isMajor: boolean;
  foamPhase: number;  // Фаза анимации пены при ударе о берег
}

export class Waves {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private shorePoints: ShorePoint[] = [];
  private activeWaves: FrontWave[] = [];

  private spawnTimer: number = 0;
  private maxActiveWaves: number = 22; // Плотный массивный поток волн

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  public initShoreline(shorePoints: ShorePoint[]): void {
    this.shorePoints = shorePoints;
    this.activeWaves = [];
    
    // Заполняем весь океан волнами сразу при загрузке
    if (this.shorePoints.length > 10) {
      for (let i = 0; i < 14; i++) {
        this.spawnWave(true);
      }
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.shorePoints || this.shorePoints.length < 10) return;

    // Частый спавн волн
    this.spawnTimer += deltaSeconds;
    if (this.spawnTimer >= 0.15 && this.activeWaves.length < this.maxActiveWaves) {
      this.spawnWave(false);
      this.spawnTimer = 0;
    }

    this.graphics.clear();

    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];

      // Движение к берегу
      wave.offset -= deltaSeconds * wave.speed;
      wave.foamPhase += deltaSeconds * 5;

      // Убираем волну, когда она полностью растворилась на суше
      if (wave.offset <= 2) {
        this.activeWaves.splice(i, 1);
        continue;
      }

      this.renderParallelWave(wave);
    }
  }

  private spawnWave(randomProgress: boolean): void {
    const totalPoints = this.shorePoints.length;
    if (totalPoints < 15) return;

    // Волны теперь очень длинные (массивные фронты)
    const wavePointLength = Math.floor(40 + Math.random() * (totalPoints * 0.75)); 
    const maxStartIndex = totalPoints - wavePointLength - 1;
    if (maxStartIndex <= 0) return;

    const startIndex = Math.floor(Math.random() * maxStartIndex);
    const endIndex = startIndex + wavePointLength;

    // Спавн ГОРАЗДО дальше в океане (до 500px от берега)
    const maxOffset = 250 + Math.random() * 250; 
    const initialOffset = randomProgress ? 10 + Math.random() * maxOffset : maxOffset;

    const isMajor = Math.random() < 0.5; // Каждый второй фронт -- гигантский

    this.activeWaves.push({
      id: Math.random(),
      startIndex,
      endIndex,
      offset: initialOffset,
      maxOffset,
      speed: 30 + Math.random() * 20,
      length: wavePointLength,
      isMajor,
      foamPhase: Math.random() * Math.PI * 2,
    });
  }

  private renderParallelWave(wave: FrontWave): void {
    const points: { x: number; y: number; edgeAlpha: number; nx: number; ny: number }[] = [];

    // Вычисляем точки со смещением строго по нормали берега
    for (let i = wave.startIndex; i <= wave.endIndex; i++) {
      const curr = this.shorePoints[i];
      const prev = this.shorePoints[Math.max(0, i - 1)];
      const next = this.shorePoints[Math.min(this.shorePoints.length - 1, i + 1)];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;

      // Нормаль в сторону океана
      const nx = -dy / len;
      const ny = dx / len;

      const relativeIdx = i - wave.startIndex;
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

    // Прогресс движения (1 = глубина, 0 = берег)
    const progress = wave.offset / wave.maxOffset;
    
    // Плавное зарождение в глубине
    let globalAlpha = 1;
    if (progress > 0.8) {
      globalAlpha = (1 - progress) / 0.2;
    }

    // РЕЖИМ 1: Движение массивного вала в океане (offset > 40px)
    if (wave.offset > 40) {
      // 1. Мощная тень перед волной
      const shadowWidth = wave.isMajor ? 36 : 22;
      this.drawStroke(points, globalAlpha * 0.45, 0x032833, shadowWidth, 0);

      // 2. Толстое бирюзовое тело
      const bodyWidth = wave.isMajor ? 20 : 12;
      this.drawStroke(points, globalAlpha * 0.8, 0x22abbf, bodyWidth, 3);

      // 3. Белоснежный широкий гребень
      const crestWidth = wave.isMajor ? 12 : 7;
      this.drawStroke(points, globalAlpha * 0.95, 0xffffff, crestWidth, 6);
    } 
    // РЕЖИМ 2: Превращение в МАССИВНЫЙ СГУСТОК ПЕНЫ у берега (offset <= 40px)
    else {
      const foamProgress = 1 - (wave.offset / 40); // 0 -> 1 (разбивание о берег)
      const foamAlpha = globalAlpha * (1 - foamProgress * 0.7); // Плавное исчезновение

      // А: Широкое белое пятно расплывающейся пены
      const foamWidth = (wave.isMajor ? 28 : 18) + foamProgress * 30; // Расширяется при прибое
      this.drawStroke(points, foamAlpha * 0.85, 0xffffff, foamWidth, 0);

      // Б: Текстурные пузыри/штрихи внутри пены
      for (let i = 0; i < points.length - 1; i += 2) {
        const p = points[i];
        if (p.edgeAlpha < 0.2) continue;

        const jitter = Math.sin(wave.foamPhase + i) * 6;
        const fx = p.x + p.nx * jitter;
        const fy = p.y + p.ny * jitter;
        const bubbleRadius = (3 + Math.random() * 4) * (1 + foamProgress);

        this.graphics.circle(fx, fy, bubbleRadius);
        this.graphics.fill({ color: 0xffffff, alpha: foamAlpha * 0.75 });
      }

      // В: Бирюзовый край уходящей воды под пеной
      this.drawStroke(points, foamAlpha * 0.5, 0x41d8eb, foamWidth * 0.5, -4);
    }
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

      const segmentAlpha = baseAlpha * ((p1.edgeAlpha + p2.edgeAlpha) / 2);
      if (segmentAlpha < 0.02) continue;

      const x1 = p1.x + p1.nx * advanceOffset;
      const y1 = p1.y + p1.ny * advanceOffset;
      const x2 = p2.x + p2.nx * advanceOffset;
      const y2 = p2.y + p2.ny * advanceOffset;

      this.graphics.moveTo(x1, y1);
      this.graphics.lineTo(x2, y2);
      this.graphics.stroke({ color, width: lineWidth, alpha: segmentAlpha });
    }
  }
}
