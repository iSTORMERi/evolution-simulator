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

  // Цветовая палитра: День (Хлорофилл) / Ночь (Биолюминесценция)
  private dayColor = 0x059669;   // Изумрудно-бирюзовый
  private nightColor = 0x00f5ff; // Фосфорно-неоновый

  constructor(
    app: PIXI.Application,
    currentsManager: OceanCurrentsManager,
    count: number = 800,
    worldWidth: number = 8000,
    worldHeight: number = 8000
  ) {
    this.container = new PIXI.Container();
    this.currentsManager = currentsManager;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // 1. Запекаем мягкую градиентную текстуру частицы
    const texture = this.createBlobTexture(app);

    // 2. Генерируем массив бессмертных колоний планктона и создаем для них спрайты
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

  /**
   * Генерация мягкой радиальной частицы с помощью PixiJS v8 Graphics API
   */
  private createBlobTexture(app: PIXI.Application): PIXI.Texture {
    const g = new PIXI.Graphics();
    
    // В PixiJS v8 сглаженный мягкий диск рисуется через многослойный fill
    g.circle(16, 16, 16).fill({ color: 0xffffff, alpha: 0.12 });
    g.circle(16, 16, 10).fill({ color: 0xffffff, alpha: 0.35 });
    g.circle(16, 16, 4).fill({ color: 0xffffff, alpha: 0.85 });

    return app.renderer.generateTexture(g);
  }

  /**
   * Обновление позиций агентов и смена дневного/ночного режима
   */
  public update(dt: number, isNight: boolean): void {
    const targetColor = isNight ? this.nightColor : this.dayColor;
    const targetBlendMode = isNight ? 'add' : 'normal';

    for (let i = 0; i < this.planktonList.length; i++) {
      const agent = this.planktonList[i];
      const sprite = this.sprites[i];

      // Вытаскиваем текущий вектор течения под координатами агента
      const currentVector = this.currentsManager.getVectorAt(agent.x, agent.y);

      // Рассчитываем кинематику движения
      agent.update(currentVector.x, currentVector.y, dt, this.worldWidth, this.worldHeight);

      // Синхронизируем положение и визуал спрайта
      sprite.x = agent.x;
      sprite.y = agent.y;
      sprite.tint = targetColor;
      sprite.blendMode = targetBlendMode;
    }
  }
}
