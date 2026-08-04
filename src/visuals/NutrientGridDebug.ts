// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private gridGraphics: PIXI.Graphics;
  private nutrientGrid: NutrientGrid;
  private app: PIXI.Application;
  private worldContainer: PIXI.Container;

  // Карта цветов для отображения элементов на сетке
  private elementColors: Record<string, number> = {
    'P': 0xd500f9, // Фосфор — Фиолетовый
    'N': 0x00e5ff, // Азот — Бирюзовый
    'C': 0xffd600, // Углерод — Желтый
    'Fe': 0xff3d00, // Железо — Красный
    'Si': 0x76ff03, // Кремний — Зеленый
  };

  constructor(nutrientGrid: NutrientGrid, app: PIXI.Application, worldContainer: PIXI.Container) {
    this.nutrientGrid = nutrientGrid;
    this.app = app;
    this.worldContainer = worldContainer;

    this.container = new PIXI.Container();
    this.container.visible = false;

    this.gridGraphics = new PIXI.Graphics();
    this.container.addChild(this.gridGraphics);
  }

  /**
   * Перерисовка сетки и визуализация нутриентов в реальном времени
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

    this.gridGraphics.clear();

    // 1. Границы видимой области мира в экранных координатах
    const minWorldX = Math.max(0, -posX / scaleX);
    const minWorldY = Math.max(0, -posY / scaleY);
    const maxWorldX = Math.min(this.nutrientGrid.WORLD_SIZE, (screenWidth - posX) / scaleX);
    const maxWorldY = Math.min(this.nutrientGrid.WORLD_SIZE, (screenHeight - posY) / scaleY);

    // 2. Вычисление индексов видимых ячеек
    const minGridX = Math.max(0, Math.floor((-posX / scaleX) / cellSize));
    const maxGridX = Math.min(numCells, Math.ceil(((screenWidth - posX) / scaleX) / cellSize));

    const minGridY = Math.max(0, Math.floor((-posY / scaleY) / cellSize));
    const maxGridY = Math.min(numCells, Math.ceil(((screenHeight - posY) / scaleY) / cellSize));

    const g = this.gridGraphics as any;
    const isV8 = typeof g.moveTo === 'function';

    // ==========================================
    // ШАГ 1: Отрисовка закраски масс нутриентов
    // ==========================================
    for (let gy = minGridY; gy < maxGridY; gy++) {
      for (let gx = minGridX; gx < maxGridX; gx++) {
        const cell = this.nutrientGrid.getCell(gx, gy);
        if (!cell || cell.isLand) continue;

        const surfaceKeys = Object.keys(cell.surfaceNutrients);
        if (surfaceKeys.length === 0) continue;

        // Находим доминирующий элемент и суммарную массу
        let mainElem = surfaceKeys[0];
        let maxMass = 0;
        let totalMass = 0;

        for (const key of surfaceKeys) {
          const m = cell.surfaceNutrients[key] || 0;
          totalMass += m;
          if (m > maxMass) {
            maxMass = m;
            mainElem = key;
          }
        }

        if (totalMass <= 0.01) continue;

        const sx = Math.round(gx * cellSize * scaleX + posX);
        const sy = Math.round(gy * cellSize * scaleY + posY);
        const sw = Math.round(cellSize * scaleX);
        const sh = Math.round(cellSize * scaleY);

        const color = this.elementColors[mainElem] ?? 0x3d5af1;
        // Прозрачность от 0.15 до 0.75 в зависимости от концентрации (нормируем к 500 мг)
        const alpha = Math.min(0.75, Math.max(0.15, (totalMass / 500) * 0.7));

        if (isV8 && typeof g.rect === 'function') {
          g.rect(sx, sy, sw, sh).fill({ color, alpha });
        } else if (typeof g.beginFill === 'function') {
          g.beginFill(color, alpha);
          g.drawRect(sx, sy, sw, sh);
          g.endFill();
        }
      }
    }

    // ==========================================
    // ШАГ 2: Отрисовка видимых линий сетки
    // ==========================================
    const startSx = Math.max(0, Math.round(minWorldX * scaleX + posX));
    const endSx = Math.min(screenWidth, Math.round(maxWorldX * scaleX + posX));
    const startSy = Math.max(0, Math.round(minWorldY * scaleY + posY));
    const endSy = Math.min(screenHeight, Math.round(maxWorldY * scaleY + posY));

    // Горизонтальные линии
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

    // Вертикальные линии
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
