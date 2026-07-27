// src/visuals/PlanktonOverlay.ts

import * as PIXI from 'pixi.js';
import { SurfacePlankton, PlanktonType } from '../entities/SurfacePlankton';
import { OceanCurrentsManager } from '../simulation/OceanCurrentsManager';

export class PlanktonOverlay {
  public container: PIXI.Container;
  private planktonList: SurfacePlankton[] = [];
  private colonySprites: PIXI.Sprite[] = [];
  private currentsManager: OceanCurrentsManager;
  private app: PIXI.Application;
  private worldWidth: number;
  private worldHeight: number;

  constructor(
    app: PIXI.Application,
    currentsManager: OceanCurrentsManager,
    _count: number = 200,
    worldWidth: number = 8000,
    worldHeight: number = 8000,
    customColonies?: SurfacePlankton[]
  ) {
    this.app = app;
    this.container = new PIXI.Container();
    this.currentsManager = currentsManager;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // 1. Единый BlurFilter на весь родительский контейнер (1 проход GPU вместо 200)
    this.container.filters = [new PIXI.BlurFilter({ strength: 0.8, quality: 1 })];

    // Автоматическая загрузка экологически заспавненных 200 колоний
    this.planktonList = customColonies ?? SurfacePlankton.createDefaultTestColonies(
      this.worldWidth,
      this.worldHeight,
      this.currentsManager
    );

    // 2. Генерация векторной формы один раз -> Запекание в Текстуру -> PIXI.Sprite
    for (const colony of this.planktonList) {
      const sprite = this.createColonySprite(colony);
      this.colonySprites.push(sprite);
      this.container.addChild(sprite);
    }
  }

  /**
   * Фабрика: превращает векторную форму Graphics в запечённый PIXI.Sprite
   */
  private createColonySprite(colony: SurfacePlankton): PIXI.Sprite {
    const g = new PIXI.Graphics();

    switch (colony.type) {
      case PlanktonType.DIATOMS:
        this.drawDiatomsColony(g, colony);
        break;
      case PlanktonType.DINOFLAGELLATES:
        this.drawDinoflagellatesColony(g, colony);
        break;
      case PlanktonType.COCCOLITHOPHORES:
        this.drawCoccolithophoresColony(g, colony);
        break;
      case PlanktonType.CYANOBACTERIA:
        this.drawCyanobacteriaColony(g, colony);
        break;
    }

    // Запекаем вектор в легкую GPU-текстуру
    const texture = this.app.renderer.generateTexture(g);
    g.destroy(); // Освобождаем память от векторной заготовки

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5); // Центрируем точку вращения
    sprite.x = colony.x;
    sprite.y = colony.y;
    sprite.rotation = colony.rotation;

    return sprite;
  }

  /**
   * Генерация органических волнистых контуров
   */
  private generateOrganicPolygon(
    baseRadiusX: number,
    baseRadiusY: number,
    seed: number,
    numPoints: number = 18
  ): number[] {
    const points: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      
      const noise1 = Math.sin(angle * 3 + seed) * 0.18;
      const noise2 = Math.cos(angle * 5 + seed * 1.7) * 0.10;
      const factor = 1 + noise1 + noise2;

      const rx = baseRadiusX * factor;
      const ry = baseRadiusY * factor;

      points.push(Math.cos(angle) * rx, Math.sin(angle) * ry);
    }
    return points;
  }

  /**
   * 1. Диатомеи: Едва заметный оливково-золотой туман (Прозрачность x3)
   */
  private drawDiatomsColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const goldColor = 0xC59B27;
    const oliveColor = 0x6B8E23;

    // Внешний ореол (alpha снижен в 3 раза)
    const outerShape = this.generateOrganicPolygon(r * 1.35, r * 0.48, colony.seed, 18);
    g.poly(outerShape).fill({ color: goldColor, alpha: (0.04 / 3) * colony.density });

    // Среднее тело
    const midShape = this.generateOrganicPolygon(r * 0.95, r * 0.35, colony.seed + 1.5, 16);
    g.poly(midShape).fill({ color: goldColor, alpha: (0.05 / 3) * colony.density });

    // Легкое ядро
    const coreShape = this.generateOrganicPolygon(r * 0.55, r * 0.20, colony.seed + 3.0, 14);
    g.poly(coreShape).fill({ color: oliveColor, alpha: (0.06 / 3) * colony.density });
  }

  /**
   * 2. Динофлагеллаты: Едва уловимое багровое размытие (Прозрачность x3)
   */
  private drawDinoflagellatesColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const rustRed = 0xB22222;
    const deepMaroon = 0x6B0000;

    const outerShape = this.generateOrganicPolygon(r * 1.1, r * 0.85, colony.seed, 16);
    g.poly(outerShape).fill({ color: rustRed, alpha: (0.04 / 3) * colony.density });

    const midShape = this.generateOrganicPolygon(r * 0.72, r * 0.52, colony.seed + 1.2, 14);
    g.poly(midShape).fill({ color: rustRed, alpha: (0.05 / 3) * colony.density });

    const coreShape = this.generateOrganicPolygon(r * 0.40, r * 0.30, colony.seed + 2.5, 12);
    g.poly(coreShape).fill({ color: deepMaroon, alpha: (0.06 / 3) * colony.density });
  }

  /**
   * 3. Кокколитофориды: Призрачное дымчато-бирюзовое облако (Прозрачность x3)
   */
  private drawCoccolithophoresColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const turquoise = 0x00CED1;
    const milkyWhite = 0xF0FFFF;

    const outerShape = this.generateOrganicPolygon(r * 1.2, r * 0.95, colony.seed, 18);
    g.poly(outerShape).fill({ color: turquoise, alpha: (0.04 / 3) * colony.density });

    for (let i = 0; i < 3; i++) {
      const offsetX = Math.cos(i * 2.1 + colony.seed) * (r * 0.20);
      const offsetY = Math.sin(i * 2.1 + colony.seed) * (r * 0.20);
      const cloudShape = this.generateOrganicPolygon(r * 0.42, r * 0.38, colony.seed + i * 4, 12);
      
      const shiftedPoints = cloudShape.map((val, idx) => idx % 2 === 0 ? val + offsetX : val + offsetY);
      g.poly(shiftedPoints).fill({ color: milkyWhite, alpha: (0.05 / 3) * colony.density });
    }

    const coreShape = this.generateOrganicPolygon(r * 0.35, r * 0.30, colony.seed + 5, 12);
    g.poly(coreShape).fill({ color: milkyWhite, alpha: (0.05 / 3) * colony.density });
  }

  /**
   * 4. Цианобактерии: Полупрозрачные тонкие волокна (Прозрачность x3)
   */
  private drawCyanobacteriaColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const limeColor = 0x22C55E;
    const darkGreen = 0x15803D;

    const outerShape = this.generateOrganicPolygon(r * 1.1, r * 0.65, colony.seed, 16);
    g.poly(outerShape).fill({ color: darkGreen, alpha: (0.08 / 3) * colony.density });

    const numLines = 9;
    for (let i = 0; i < numLines; i++) {
      const offsetY = ((i - numLines / 2) / numLines) * (r * 0.70);
      const curve = Math.sin(i * 0.8 + colony.seed) * 10;
      
      const p1X = -r * 0.70;
      const p1Y = offsetY - curve;
      const p2X = r * 0.70;
      const p2Y = offsetY + curve;

      g.moveTo(p1X, p1Y)
       .lineTo(p2X, p2Y)
       .stroke({ width: 2.5, color: limeColor, alpha: (0.30 / 3) * colony.density });
    }
  }

  /**
   * Обновление состояния: запуск физики движения + синхронизация со спрайтами + отсечение вне экрана
   * @param cameraBounds Мировые границы видимой области камеры (опционально)
   */
  public update(
    dt: number,
    _isNight: boolean,
    cameraBounds?: { left: number; right: number; top: number; bottom: number }
  ): void {
    for (let i = 0; i < this.planktonList.length; i++) {
      const colony = this.planktonList[i];

      // 1. Физика дрейфа и скольжения по береговой линии
      colony.update(dt, this.currentsManager);

      // 2. Синхронизация спрайта и отсечение невидимых объектов (Frustum Culling)
      const sprite = this.colonySprites[i];
      if (sprite) {
        sprite.x = colony.x;
        sprite.y = colony.y;
        sprite.rotation = colony.rotation;

        if (cameraBounds) {
          const margin = colony.radius * 1.5;
          sprite.visible =
            colony.x + margin >= cameraBounds.left &&
            colony.x - margin <= cameraBounds.right &&
            colony.y + margin >= cameraBounds.top &&
            colony.y - margin <= cameraBounds.bottom;
        }
      }
    }
  }
}
