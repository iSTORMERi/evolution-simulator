// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private backgroundOverlay: PIXI.Graphics;
  private tilingSprite: PIXI.TilingSprite | null = null;
  private nutrientGrid: NutrientGrid;
  private app: PIXI.Application;

  constructor(nutrientGrid: NutrientGrid, app: PIXI.Application) {
    this.nutrientGrid = nutrientGrid;
    this.app = app;

    this.container = new PIXI.Container();
    this.container.visible = false;

    // Затемнение подложки
    this.backgroundOverlay = new PIXI.Graphics();
    this.renderOverlay();
    this.container.addChild(this.backgroundOverlay);

    // Создаем стабильную сетку через TilingSprite
    this.createTilingGrid();
  }

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
   * Генерация идеальной бесконечной сетки без применения векторных линий
   */
  private createTilingGrid(): void {
    const cellSize = this.nutrientGrid.CELL_SIZE; // 100px

    // 1. Рисуем ОДНУ ячейку 100x100 во временную графику
    const cellGraphic = new PIXI.Graphics();
    const g = cellGraphic as any;

    if (typeof g.rect === 'function') {
      g.rect(0, 0, cellSize, cellSize);
      g.stroke({ width: 1, color: 0x00e5ff, alpha: 0.35 });
    } else {
      g.lineStyle(1, 0x00e5ff, 0.35);
      g.drawRect(0, 0, cellSize, cellSize);
    }

    // 2. Генерируем из неё растровую текстуру
    const texture = this.app.renderer.generateTexture(cellGraphic);
    cellGraphic.destroy();

    // 3. Создаем TilingSprite на всю карту (8000x8000)
    if (typeof (PIXI as any).TilingSprite === 'function') {
      this.tilingSprite = new (PIXI as any).TilingSprite({
        texture: texture,
        width: this.nutrientGrid.WORLD_SIZE,
        height: this.nutrientGrid.WORLD_SIZE,
      });
    } else {
      this.tilingSprite = new PIXI.TilingSprite(
        texture,
        this.nutrientGrid.WORLD_SIZE,
        this.nutrientGrid.WORLD_SIZE
      );
    }

    this.container.addChild(this.tilingSprite);
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
