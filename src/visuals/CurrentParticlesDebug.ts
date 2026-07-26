import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Point2D {
  x: number;
  y: number;
}

interface TrailParticle {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  history: Point2D[];   // История последних координат (след)
  maxHistory: number;  // Длина следа в точках
  zoneType: CurrentZoneType;
}

export class CurrentParticlesDebug {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private particles: TrailParticle[] = [];
  private currentsManager: OceanCurrentsManager;

  // Неоновые цвета с поддержкой ADD-смешивания
  private readonly colorWarm = 0xff7700;       // 🟠 Оранжевый
  private readonly colorCold = 0x00d5ff;       // 🔵 Голубой / Ледяной
  private readonly colorTransit = 0xffe600;    // 🟡 Жёлтый
  private readonly colorConnecting = 0x00ff66; // 🟢 Зелёный
  private readonly colorDrift = 0x2a52be;      // 🌊 Глубокий синий

  private readonly worldSize = 8000;

  constructor(currentsManager: OceanCurrentsManager, count: number = 1800) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();
    
    // Включаем аддитивное смешивание для красивого свечения перекрестных течений
    this.container.blendMode = PIXI.BLEND_MODES.ADD;

    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    this.initParticles(count);
  }

  private initParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const pos = this.currentsManager.getRandomWaterPosition();
      const maxLife = 3 + Math.random() * 4; // 3-7 секунд жизни
      const maxHistory = 6 + Math.floor(Math.random() * 8); // От 6 до 14 звеньев в шлейфе

      this.particles.push({
        x: pos.x,
        y: pos.y,
        life: Math.random() * maxLife,
        maxLife,
        history: [{ x: pos.x, y: pos.y }],
        maxHistory,
        zoneType: CurrentZoneType.COLD
      });
    }
  }

  private respawnParticle(p: TrailParticle): void {
    const pos = this.currentsManager.getRandomWaterPosition();
    p.x = pos.x;
    p.y = pos.y;
    p.life = 0;
    p.maxLife = 3 + Math.random() * 4;
    p.maxHistory = 6 + Math.floor(Math.random() * 8); // Разная длина шлейфа
    p.history = [{ x: pos.x, y: pos.y }];
  }

  public update(deltaSeconds: number): void {
    const total = this.particles.length;

    // Очищаем векторную графику перед каждым кадром
    this.graphics.clear();

    for (let i = 0; i < total; i++) {
      const p = this.particles[i];
      p.life += deltaSeconds;

      if (p.life >= p.maxLife) {
        this.respawnParticle(p);
        continue;
      }

      const current = this.currentsManager.getCurrentAt(p.x, p.y);
      p.zoneType = current.zoneType;

      const nextX = p.x + current.vx * deltaSeconds;
      const nextY = p.y + current.vy * deltaSeconds;

      // Проверка суши и границ карты
      if (!this.currentsManager.isWater(nextX, nextY) || 
          nextX > this.worldSize || nextX < 0 || 
          nextY > this.worldSize || nextY < 0) {
        this.respawnParticle(p);
        continue;
      }

      p.x = nextX;
      p.y = nextY;

      // Добавляем текущую позицию в голову истории
      p.history.unshift({ x: p.x, y: p.y });
      if (p.history.length > p.maxHistory) {
        p.history.pop();
      }

      // Если в шлейфе недостаточно точек для линии -- пропускаем отрисовку
      if (p.history.length < 2) continue;

      // Вычисляем общую прозрачность частиц (Fade In / Fade Out)
      const progress = p.life / p.maxLife;
      let baseAlpha = 0.8;
      if (progress < 0.15) baseAlpha = (progress / 0.15) * 0.8;
      if (progress > 0.85) baseAlpha = ((1 - progress) / 0.15) * 0.8;

      // Получаем цвет зоны
      const color = this.getZoneColor(p.zoneType);

      // --- ОТРИСОВКА ДИНАМИЧЕСКОГО ШЛЕЙФА ---
      for (let j = 0; j < p.history.length - 1; j++) {
        const p1 = p.history[j];
        const p2 = p.history[j + 1];

        // Затухание толщины и прозрачности к хвосту
        const segmentRatio = 1 - j / p.history.length;
        const alpha = baseAlpha * Math.pow(segmentRatio, 1.5); // Плавное затухание
        const thickness = 1.0 + segmentRatio * 2.5;            // От 1px (хвост) до 3.5px (голова)

        this.graphics.lineStyle(thickness, color, alpha);
        this.graphics.moveTo(p1.x, p1.y);
        this.graphics.lineTo(p2.x, p2.y);
      }
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
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}
