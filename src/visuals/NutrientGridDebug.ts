// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private backgroundOverlay: PIXI.Graphics;
  private gridGraphics: PIXI.Graphics;
  private nutrientGrid: NutrientGrid;
  private isVisible: boolean = false;

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
   * Затемнение океана (такое же, как при просмотре течений)
   */
  private renderOverlay(): void {
    this.backgroundOverlay.clear();
    this.backgroundOverlay.beginFill(0x020813, 0.7); // Тёмно-синий/чёрный полупрозрачный слой
    this.backgroundOverlay.drawRect(0, 0, this.nutrientGrid.WORLD_SIZE, this.nutrientGrid.WORLD_SIZE);
    this.backgroundOverlay.endFill();
  }

  /**
   * Отрисовка линий сетки с выдерживанием береговой линии
   */
  public renderGrid(): void {
    this.gridGraphics.clear();

    const cellSize = this.nutrientGrid.CELL_SIZE;
    
    // Стиль сетки: неоново-голубые тонкие линии с прозрачностью 25%
    this.gridGraphics.lineStyle(1, 0x4aa0ed, 0.25);

    for (const cell of this.nutrientGrid.cells) {
      // Рисуем квадрат ТОЛЬКО если клетка находится в океане
      if (!cell.isLand) {
        this.gridGraphics.drawRect(cell.worldX, cell.worldY, cellSize, cellSize);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.visible = this.isVisible;
  }

  public toggle(): boolean {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
