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
   * Затемнение океана
   */
  private renderOverlay(): void {
    this.backgroundOverlay.clear();
    
    // Адаптивная поддержка PixiJS v8 / v7
    if (typeof (this.backgroundOverlay as any).rect === 'function') {
      this.backgroundOverlay.rect(0, 0, this.nutrientGrid.WORLD_SIZE, this.nutrientGrid.WORLD_SIZE);
      this.backgroundOverlay.fill({ color: 0x020813, alpha: 0.7 });
    } else {
      (this.backgroundOverlay as any).beginFill(0x020813, 0.7);
      (this.backgroundOverlay as any).drawRect(0, 0, this.nutrientGrid.WORLD_SIZE, this.nutrientGrid.WORLD_SIZE);
      (this.backgroundOverlay as any).endFill();
    }
  }

  /**
   * Отрисовка контуров сетки с поддержкой PixiJS v8
   */
  public renderGrid(): void {
    this.gridGraphics.clear();
    const cellSize = this.nutrientGrid.CELL_SIZE;

    // Проверяем, поддерживает ли PixiJS v8 метод rect()
    const isV8 = typeof (this.gridGraphics as any).rect === 'function';
    let oceanCellCount = 0;

    for (const cell of this.nutrientGrid.cells) {
      if (!cell.isLand) {
        oceanCellCount++;
        if (isV8) {
          this.gridGraphics.rect(cell.worldX, cell.worldY, cellSize, cellSize);
        } else {
          (this.gridGraphics as any).lineStyle(2, 0x00e5ff, 0.5);
          (this.gridGraphics as any).drawRect(cell.worldX, cell.worldY, cellSize, cellSize);
        }
      }
    }

    // В PixiJS v8 применяем обводку ко всем накопленным прямоугольникам за один вызов
    if (isV8) {
      this.gridGraphics.stroke({ width: 2, color: 0x00e5ff, alpha: 0.5 });
    }

    // Защитный фоллбек: если маска суши еще не успела просканироваться, рисуем сетку поверх всех клеток
    if (oceanCellCount === 0) {
      for (const cell of this.nutrientGrid.cells) {
        if (isV8) {
          this.gridGraphics.rect(cell.worldX, cell.worldY, cellSize, cellSize);
        } else {
          (this.gridGraphics as any).lineStyle(2, 0x00e5ff, 0.5);
          (this.gridGraphics as any).drawRect(cell.worldX, cell.worldY, cellSize, cellSize);
        }
      }
      if (isV8) {
        this.gridGraphics.stroke({ width: 2, color: 0x00e5ff, alpha: 0.5 });
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.container.visible = this.isVisible;

    if (this.isVisible) {
      // Обновляем сетку перед каждым отображением
      this.nutrientGrid.initGrid();
      this.renderGrid();
    }
  }

  public toggle(): boolean {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
