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

  /**
   * Генерация визуального стиля колонии в виде мягкого органического пятна
   */
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

    // Главный секрет акварельного растворения: накладываем размытие на всю колонию
    const blurStrength = colony.radius * 0.18 + 12;
    container.filters = [new PIXI.BlurFilter({ strength: blurStrength, quality: 3 })];

    return container;
  }

  /**
   * Генератор органических деформированных полигонов (без жесткой геометрии)
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
      
      // Наложение двух синусоид создает естественную асимметричную деформацию
      const noise1 = Math.sin(angle * 3 + seed) * 0.22;
      const noise2 = Math.cos(angle * 5 + seed * 1.7) * 0.15;
      const factor = 1 + noise1 + noise2;

      const rx = baseRadiusX * factor;
      const ry = baseRadiusY * factor;

      points.push(Math.cos(angle) * rx, Math.sin(angle) * ry);
    }
    return points;
  }

  /**
   * 1. Диатомеи: Нежное оливково-золотое пятно, вытянутое по течению
   */
  private drawDiatomsColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const goldColor = 0x9E7808; // Янтарно-золотой
    const oliveColor = 0x4D5E21; // Оливковый

    // Внешний размытый ореол (очень прозрачный)
    const outerShape = this.generateOrganicPolygon(r * 1.5, r * 0.55, colony.seed, 20);
    g.poly(outerShape).fill({ color: goldColor, alpha: 0.12 * colony.density });

    // Средний слой
    const midShape = this.generateOrganicPolygon(r * 1.1, r * 0.4, colony.seed + 1.5, 18);
    g.poly(midShape).fill({ color: goldColor, alpha: 0.22 * colony.density });

    // Плотное, но размытое ядро
    const coreShape = this.generateOrganicPolygon(r * 0.6, r * 0.25, colony.seed + 3.0, 14);
    g.poly(coreShape).fill({ color: oliveColor, alpha: 0.35 * colony.density });
  }

  /**
   * 2. Динофлагеллаты: Мягкое полупрозрачное багрово-красное пятно
   */
  private drawDinoflagellatesColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const rustRed = 0x8B2222;
    const deepMaroon = 0x500A0A;

    // Внешняя асимметричная полутень
    const outerShape = this.generateOrganicPolygon(r * 1.1, r * 0.9, colony.seed, 16);
    g.poly(outerShape).fill({ color: rustRed, alpha: 0.15 * colony.density });

    // Внутреннее полупрозрачное ядро
    const coreShape = this.generateOrganicPolygon(r * 0.6, r * 0.5, colony.seed + 2.1, 14);
    g.poly(coreShape).fill({ color: deepMaroon, alpha: 0.30 * colony.density });
  }

  /**
   * 3. Кокколитофориды: Молочно-бирюзовое дымчатое облако
   */
  private drawCoccolithophoresColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const turquoise = 0x30D5C8;
    const milkyWhite = 0xDBF3F0;

    // Внешний дымчатый ореол
    const outerShape = this.generateOrganicPolygon(r * 1.3, r * 1.1, colony.seed, 18);
    g.poly(outerShape).fill({ color: turquoise, alpha: 0.14 * colony.density });

    // Несколько наложенных смещенных суб-облаков (создают эффект вихря)
    for (let i = 0; i < 3; i++) {
      const offsetX = Math.cos(i * 2.1 + colony.seed) * (r * 0.25);
      const offsetY = Math.sin(i * 2.1 + colony.seed) * (r * 0.25);
      const cloudShape = this.generateOrganicPolygon(r * 0.5, r * 0.45, colony.seed + i * 4, 12);
      
      // Сдвигаем координаты точек
      const shiftedPoints = cloudShape.map((val, idx) => idx % 2 === 0 ? val + offsetX : val + offsetY);
      g.poly(shiftedPoints).fill({ color: milkyWhite, alpha: 0.18 * colony.density });
    }

    // Молочный центр
    const coreShape = this.generateOrganicPolygon(r * 0.4, r * 0.35, colony.seed + 5, 12);
    g.poly(coreShape).fill({ color: milkyWhite, alpha: 0.28 * colony.density });
  }

  /**
   * 4. Цианобактерии: Волнистая салатовая туманность с мягкой волокнистостью
   */
  private drawCyanobacteriaColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const limeColor = 0x22C55E;
    const darkGreen = 0x15803D;

    // Мягкое фоновое пятно
    const outerShape = this.generateOrganicPolygon(r * 1.2, r * 0.7, colony.seed, 16);
    g.poly(outerShape).fill({ color: darkGreen, alpha: 0.10 * colony.density });

    // Изогнутые волокнистые штрихи, размытые в единую массу
    const numLines = 8;
    for (let i = 0; i < numLines; i++) {
      const offsetY = ((i - numLines / 2) / numLines) * (r * 0.8);
      const curve = Math.sin(i * 0.8 + colony.seed) * 15;
      
      const p1X = -r * 0.8;
      const p1Y = offsetY - curve;
      const p2X = r * 0.8;
      const p2Y = offsetY + curve;

      g.moveTo(p1X, p1Y)
       .lineTo(p2X, p2Y)
       .stroke({ width: 6 + Math.random() * 4, color: limeColor, alpha: 0.18 * colony.density });
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
