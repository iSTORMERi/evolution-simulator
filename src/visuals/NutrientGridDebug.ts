// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private backgroundOverlay: PIXI.Graphics;
  private gridGraphics: PIXI.Graphics;
  private nutrientGrid: NutrientGrid;

  constructor(nutrientGrid: NutrientGrid) {
    this.nutrientGrid = nutrientGrid;
    this.container = new PIXI.Container();
    this.container.visible = false;

    this.backgroundOverlay = new PIXI.Graphics();
    this.gridGraphics = new PIXI.Graphics();

    this.container.addChild(this.backgroundOverlay);
    this.container.addChild(this.gridGraphics);

    this.renderOverlay();
    this.renderGrid();
  }

  /**
   * Затемнение подложки океана (8000x8000)
   */
  private renderOverlay(): void {
    this.backgroundOverlay.clear();
    const g = this.backgroundOverlay as any;

    if (typeof g.rect === 'function') {
      g.rect(0, 0, this.nutrientGrid.WORLD_SIZE, this.nutrientGrid.WORLD_SIZE);
      g.fill({ color: 0x020813, alpha: 0.65 });
    } else {
      g.beginFill(0x020813, 0.65);
      g.drawRect(0, 0, this.nutrientGrid.WORLD_SIZE, this.nutrientGrid.WORLD_SIZE);
      g.endFill();
    }
  }

  /**
   * Отрисовка 81x81 сплошных сквозных линий игрового мира
   */
  public renderGrid(): void {
    this.gridGraphics.clear();

    const worldSize = this.nutrientGrid.WORLD_SIZE; // 8000
    const cellSize = this.nutrientGrid.CELL_SIZE;   // 100
    const numCells = Math.round(worldSize / cellSize); // 80

    const g = this.gridGraphics as any;
    const isV8 = typeof g.moveTo === 'function';

    // 1. Сплошные горизонтальные линии (y: 0, 100, 200 ... 8000)
    for (let i = 0; i <= numCells; i++) {
      const y = i * cellSize;
      if (isV8) {
        g.moveTo(0, y);
        g.lineTo(worldSize, y);
      } else {
        g.lineStyle(1, 0x00e5ff, 0.3);
        g.moveTo(0, y);
        g.lineTo(worldSize, y);
      }
    }

    // 2. Сплошные вертикальные линии (x: 0, 100, 200 ... 8000)
    for (let i = 0; i <= numCells; i++) {
      const x = i * cellSize;
      if (isV8) {
        g.moveTo(x, 0);
        g.lineTo(x, worldSize);
      } else {
        g.lineStyle(1, 0x00e5ff, 0.3);
        g.moveTo(x, 0);
        g.lineTo(x, worldSize);
      }
    }

    // Запекаем линии в единый stroke для PixiJS v8
    if (typeof g.stroke === 'function') {
      g.stroke({
        width: 1,
        color: 0x00e5ff,
        alpha: 0.3,
      });
    }
  }

  public setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  public toggle(): boolean {
    const nextState = !this.container.visible;
    this.setVisible(nextState);
    return nextState;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
