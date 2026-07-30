// src/simulation/NutrientGrid.ts

import { OceanCurrentsManager } from './OceanCurrentsManager';

export interface GridCell {
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;
  isLand: boolean;
  // Сюда в дальнейшем добавим массы веществ (N, P, C и т.д.)
}

export class NutrientGrid {
  public readonly CELL_SIZE = 100;
  public readonly WORLD_SIZE = 8000;
  public readonly cols: number;
  public readonly rows: number;

  public cells: GridCell[] = [];
  private currentsManager: OceanCurrentsManager;

  constructor(currentsManager: OceanCurrentsManager) {
    this.currentsManager = currentsManager;
    this.cols = Math.ceil(this.WORLD_SIZE / this.CELL_SIZE);
    this.rows = Math.ceil(this.WORLD_SIZE / this.CELL_SIZE);

    this.initGrid();
  }

  public initGrid(): void {
    this.cells = new Array(this.cols * this.rows);

    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const index = cy * this.cols + cx;
        const worldX = cx * this.CELL_SIZE;
        const worldY = cy * this.CELL_SIZE;

        // Берем центр ячейки для точной проверки маски суши
        const centerX = worldX + this.CELL_SIZE * 0.5;
        const centerY = worldY + this.CELL_SIZE * 0.5;

        // Проверяем, является ли точка сушей
        // (Используем метод проверки маски из вашего OceanCurrentsManager)
        const isLand = this.currentsManager.isLandAt 
          ? this.currentsManager.isLandAt(centerX, centerY) 
          : false;

        this.cells[index] = {
          gridX: cx,
          gridY: cy,
          worldX,
          worldY,
          isLand
        };
      }
    }
  }

  public getCell(gridX: number, gridY: number): GridCell | null {
    if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
      return null;
    }
    return this.cells[gridY * this.cols + gridX];
  }
}
