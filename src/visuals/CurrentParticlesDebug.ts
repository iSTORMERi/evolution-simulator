import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Particle {
  x: number;
  y: number;
  color: number;
}

export class CurrentParticlesDebug {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private particles: Particle[] = [];
  private currentsManager: OceanCurrentsManager;

  // Цвета зон в HEX для PixiJS
  private readonly colorWarm = 0xff7700;  // 🟧 Оранжевый
  private readonly colorMixed = 0x00ff88; // 🟩 Изумрудный
  private readonly colorCold = 0x00aaff;  // 🟦 Неоново-синий

  constructor(currentsManager: OceanCurrentsManager, count: number = 1800) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    this.initParticles(count);
  }

  private initParticles(count: number): void {
    const w = this.currentsManager.mapWidth;
    const h = this.currentsManager.mapHeight;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        color: this.colorMixed
      });
    }
  }

  public update(deltaSeconds: number): void {
    const w = this.currentsManager.mapWidth;
    const h = this.currentsManager.mapHeight;

    // Очищаем графику кадра
    this.graphics.clear();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const current = this.currentsManager.getCurrentAt(p.x, p.y);

      // Движение по вектору течения
      p.x += current.vx * deltaSeconds;
      p.y += current.vy * deltaSeconds;

      // Телепортация при выходе за пределы карты 8000x8000
      if (p.x > w) p.x = 0;
      if (p.x < 0) p.x = w;
      if (p.y > h) p.y = 0;
      if (p.y < 0) p.y = h;

      // Смена цвета по зоне
      switch (current.zoneType) {
        case CurrentZoneType.WARM:
          p.color = this.colorWarm;
          break;
        case CurrentZoneType.MIXED:
          p.color = this.colorMixed;
          break;
        case CurrentZoneType.COLD:
          p.color = this.colorCold;
          break;
      }

      // Отрисовка частицы в виде светящейся точки
      this.graphics
        .circle(p.x, p.y, 3.5)
        .fill({ color: p.color, alpha: 0.8 });
    }
  }
}
