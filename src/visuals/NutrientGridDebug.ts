// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private backgroundOverlay: PIXI.Graphics;
  private gridGraphics: PIXI.Graphics;
  private nutrientGrid: NutrientGrid;
  private isRendered: boolean = false;

  constructor(nutrientGrid: NutrientGrid) {
    this.nutrientGrid = nutrientGrid;
    this.container = new PIXI.Container();
    this.container.visible = false;

    this.backgroundOverlay = new PIXI.Graphics();
    this.gridGraphics = new PIXI.Graphics();

    this.container.addChild(this.backgroundOverlay);
    this.container.addChild(this.gridGraphics);

    this.renderOverlay();
  }

  /**
   * Статичное затемнение океанской глади (8000x8000)
   */
  private renderOverlay(): void {
    this.backgroundOverlay.clear();
    
    if (typeof (this.backgroundOverlay as any).rect === 'function') {
      this.backgroundOverlay.rect(0, 0, this.nutrientGrid.WORLD_SIZE, this.nutrientGrid.WORLD_SIZE);
      this.backgroundOverlay.fill({ color: 0x020813, alpha: 0.65 });
    } else {
      (this.backgroundOverlay as any).beginFill(0x020813, 0.65);
      (this.backgroundOverlay as any).drawRect(0, 0, this.nutrientGrid.WORLD_SIZE, this.nutrientGrid.WORLD_SIZE);
      (this.backgroundOverlay as any).endFill();
    }
  }

  /**
   * Фиксированная однократная отрисовка мировой сетки 100x100 px
   */
  public renderGrid(): void {
    if (this.isRendered) return; // Гарантирует, что сетка строится ровно 1 раз

    this.gridGraphics.clear();
    const cellSize = this.nutrientGrid.CELL_SIZE;
    const isV8 = typeof (this.gridGraphics as any).rect === 'function';

    // Отрисовываем квадраты строго по координатам клеток океана
    for (const cell of this.nutrientGrid.cells) {
      if (!cell.isLand) {
        if (isV8) {
          this.gridGraphics.rect(cell.worldX, cell.worldY, cellSize, cellSize);
        } else {
          (this.gridGraphics as any).drawRect(cell.worldX, cell.worldY, cellSize, cellSize);
        }
      }
    }

    // Тонкая стабильная обводка сетки
    if (isV8) {
      this.gridGraphics.stroke({
        width: 1,
        color: 0x00e5ff,
        alpha: 0.3,
      });
    } else {
      (this.gridGraphics as any).lineStyle(1, 0x00e5ff, 0.3);
    }

    this.isRendered = true;
  }

  public setVisible(visible: boolean): void {
    this.container.visible = visible;

    // Первичный рендер при первом включении
    if (visible && !this.isRendered) {
      this.renderGrid();
    }
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
