import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Particle {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  sprite: PIXI.Sprite;
}

export class CurrentParticlesDebug {
  public container: PIXI.Container;
  private particles: Particle[] = [];
  private currentsManager: OceanCurrentsManager;

  private particleTexture: PIXI.Texture;

  private readonly colorWarm = 0xff7700;
  private readonly colorMixed = 0x00ff88;
  private readonly colorCold = 0x00aaff;
  private readonly worldSize = 8000;

  constructor(currentsManager: OceanCurrentsManager, count: number = 2200) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();

    // Создаем увеличенную в 3 раза черточку (18px x 4px) вместо точек
    this.particleTexture = this.generateDashTexture(18, 4);
    this.initParticles(count);
  }

  /**
   * Генерация текстуры вытянутой черточки (-) со скругленными краями
   */
  private generateDashTexture(width: number, height: number): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(0, 0, width, height, height / 2);
      } else {
        ctx.rect(0, 0, width, height);
      }
      ctx.fill();
    }

    return PIXI.Texture.from(canvas);
  }

  private initParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite(this.particleTexture);
      // Центрируем анкор, чтобы черточка вращалась ровно вокруг своего центра
      sprite.anchor.set(0.5);

      const pos = this.currentsManager.getRandomWaterPosition();
      sprite.position.set(pos.x, pos.y);

      const maxLife = 4 + Math.random() * 4; // Время жизни 4-8 секунд
      const life = Math.random() * maxLife;  // Случайный фазовый сдвиг при старте

      this.container.addChild(sprite);
      this.particles.push({ x: pos.x, y: pos.y, life, maxLife, sprite });
    }
  }

  private respawnParticle(p: Particle): void {
    const pos = this.currentsManager.getRandomWaterPosition();
    p.x = pos.x;
    p.y = pos.y;
    p.life = 0;
    p.maxLife = 4 + Math.random() * 4;
    p.sprite.position.set(p.x, p.y);
  }

  public update(deltaSeconds: number): void {
    const total = this.particles.length;

    for (let i = 0; i < total; i++) {
      const p = this.particles[i];
      p.life += deltaSeconds;

      // Респавн по истечении времени жизни (обеспечивает плотное покрытие всего океана)
      if (p.life >= p.maxLife) {
        this.respawnParticle(p);
        continue;
      }

      const current = this.currentsManager.getCurrentAt(p.x, p.y);

      const dx = current.vx * deltaSeconds;
      const dy = current.vy * deltaSeconds;

      const nextX = p.x + dx;
      const nextY = p.y + dy;

      // Строгая проверка: если следующий шаг ведет на сушу -- респавним частицу!
      if (this.currentsManager.isWater(nextX, nextY)) {
        p.x = nextX;
        p.y = nextY;
      } else {
        this.respawnParticle(p);
        continue;
      }

      // Зацикливание по краям карты
      if (p.x > this.worldSize || p.x < 0 || p.y > this.worldSize || p.y < 0) {
        this.respawnParticle(p);
        continue;
      }

      // Поворот черточки вдоль направления вектора скорости
      if (Math.abs(current.vx) > 0.01 || Math.abs(current.vy) > 0.01) {
        p.sprite.rotation = Math.atan2(current.vy, current.vx);
      }

      // Прозрачность с мягким проявлением и затуханием (Fade In / Fade Out)
      const progress = p.life / p.maxLife;
      let alpha = 0.85;
      if (progress < 0.2) alpha = (progress / 0.2) * 0.85;
      if (progress > 0.8) alpha = ((1 - progress) / 0.2) * 0.85;
      p.sprite.alpha = alpha;

      // Окрашивание
      switch (current.zoneType) {
        case CurrentZoneType.WARM:
          p.sprite.tint = this.colorWarm;
          break;
        case CurrentZoneType.COLD:
          p.sprite.tint = this.colorCold;
          break;
        default:
          p.sprite.tint = this.colorMixed;
          break;
      }

      p.sprite.x = p.x;
      p.sprite.y = p.y;
    }
  }

  public destroy(): void {
    if (this.particleTexture) {
      this.particleTexture.destroy(true);
    }
    this.container.destroy({ children: true });
  }
}
