import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Point2D {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  lengthScale: number;
  history: Point2D[];   // История координат для динамического следа
  maxHistory: number;  // Максимальная длина шлейфа
  sprite: PIXI.Sprite;
}

export class CurrentParticlesDebug {
  public container: PIXI.Container;
  private trailGraphics: PIXI.Graphics; // Графика для отрисовки изогнутых следов
  private particles: Particle[] = [];
  private currentsManager: OceanCurrentsManager;

  private particleTexture: PIXI.Texture;

  // Неоновая палитра течений
  private readonly colorWarm = 0xff8c00;       // 🟠 Оранжевый
  private readonly colorCold = 0x00bfff;       // 🔵 Синий
  private readonly colorTransit = 0xffd700;    // 🟡 Жёлтый
  private readonly colorConnecting = 0x00ff66; // 🟢 Сочно-зелёный
  private readonly colorDrift = 0x1e3a5f;      // 🌊 Тёмно-морской

  private readonly worldSize = 8000;

  constructor(currentsManager: OceanCurrentsManager, count: number = 1800) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();

    // Режим аддитивного наложения для эффектного свечения в местах слияния течений
    this.container.blendMode = PIXI.BLEND_MODES.ADD;

    // Слой для искривлённых динамических следов (рисуется под кометами)
    this.trailGraphics = new PIXI.Graphics();
    this.container.addChild(this.trailGraphics);

    // Генерация текстуры кометы (64px x 6px)
    this.particleTexture = this.generateCometTexture(64, 6);
    this.initParticles(count);
  }

  /**
   * Генерация текстуры кометы с мягким градиентным хвостом
   */
  private generateCometTexture(width: number, height: number): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Градиент: полностью прозрачный хвост (слева) -> яркая голова (справа)
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();

      const centerY = height / 2;
      ctx.moveTo(0, centerY);                                        // Острый хвост
      ctx.lineTo(width - height, 0);                                 // Верхнее плечо
      ctx.arcTo(width, centerY, width - height, height, height / 2); // Скругленный носовой обтекатель
      ctx.lineTo(width - height, height);                            // Нижнее плечо
      ctx.closePath();
      ctx.fill();
    }

    return PIXI.Texture.from(canvas);
  }

  private initParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite(this.particleTexture);
      
      // Точка привязки справа по центру (1.0, 0.5) -- голова кометы на острие вектора
      sprite.anchor.set(1.0, 0.5);

      const pos = this.currentsManager.getRandomWaterPosition();
      sprite.position.set(pos.x, pos.y);

      const maxLife = 3 + Math.random() * 4; // Время жизни 3-7 секунд
      const life = Math.random() * maxLife;
      const lengthScale = 0.8 + Math.random() * 1.8;
      const maxHistory = 6 + Math.floor(Math.random() * 8); // 6-14 звеньев шлейфа

      this.container.addChild(sprite);
      this.particles.push({
        x: pos.x,
        y: pos.y,
        life,
        maxLife,
        lengthScale,
        history: [{ x: pos.x, y: pos.y }],
        maxHistory,
        sprite
      });
    }
  }

  private respawnParticle(p: Particle): void {
    const pos = this.currentsManager.getRandomWaterPosition();
    p.x = pos.x;
    p.y = pos.y;
    p.life = 0;
    p.maxLife = 3 + Math.random() * 4;
    p.lengthScale = 0.8 + Math.random() * 1.8;
    p.maxHistory = 6 + Math.floor(Math.random() * 8);
    p.history = [{ x: pos.x, y: pos.y }];
    p.sprite.position.set(p.x, p.y);
  }

  public update(deltaSeconds: number): void {
    const total = this.particles.length;

    // Очищаем векторный слой следов перед каждым кадром
    this.trailGraphics.clear();

    for (let i = 0; i < total; i++) {
      const p = this.particles[i];
      p.life += deltaSeconds;

      // Респавн по истечении времени жизни
      if (p.life >= p.maxLife) {
        this.respawnParticle(p);
        continue;
      }

      const current = this.currentsManager.getCurrentAt(p.x, p.y);

      const dx = current.vx * deltaSeconds;
      const dy = current.vy * deltaSeconds;

      const nextX = p.x + dx;
      const nextY = p.y + dy;

      // Проверка столкновения с сушей и выпадания за карту
      if (!this.currentsManager.isWater(nextX, nextY) ||
          nextX > this.worldSize || nextX < 0 ||
          nextY > this.worldSize || nextY < 0) {
        this.respawnParticle(p);
        continue;
      }

      p.x = nextX;
      p.y = nextY;

      // Записываем позицию в историю шлейфа
      p.history.unshift({ x: p.x, y: p.y });
      if (p.history.length > p.maxHistory) {
        p.history.pop();
      }

      // Вычисление базовой прозрачности (Fade In / Fade Out)
      const progress = p.life / p.maxLife;
      let alpha = 0.85;
      if (progress < 0.15) alpha = (progress / 0.15) * 0.85;
      if (progress > 0.85) alpha = ((1 - progress) / 0.15) * 0.85;

      // Получаем цвет зоны
      const color = this.getZoneColor(current.zoneType);

      // --- 1. ОТРЕСОВКА ДИНАМИЧЕСКОГО ИЗОГНУТОГО ШЛЕЙФА ---
      if (p.history.length >= 2) {
        for (let j = 0; j < p.history.length - 1; j++) {
          const p1 = p.history[j];
          const p2 = p.history[j + 1];

          // Плавное сужение и затухание от головы к хвосту
          const segmentRatio = 1 - j / p.history.length;
          const segAlpha = alpha * Math.pow(segmentRatio, 1.8);
          const thickness = 0.8 + segmentRatio * 2.2;

          this.trailGraphics.lineStyle(thickness, color, segAlpha);
          this.trailGraphics.moveTo(p1.x, p1.y);
          this.trailGraphics.lineTo(p2.x, p2.y);
        }
      }

      // --- 2. ОТРЕСОВКА ГОЛОВНОЙ КОМЕТЫ (СПРАЙТА) ---
      const speed = Math.hypot(current.vx, current.vy);
      if (speed > 0.01) {
        p.sprite.rotation = Math.atan2(current.vy, current.vx);
      }

      // Растяжение кометы по скорости
      const currentSpeedFactor = Math.min(2.0, Math.max(0.5, speed / 200));
      p.sprite.scale.x = p.lengthScale * currentSpeedFactor;
      p.sprite.scale.y = 1.0;

      p.sprite.alpha = alpha;
      p.sprite.tint = color;
      p.sprite.x = p.x;
      p.sprite.y = p.y;
    }
  }

  private getZoneColor(zoneType: CurrentZoneType): number {
    switch (zoneType) {
      case CurrentZoneType.WARM:
        return this.colorWarm;
      case CurrentZoneType.COLD:
        return this.colorCold;
      case CurrentZoneType.TRANSIT:
        return this.colorTransit;
      case CurrentZoneType.CONNECTING:
        return this.colorConnecting;
      case CurrentZoneType.DRIFT:
        return this.colorDrift;
      default:
        return this.colorCold;
    }
  }

  public destroy(): void {
    if (this.particleTexture) {
      this.particleTexture.destroy(true);
    }
    if (this.trailGraphics) {
      this.trailGraphics.destroy();
    }
    this.container.destroy({ children: true });
  }
}
