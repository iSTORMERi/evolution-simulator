import * as PIXI from 'pixi.js';

interface GlintParticle {
  sprite: PIXI.Sprite;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
  maxScale: number;
  baseAlpha: number;
}

export class OceanGlintsController {
  public container: PIXI.Container;

  private glints: GlintParticle[] = [];
  private glintTexture!: PIXI.Texture;

  private mapWidth: number;
  private mapHeight: number;
  private coastalRatio: number;

  private animTime = 0;
  private daylightFactor = 1.0;

  // Увеличено дефолтное количество бликов до 300
  constructor(mapWidth: number, mapHeight: number, coastalRatio: number, count = 300) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.coastalRatio = coastalRatio;

    this.container = new PIXI.Container();

    this.initGlintTexture();
    this.initGlints(count);
  }

  /**
   * Программно создаем маленькую мягкую текстуру светящегося блика
   */
  private initGlintTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');  // Яркий белый центр
      gradient.addColorStop(0.4, 'rgba(200, 255, 255, 0.7)'); // Голубоватое свечение
      gradient.addColorStop(1, 'rgba(200, 255, 255, 0.0)');   // Размытый край

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(8, 8, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    this.glintTexture = PIXI.Texture.from(canvas);
  }

  /**
   * Равномерно распределяем блики по всей площади океана (слева до линии берега)
   */
  private initGlints(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite(this.glintTexture);
      sprite.anchor.set(0.5);

      // Располагаем точки случайным образом по воде
      const y = Math.random() * this.mapHeight;
      const maxX = this.getCoastlineX(y) - 30; // Чуть не доходя до самого сухого пляжа
      const x = Math.random() * Math.max(50, maxX);

      sprite.x = x;
      sprite.y = y;
      sprite.alpha = 0;

      this.container.addChild(sprite);

      this.glints.push({
        sprite,
        baseX: x,
        baseY: y,
        phase: Math.random() * Math.PI * 2, // Разная начальная фаза
        speed: 1.5 + Math.random() * 2.5,   // Индивидуальная скорость мерцания
        maxScale: 0.5 + Math.random() * 0.7, // Слегка варьируем размер для плотности
        baseAlpha: 0.35 + Math.random() * 0.5
      });
    }
  }

  /**
   * Вычисление границы берега (чтобы точки не вылезали на сушу)
   */
  private getCoastlineX(y: number): number {
    const baseOceanWidth = this.mapWidth * this.coastalRatio;
    const wave1 = Math.sin(y * 0.0002) * 600;
    const wave2 = Math.cos(y * 0.0006) * 300;
    const wave3 = Math.sin(y * 0.0015) * 120;

    return baseOceanWidth + wave1 + wave2 + wave3;
  }

  /**
   * Обновляем фактор дневного света в зависимости от времени
   */
  public updateTimeState(hours: number): void {
    if (hours >= 10 && hours <= 16) {
      this.daylightFactor = 1.0;
    } else if (hours >= 6 && hours < 10) {
      this.daylightFactor = (hours - 6) / 4;
    } else if (hours > 16 && hours <= 20) {
      this.daylightFactor = 1.0 - (hours - 16) / 4;
    } else {
      this.daylightFactor = 0;
    }
  }

  /**
   * Обновляем анимацию мерцания каждой точки
   */
  public update(deltaSeconds: number): void {
    // Если ночь или глубокие сумерки -- выключаем контейнер и не тратим ресурсы
    if (this.daylightFactor <= 0.02) {
      this.container.visible = false;
      return;
    }

    this.container.visible = true;
    this.animTime += deltaSeconds;

    for (let i = 0; i < this.glints.length; i++) {
      const g = this.glints[i];

      // Плавная синусоида мерцания (от 0 до 1)
      const glow = (Math.sin(this.animTime * g.speed + g.phase) + 1) / 2;

      // Пульсация размера и прозрачности
      const currentScale = g.maxScale * (0.7 + glow * 0.5);
      const currentAlpha = Math.pow(glow, 2) * g.baseAlpha * this.daylightFactor;

      // Микро-покачивание точки на поверхности воды
      const driftX = Math.sin(this.animTime * 1.2 + g.phase) * 6;
      const driftY = Math.cos(this.animTime * 0.8 + g.phase) * 3;

      g.sprite.x = g.baseX + driftX;
      g.sprite.y = g.baseY + driftY;
      g.sprite.scale.set(currentScale);
      g.sprite.alpha = currentAlpha;
    }
  }
}
