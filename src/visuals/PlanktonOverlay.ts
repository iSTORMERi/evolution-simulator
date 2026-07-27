// src/visuals/PlanktonOverlay.ts

import * as PIXI from 'pixi.js';
import { SurfacePlankton, PlanktonType, PlanktonLifeStage } from '../entities/SurfacePlankton';
import { OceanCurrentsManager } from '../simulation/OceanCurrentsManager';

export class PlanktonOverlay {
  public static readonly MAX_COLONIES = 250; // Жёсткий лимит популяции на карту

  public container: PIXI.Container;
  private planktonList: SurfacePlankton[] = [];
  private colonyGraphics: PIXI.Container[] = [];
  private currentsManager: OceanCurrentsManager;
  private worldWidth: number;
  private worldHeight: number;

  constructor(
    _app: PIXI.Application,
    currentsManager: OceanCurrentsManager,
    _count: number = 200,
    worldWidth: number = 8000,
    worldHeight: number = 8000,
    customColonies?: SurfacePlankton[]
  ) {
    this.container = new PIXI.Container();
    this.currentsManager = currentsManager;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // 🎯 Всего 1 проход размытия на весь оверлей для высокой производительности
    this.container.filters = [new PIXI.BlurFilter({ strength: 0.8, quality: 1 })];

    // Инициализация колоний
    this.planktonList = customColonies ?? SurfacePlankton.createDefaultTestColonies(
      this.worldWidth,
      this.worldHeight,
      this.currentsManager
    );

    for (const colony of this.planktonList) {
      const visual = this.createColonyGraphics(colony);
      this.colonyGraphics.push(visual);
      this.container.addChild(visual);
    }
  }

  /**
   * Фабрика создания графики колонии в максимальном размере (масштаб подстраивается динамически)
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
    return container;
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
   * 1. Диатомеи
   */
  private drawDiatomsColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.maxRadius;
    const goldColor = 0xC59B27;
    const oliveColor = 0x6B8E23;

    const outerShape = this.generateOrganicPolygon(r * 1.35, r * 0.48, colony.seed, 18);
    g.poly(outerShape).fill({ color: goldColor, alpha: 0.02 });

    const midShape = this.generateOrganicPolygon(r * 0.95, r * 0.35, colony.seed + 1.5, 16);
    g.poly(midShape).fill({ color: goldColor, alpha: 0.03 });

    const coreShape = this.generateOrganicPolygon(r * 0.55, r * 0.20, colony.seed + 3.0, 14);
    g.poly(coreShape).fill({ color: oliveColor, alpha: 0.04 });
  }

  /**
   * 2. Динофлагеллаты
   */
  private drawDinoflagellatesColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.maxRadius;
    const rustRed = 0xB22222;
    const deepMaroon = 0x6B0000;

    const outerShape = this.generateOrganicPolygon(r * 1.1, r * 0.85, colony.seed, 16);
    g.poly(outerShape).fill({ color: rustRed, alpha: 0.02 });

    const midShape = this.generateOrganicPolygon(r * 0.72, r * 0.52, colony.seed + 1.2, 14);
    g.poly(midShape).fill({ color: rustRed, alpha: 0.03 });

    const coreShape = this.generateOrganicPolygon(r * 0.40, r * 0.30, colony.seed + 2.5, 12);
    g.poly(coreShape).fill({ color: deepMaroon, alpha: 0.04 });
  }

  /**
   * 3. Кокколитофориды
   */
  private drawCoccolithophoresColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.maxRadius;
    const turquoise = 0x00CED1;
    const milkyWhite = 0xF0FFFF;

    const outerShape = this.generateOrganicPolygon(r * 1.2, r * 0.95, colony.seed, 18);
    g.poly(outerShape).fill({ color: turquoise, alpha: 0.02 });

    for (let i = 0; i < 3; i++) {
      const offsetX = Math.cos(i * 2.1 + colony.seed) * (r * 0.20);
      const offsetY = Math.sin(i * 2.1 + colony.seed) * (r * 0.20);
      const cloudShape = this.generateOrganicPolygon(r * 0.42, r * 0.38, colony.seed + i * 4, 12);
      
      const shiftedPoints = cloudShape.map((val, idx) => idx % 2 === 0 ? val + offsetX : val + offsetY);
      g.poly(shiftedPoints).fill({ color: milkyWhite, alpha: 0.03 });
    }

    const coreShape = this.generateOrganicPolygon(r * 0.35, r * 0.30, colony.seed + 5, 12);
    g.poly(coreShape).fill({ color: milkyWhite, alpha: 0.03 });
  }

  /**
   * 4. Цианобактерии
   */
  private drawCyanobacteriaColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.maxRadius;
    const limeColor = 0x22C55E;
    const darkGreen = 0x15803D;

    const outerShape = this.generateOrganicPolygon(r * 1.1, r * 0.65, colony.seed, 16);
    g.poly(outerShape).fill({ color: darkGreen, alpha: 0.04 });

    const numLines = 9;
    for (let i = 0; i < numLines; i++) {
      const offsetY = ((i - numLines / 2) / numLines) * (r * 0.70);
      const curve = Math.sin(i * 0.8 + colony.seed) * 10;

      g.moveTo(-r * 0.70, offsetY - curve)
       .lineTo(r * 0.70, offsetY + curve)
       .stroke({ width: 2.5, color: limeColor, alpha: 0.15 });
    }
  }

  /**
   * Добавление новой (дочерней) колонии при делении
   */
  private spawnChildColony(colony: SurfacePlankton): void {
    if (this.planktonList.length >= PlanktonOverlay.MAX_COLONIES) return;

    this.planktonList.push(colony);
    const visual = this.createColonyGraphics(colony);
    this.colonyGraphics.push(visual);
    this.container.addChild(visual);
  }

  /**
   * Обновление состояния: Физика + Жизненный цикл + Синхронизация графики и Frustum Culling
   */
  public update(
    dt: number,
    _isNight: boolean,
    cameraBounds?: { left: number; right: number; top: number; bottom: number }
  ): void {
    const canSplit = this.planktonList.length < PlanktonOverlay.MAX_COLONIES;

    for (let i = this.planktonList.length - 1; i >= 0; i--) {
      const colony = this.planktonList[i];

      // 1. Движение по течению
      colony.update(dt, this.currentsManager);

      // 2. Жизненный цикл (рост, увядание, деление)
      const childColony = colony.updateLifecycle(dt, this.currentsManager, canSplit);
      if (childColony) {
        this.spawnChildColony(childColony);
      }

      // 3. Удаление погибших колоний
      if (colony.lifeStage === PlanktonLifeStage.DEAD) {
        const visual = this.colonyGraphics[i];
        if (visual) {
          this.container.removeChild(visual);
          visual.destroy();
        }
        this.planktonList.splice(i, 1);
        this.colonyGraphics.splice(i, 1);
        continue;
      }

      // 4. Синхронизация визуального слоя и отсечение невиданных объектов (Frustum Culling)
      const visual = this.colonyGraphics[i];
      if (visual) {
        visual.x = colony.x;
        visual.y = colony.y;
        visual.rotation = colony.rotation;
        visual.alpha = colony.density;

        // Масштаб зависит от текущего возраста/радиуса
        const scale = colony.radius / colony.maxRadius;
        visual.scale.set(scale);

        if (cameraBounds) {
          const margin = colony.radius * 1.5;
          visual.visible =
            colony.x + margin >= cameraBounds.left &&
            colony.x - margin <= cameraBounds.right &&
            colony.y + margin >= cameraBounds.top &&
            colony.y - margin <= cameraBounds.bottom;
        }
      }
    }
  }
}
