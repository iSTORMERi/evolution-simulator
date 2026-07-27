// src/visuals/PlanktonOverlay.ts

import * as PIXI from 'pixi.js';
import { SurfacePlankton } from '../entities/SurfacePlankton';
import { OceanCurrentsManager } from '../simulation/OceanCurrentsManager';

export class PlanktonOverlay {
  public container: PIXI.Container;
  private planktonList: SurfacePlankton[] = [];
  private sprites: PIXI.Sprite[] = [];
  private currentsManager: OceanCurrentsManager;
  private worldWidth: number;
  private worldHeight: number;

  private dayColor = 0x059669;   // Изумрудный
  private nightColor = 0x00f5ff; // Биолюминесцентный неон

  constructor(
    app: PIXI.Application,
    currentsManager: OceanCurrentsManager,
    count: number = 600,
    worldWidth: number = 8000,
    worldHeight: number = 8000
  ) {
    this.container = new PIXI.Container();
    this.currentsManager = currentsManager;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Безопасное запекание текстуры
    const texture = this.createBlobTexture(app);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * worldWidth;
      const y = Math.random() * worldHeight;

      const agent = new SurfacePlankton(x, y);
      this.planktonList.push(agent);

      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.scale.set(agent.scale);
      sprite.alpha = agent.opacity;
      sprite.tint = this.dayColor;

      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
  }

  private createBlobTexture(app: PIXI.Application): PIXI.Texture {
    const g = new PIXI.Graphics();
    
    g.circle(16, 16, 16).fill({ color: 0xffffff, alpha: 0.12 });
    g.circle(16, 16, 10).fill({ color: 0xffffff, alpha: 0.35 });
    g.circle(16, 16, 4).fill({ color: 0xffffff, alpha: 0.85 });

    const texture = app.renderer.generateTexture(g);
    g.destroy(); // Освобождаем память PixiJS
    return texture;
  }

  public update(dt: number, isNight: boolean): void {
    const targetColor = isNight ? this.nightColor : this.dayColor;
    const targetBlend = isNight ? 'add' : 'normal';

    for (let i = 0; i < this.planktonList.length; i++) {
      const agent = this.planktonList[i];
      const sprite = this.sprites[i];

      // Безопасное получение вектора течений (с фоллбэком на {x: 0, y: 0})
      let vx = 0;
      let vy = 0;

      if (this.currentsManager) {
        const mgr = this.currentsManager as any;
        // Универсальная проверка имени метода в OceanCurrentsManager
        const vecGetter = mgr.getVectorAt || mgr.getVector || mgr.getFlowAt || mgr.getVelocityAt;
        if (typeof vecGetter === 'function') {
          const vec = vecGetter.call(mgr, agent.x, agent.y);
          if (vec) {
            vx = vec.x || 0;
            vy = vec.y || 0;
          }
        }
      }

      agent.update(vx, vy, dt, this.worldWidth, this.worldHeight);

      sprite.x = agent.x;
      sprite.y = agent.y;
      sprite.tint = targetColor;
      sprite.blendMode = targetBlend;
    }
  }
}
