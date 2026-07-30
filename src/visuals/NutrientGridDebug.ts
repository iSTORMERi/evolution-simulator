// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private backgroundOverlay: PIXI.Graphics;
  private gridGraphics: PIXI.Graphics;
  private nutrientGrid: NutrientGrid;
  private app: PIXI.Application;
  private worldContainer: PIXI.Container;

  constructor(nutrientGrid: NutrientGrid, app: PIXI.Application, worldContainer: PIXI.Container) {
    this.nutrientGrid = nutrientGrid;
    this.app = app;
    this.worldContainer = worldContainer;

    this.container = new PIXI.Container();
    this.container.visible = false;

    this.backgroundOverlay = new PIXI.Graphics();
    this.gridGraphics = new PIXI.Graphics();

    this.container.addChild(this.backgroundOverlay);
    this.container.addChild(this.gridGraphics);
  }

  /**
   * Перерисовка сетки в реальном времени строго в экранных пикселях
   */
  public update(): void {
    if (!this.container.visible) return;

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    const scaleX = this.worldContainer.scale.x;
    const scaleY = this.worldContainer.scale.y;
    const posX = this.worldContainer.position.x;
    const posY = this.worldContainer.position.y;

    const cellSize = this.nutrientGrid.CELL_SIZE; // 100
    const numCells = Math.round(this.nutrientGrid.WORLD_SIZE / cellSize); // 80

    this.backgroundOverlay.clear();
    this.gridGraphics.clear();

    // 1. Границы видимой области мира в экранных координатах
    const minWorldX = Math.max(0, -posX / scaleX);
    const minWorldY = Math.max(0, -posY / scaleY);
    const maxWorldX = Math.min(this.nutrientGrid.WORLD_SIZE, (screenWidth - posX) / scaleX);
    const maxWorldY = Math.min(this.nutrientGrid.WORLD_SIZE, (screenHeight - posY) / scaleY);

    // 2. Затемнение видимой части океана
    if (maxWorldX > minWorldX && maxWorldY > minWorldY) {
      const bg = this.backgroundOverlay as any;
      const screenLeft = Math.round(minWorldX * scaleX + posX);
      const screenTop = Math.round(minWorldY * scaleY + posY);
      const screenWidthBg = Math.round((maxWorldX - minWorldX) * scaleX);
      const screenHeightBg = Math.round((maxWorldY - minWorldY) * scaleY);

      if (typeof bg.rect === 'function') {
        bg.rect(screenLeft, screenTop, screenWidthBg, screenHeightBg);
        bg.fill({ color: 0x020813, alpha: 0.65 });
      } else {
        bg.beginFill(0x020813, 0.65);
        bg.drawRect(screenLeft, screenTop, screenWidthBg, screenHeightBg);
        bg.endFill();
      }
    }

    // 3. Вычисление индексов видимых ячеек
    const minGridX = Math.max(0, Math.floor((-posX / scaleX) / cellSize));
    const maxGridX = Math.min(numCells, Math.ceil(((screenWidth - posX) / scaleX) / cellSize));

    const minGridY = Math.max(0, Math.floor((-posY / scaleY) / cellSize));
    const maxGridY = Math.min(numCells, Math.ceil(((screenHeight - posY) / scaleY) / cellSize));

    const g = this.gridGraphics as any;
    const isV8 = typeof g.moveTo === 'function';

    const startSx = Math.max(0, Math.round(minWorldX * scaleX + posX));
    const endSx = Math.min(screenWidth, Math.round(maxWorldX * scaleX + posX));
    const startSy = Math.max(0, Math.round(minWorldY * scaleY + posY));
    const endSy = Math.min(screenHeight, Math.round(maxWorldY * scaleY + posY));

    // Отрисовка видимых горизонтальных линий
    for (let j = minGridY; j <= maxGridY; j++) {
      const sy = Math.round(j * cellSize * scaleY + posY);
      if (isV8) {
        g.moveTo(startSx, sy);
        g.lineTo(endSx, sy);
      } else {
        g.lineStyle(1, 0x00e5ff, 0.35);
        g.moveTo(startSx, sy);
        g.lineTo(endSx, sy);
      }
    }

    // Отрисовка видимых вертикальных линий
    for (let i = minGridX; i <= maxGridX; i++) {
      const sx = Math.round(i * cellSize * scaleX + posX);
      if (isV8) {
        g.moveTo(sx, startSy);
        g.lineTo(sx, endSy);
      } else {
        g.lineStyle(1, 0x00e5ff, 0.35);
        g.moveTo(sx, startSy);
        g.lineTo(sx, endSy);
      }
    }

    if (typeof g.stroke === 'function') {
      g.stroke({
        width: 1,
        color: 0x00e5ff,
        alpha: 0.35,
      });
    }
  }

  public setVisible(visible: boolean): void {
    this.container.visible = visible;
    if (visible) {
      this.update();
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
