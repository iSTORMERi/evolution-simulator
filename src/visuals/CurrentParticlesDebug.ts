import * as PIXI from 'pixi.js';
import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

interface Particle {
  x: number;
  y: number;
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

  constructor(currentsManager: OceanCurrentsManager, count: number = 1800) {
    this.currentsManager = currentsManager;
    this.container = new PIXI.Container();

    this.particleTexture = this.generateCircleTexture(3);
    this.initParticles(count);
  }

  private generateCircleTexture(radius: number): PIXI.Texture {
    const canvas = document.createElement('canvas');
    const size = radius * 2;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(radius, radius, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    return PIXI.Texture.from(canvas);
  }

  private initParticles(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite(this.particleTexture);
      
      sprite.anchor.set(0.5);
      sprite.alpha = 0.8;
      sprite.tint = this.colorMixed;

      const pos = this.getRandomWaterPosition();

      sprite.position.set(pos.x, pos.y);

      this.container.addChild(sprite);
      this.particles.push({ x: pos.x, y: pos.y, sprite });
    }
  }

  private getRandomWaterPosition(): { x: number; y: number } {
    let rx = Math.random() * this.worldSize;
    let ry = Math.random() * this.worldSize;
    let attempts = 0;

    while (!this.currentsManager.isWater(rx, ry) && attempts < 20) {
      rx = Math.random() * this.worldSize;
      ry = Math.random() * this.worldSize;
      attempts++;
    }

    return { x: rx, y: ry };
  }

  public update(deltaSeconds: number): void {
    const total = this.particles.length;

    for (let i = 0; i < total; i++) {
      const p = this.particles[i];
      const current = this.currentsManager.getCurrentAt(p.x, p.y);

      const dx = current.vx * deltaSeconds;
      const dy = current.vy * deltaSeconds;

      const nextX = p.x + dx;
      const nextY = p.y + dy;

      // Прибрежное скольжение
      if (this.currentsManager.isWater(nextX, nextY)) {
        p.x = nextX;
        p.y = nextY;
      } else {
        if (this.currentsManager.isWater(nextX, p.y)) {
          p.x = nextX;
        } else if (this.currentsManager.isWater(p.x, nextY)) {
          p.y = nextY;
        } else {
          const newPos = this.getRandomWaterPosition();
          p.x = newPos.x;
          p.y = newPos.y;
        }
      }

      // Зацикливание по краям карты 8000x8000
      if (p.x > this.worldSize) p.x = 0;
      if (p.x < 0) p.x = this.worldSize;
      if (p.y > this.worldSize) p.y = 0;
      if (p.y < 0) p.y = this.worldSize;

      // Цветовая динамика по зонам
      switch (current.zoneType) {
        case CurrentZoneType.WARM:
          p.sprite.tint = this.colorWarm;
          break;
        case CurrentZoneType.MIXED:
          p.sprite.tint = this.colorMixed;
          break;
        case CurrentZoneType.COLD:
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
