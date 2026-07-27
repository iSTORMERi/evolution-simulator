// src/visuals/PlanktonOverlay.ts

import * as PIXI from 'pixi.js';
import { SurfacePlankton, PlanktonType } from '../entities/SurfacePlankton';
import { OceanCurrentsManager } from '../simulation/OceanCurrentsManager';

export class PlanktonOverlay {
  public container: PIXI.Container;
  private planktonList: SurfacePlankton[] = [];
  private colonyGraphics: PIXI.Container[] = [];
  private currentsManager: OceanCurrentsManager;
  private worldWidth: number;
  private worldHeight: number;

  constructor(
    _app: PIXI.Application,
    currentsManager: OceanCurrentsManager,
    _count: number = 600,
    worldWidth: number = 8000,
    worldHeight: number = 8000,
    customColonies?: SurfacePlankton[]
  ) {
    this.container = new PIXI.Container();
    this.currentsManager = currentsManager;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.planktonList = customColonies ?? SurfacePlankton.createDefaultTestColonies(worldWidth, worldHeight);

    for (const colony of this.planktonList) {
      const visual = this.createColonyGraphics(colony);
      this.colonyGraphics.push(visual);
      this.container.addChild(visual);
    }
  }

  private createColonyGraphics(colony: SurfacePlankton): PIXI.Container {
    const container = new PIXI.Container();
    container.x = colony.x;
    container.y = colony.y;
    container.rotation = colony.rotation;

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

    container.addChild(g);

    // Легкий размывающий фильтр исключительно для сглаживания граней
    container.filters = [new PIXI.BlurFilter({ strength: 5, quality: 2 })];

    return container;
  }

  /**
   * Генерация волнистых органических полигонов
   */
  private generateOrganicPolygon(
    baseRadiusX: number,
    baseRadiusY: number,
    seed: number,
    numPoints: number = 16
  ): number[] {
    const points: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      
      const noise1 = Math.sin(angle * 3 + seed) * 0.20;
      const noise2 = Math.cos(angle * 5 + seed * 1.7) * 0.12;
      const factor = 1 + noise1 + noise2;

      const rx = baseRadiusX * factor;
      const ry = baseRadiusY * factor;

      points.push(Math.cos(angle) * rx, Math.sin(angle) * ry);
    }
    return points;
  }

  /**
   * 1. Диатомеи: Вытянутая оливково-золотая струя
   */
  private drawDiatomsColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const goldColor = 0xC59B27;  // Более сочный золотой
    const oliveColor = 0x6B8E23; // Насыщенный оливковый

    // Размытый внешний ореол
    const outerShape = this.generateOrganicPolygon(r * 1.4, r * 0.5, colony.seed, 18);
    g.poly(outerShape).fill({ color: goldColor, alpha: 0.25 * colony.density });

    // Среднее тело струи
    const midShape = this.generateOrganicPolygon(r * 1.0, r * 0.38, colony.seed + 1.5, 16);
    g.poly(midShape).fill({ color: goldColor, alpha: 0.50 * colony.density });

    // Плотное ядро
    const coreShape = this.generateOrganicPolygon(r * 0.6, r * 0.22, colony.seed + 3.0, 14);
    g.poly(coreShape).fill({ color: oliveColor, alpha: 0.75 * colony.density });
  }

  /**
   * 2. Динофлагеллаты: Багрово-красное очерченное пятно
   */
  private drawDinoflagellatesColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const rustRed = 0xB22222;  // Яркий багровый
    const deepMaroon = 0x6B0000;

    const outerShape = this.generateOrganicPolygon(r * 1.1, r * 0.85, colony.seed, 16);
    g.poly(outerShape).fill({ color: rustRed, alpha: 0.30 * colony.density });

    const midShape = this.generateOrganicPolygon(r * 0.75, r * 0.55, colony.seed + 1.2, 14);
    g.poly(midShape).fill({ color: rustRed, alpha: 0.55 * colony.density });

    const coreShape = this.generateOrganicPolygon(r * 0.45, r * 0.35, colony.seed + 2.5, 12);
    g.poly(coreShape).fill({ color: deepMaroon, alpha: 0.80 * colony.density });
  }

  /**
   * 3. Кокколитофориды: Яркое молочно-бирюзовое облако
   */
  private drawCoccolithophoresColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const turquoise = 0x00CED1; // Яркая бирюза
    const milkyWhite = 0xF0FFFF; // Светло-молочный

    const outerShape = this.generateOrganicPolygon(r * 1.2, r * 1.0, colony.seed, 18);
    g.poly(outerShape).fill({ color: turquoise, alpha: 0.28 * colony.density });

    // Вихревые пятна
    for (let i = 0; i < 3; i++) {
      const offsetX = Math.cos(i * 2.1 + colony.seed) * (r * 0.22);
      const offsetY = Math.sin(i * 2.1 + colony.seed) * (r * 0.22);
      const cloudShape = this.generateOrganicPolygon(r * 0.45, r * 0.4, colony.seed + i * 4, 12);
      
      const shiftedPoints = cloudShape.map((val, idx) => idx % 2 === 0 ? val + offsetX : val + offsetY);
      g.poly(shiftedPoints).fill({ color: milkyWhite, alpha: 0.45 * colony.density });
    }

    const coreShape = this.generateOrganicPolygon(r * 0.4, r * 0.35, colony.seed + 5, 12);
    g.poly(coreShape).fill({ color: milkyWhite, alpha: 0.70 * colony.density });
  }

  /**
   * 4. Цианобактерии: Сочная салатовая нитевидная паутина
   */
  private drawCyanobacteriaColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const limeColor = 0x00FF66;  // Кислотно-салатовый
    const darkGreen = 0x1E8449;

    const outerShape = this.generateOrganicPolygon(r * 1.2, r * 0.7, colony.seed, 16);
    g.poly(outerShape).fill({ color: darkGreen, alpha: 0.22 * colony.density });

    const numLines = 10;
    for (let i = 0; i < numLines; i++) {
      const offsetY = ((i - numLines / 2) / numLines) * (r * 0.75);
      const curve = Math.sin(i * 0.8 + colony.seed) * 12;
      
      const p1X = -r * 0.75;
      const p1Y = offsetY - curve;
      const p2X = r * 0.75;
      const p2Y = offsetY + curve;

      g.moveTo(p1X, p1Y)
       .lineTo(p2X, p2Y)
       .stroke({ width: 5 + Math.random() * 3, color: limeColor, alpha: 0.50 * colony.density });
    }
  }

  public update(_dt: number, _isNight: boolean): void {
    for (let i = 0; i < this.planktonList.length; i++) {
      const colony = this.planktonList[i];
      const visual = this.colonyGraphics[i];

      if (visual) {
        visual.x = colony.x;
        visual.y = colony.y;
        visual.rotation = colony.rotation;
      }
    }
  }
}
