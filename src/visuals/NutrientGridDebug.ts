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

    // Включаем округление пикселей: убирает микро-дрожание сетки при зуме и панорамировании
    this.container.roundPixels = true;

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
   * Отрисовка УНИКАЛЬНЫХ отрезков сетки (без двойных граней и муара)
   */
  public renderGrid(): void {
    if (this.isRendered) return;

    this.gridGraphics.clear();
    const cellSize = this.nutrientGrid.CELL_SIZE;
    const g = this.gridGraphics as any;

    // Множества для хранения УНИКАЛЬНЫХ граней
    const hEdges = new Set<string>(); // Горизонтальные отрезки "cx,cy"
    const vEdges = new Set<string>(); // Вертикальные отрезки "cx,cy"

    // Собираем границы только для водных ячеек
    for (const cell of this.nutrientGrid.cells) {
      if (!cell.isLand) {
        const cx = cell.gridX;
        const cy = cell.gridY;

        hEdges.add(`${cx},${cy}`);       // Верхняя грань
        hEdges.add(`${cx},${cy + 1}`);   // Нижняя грань
        vEdges.add(`${cx},${cy}`);       // Левая грань
        vEdges.add(`${cx + 1},${cy}`);   // Правая грань
      }
    }

    const isV8 = typeof g.moveTo === 'function';

    // Отрисовываем каждую горизонтальную линию строго 1 раз
    for (const edge of hEdges) {
      const [cxStr, cyStr] = edge.split(',');
      const cx = parseInt(cxStr, 10);
      const cy = parseInt(cyStr, 10);
      const x1 = cx * cellSize;
      const y = cy * cellSize;
      const x2 = (cx + 1) * cellSize;

      if (isV8) {
        g.moveTo(x1, y);
        g.lineTo(x2, y);
      } else {
        g.lineStyle(1, 0x00e5ff, 0.35);
        g.moveTo(x1, y);
        g.lineTo(x2, y);
      }
    }

    // Отрисовываем каждую вертикальную линию строго 1 раз
    for (const edge of vEdges) {
      const [cxStr, cyStr] = edge.split(',');
      const cx = parseInt(cxStr, 10);
      const cy = parseInt(cyStr, 10);
      const x = cx * cellSize;
      const y1 = cy * cellSize;
      const y2 = (cy + 1) * cellSize;

      if (isV8) {
        g.moveTo(x, y1);
        g.lineTo(x, y2);
      } else {
        g.lineStyle(1, 0x00e5ff, 0.35);
        g.moveTo(x, y1);
        g.lineTo(x, y2);
      }
    }

    // Запекаем векторы в единый чистый stroke
    if (typeof g.stroke === 'function') {
      g.stroke({
        width: 1,
        color: 0x00e5ff,
        alpha: 0.35,
      });
    }

    this.isRendered = true;
  }

  public setVisible(visible: boolean): void {
    this.container.visible = visible;

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
