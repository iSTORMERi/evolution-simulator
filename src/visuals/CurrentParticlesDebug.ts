import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';
import { WorldMap } from '../world/WorldMap';

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
  private worldMap: WorldMap;

  private readonly colorWarm = 0xff7700;  // 🟧
  private readonly colorMixed = 0x00ff88; // 🟩
  private readonly colorCold = 0x00aaff;  // 🟦

  constructor(currentsManager: OceanCurrentsManager, worldMap: WorldMap, count: number = 2200) {
    this.currentsManager = currentsManager;
    this.worldMap = worldMap;
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    this.initParticles(count);
  }

  /**
   * Точный спавн в воде по маске WorldMap
   */
  private initParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push(this.getRandomWaterPosition());
    }
  }

  private getRandomWaterPosition(): Particle {
    let rx = 0;
    let ry = 0;
    let attempts = 0;

    // Подбираем случайную точку в воде
    do {
      rx = Math.random() * 8000;
      ry = Math.random() * 8000;
      attempts++;
    } while (!this.currentsManager.isWater(rx, ry) && attempts < 100);

    return { x: rx, y: ry, color: this.colorMixed };
  }

  public update(deltaSeconds: number): void {
    this.graphics.clear();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const current = this.currentsManager.getCurrentAt(p.x, p.y);

      const dx = current.vx * deltaSeconds;
      const dy = current.vy * deltaSeconds;

      const nextX = p.x + dx;
      const nextY = p.y + dy;

      // --- АЛГОРИТМ ПРИБРЕЖНОГО СКОЛЬЖЕНИЯ ---
      if (this.currentsManager.isWater(nextX, nextY)) {
        // Шаг свободен -- двигаемся по всей траектории
        p.x = nextX;
        p.y = nextY;
      } else {
        // Упёрлись в берег! Пробуем скользить вдоль него по одной из осей
        if (this.currentsManager.isWater(nextX, p.y)) {
          p.x = nextX; // Скольжение по горизонтали
        } else if (this.currentsManager.isWater(p.x, nextY)) {
          p.y = nextY; // Скольжение по вертикали
        } else {
          // Если застряли в «углу» суши -- телепортируем обратно в воду
          const newPos = this.getRandomWaterPosition();
          p.x = newPos.x;
          p.y = newPos.y;
        }
      }

      // Телепортация при выходе за границы карты 8000x8000
      if (p.x > 8000) p.x = 0;
      if (p.x < 0) p.x = 8000;
      if (p.y > 8000) p.y = 0;
      if (p.y < 0) p.y = 8000;

      // Выбор цвета частицы по зоне
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

      // Отрисовка
      this.graphics
        .circle(p.x, p.y, 3.2)
        .fill({ color: p.color, alpha: 0.85 });
    }
  }
}
