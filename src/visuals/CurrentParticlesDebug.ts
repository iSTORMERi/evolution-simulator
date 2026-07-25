import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Particle {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  lengthScale: number; // Индивидуальный множитель длины
  sprite: PIXI.Sprite;
}

export class CurrentParticlesDebug {
  public container: PIXI.Container;
  private particles: Particle[] = [];
  private currentsManager: OceanCurrentsManager;

  private particleTexture: PIXI.Texture;

  // Цветовая палитра PIXI Hex
  private readonly colorWarm = 0xff8c00;       // 🟠 Оранжевый
  private readonly colorCold = 0x00bfff;       // 🔵 Синий
  private readonly colorTransit = 0xffd700;    // 🟡 Жёлтый
  private readonly colorConnecting = 0x00ff66; // 🟢 Сочно-зелёный
  private readonly colorDrift = 0x1e3a5f;      // 🌊 Тёмно-морской

  private readonly worldSize = 8000;

  constructor(currentsManager: OceanCurrentsManager, count: number = 2200) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();

    // Базовая увеличенная текстура (72px x 8px вместо 18px x 4px)
    this.particleTexture = this.generateDashTexture(72, 8);
    this.initParticles(count);
  }

  /**
   * Генерация вытянутой текстуры черточки со скругленными краями
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
      // Центрируем анкор для ровного вращения вокруг центра
      sprite.anchor.set(0.5);

      const pos = this.currentsManager.getRandomWaterPosition();
      sprite.position.set(pos.x, pos.y);

      const maxLife = 4 + Math.random() * 4;
      const life = Math.random() * maxLife;
      
      // Разнородная длина: от 1.0x до 3.5x
      const lengthScale = 1.0 + Math.random() * 2.5;

      this.container.addChild(sprite);
      this.particles.push({ 
        x: pos.x, 
        y: pos.y, 
        life, 
        maxLife, 
        lengthScale, 
        sprite 
      });
    }
  }

  private respawnParticle(p: Particle): void {
    const pos = this.currentsManager.getRandomWaterPosition();
    p.x = pos.x;
    p.y = pos.y;
    p.life = 0;
    p.maxLife = 4 + Math.random() * 4;
    p.lengthScale = 1.0 + Math.random() * 2.5; // Пересчет длины при респавне
    p.sprite.position.set(p.x, p.y);
  }

  public update(deltaSeconds: number): void {
    const total = this.particles.length;

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

      // Проверка на столкновение с сушей
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

      // Поворот черточки вдоль направления скорости
      const speed = Math.hypot(current.vx, current.vy);
      if (speed > 0.01) {
        p.sprite.rotation = Math.atan2(current.vy, current.vx);
      }

      // Динамический размер: длина зависит от индивидуального коэффициента и скорости течения
      const currentSpeedFactor = Math.min(2.0, Math.max(0.5, speed / 200));
      p.sprite.scale.x = p.lengthScale * currentSpeedFactor;
      p.sprite.scale.y = 1.2; // Толщина палочки

      // Прозрачность с мягким проявлением и затуханием (Fade In / Fade Out)
      const progress = p.life / p.maxLife;
      let alpha = 0.85;
      if (progress < 0.2) alpha = (progress / 0.2) * 0.85;
      if (progress > 0.8) alpha = ((1 - progress) / 0.2) * 0.85;
      p.sprite.alpha = alpha;

      // Окрашивание в соответствии со всеми зонами течений
      switch (current.zoneType) {
        case CurrentZoneType.WARM:
          p.sprite.tint = this.colorWarm;
          break;
        case CurrentZoneType.COLD:
          p.sprite.tint = this.colorCold;
          break;
        case CurrentZoneType.TRANSIT:
          p.sprite.tint = this.colorTransit;
          break;
        case CurrentZoneType.CONNECTING:
          p.sprite.tint = this.colorConnecting;
          break;
        case CurrentZoneType.DRIFT:
          p.sprite.tint = this.colorDrift;
          break;
        default:
          p.sprite.tint = this.colorCold;
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
