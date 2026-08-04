// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private gridGraphics: PIXI.Graphics;
  private nutrientGrid: NutrientGrid;
  private app: PIXI.Application;
  private worldContainer: PIXI.Container;

  // Карта HEX-цветов элементов для отображения на сетке
  private elementColors: Record<string, number> = {
    'P': 0xd500f9,  // Фосфор — Фиолетовый
    'N': 0x00e5ff,  // Азот — Бирюзовый
    'C': 0xffd600,  // Углерод — Желтый
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

  public get visible(): boolean {
    return this.container.visible;
  }

  public set visible(value: boolean) {
    this.container.visible = value;
    if (value) {
      this.update();
    }
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
    const numCellsCols = this.nutrientGrid.cols;
    const numCellsRows = this.nutrientGrid.rows;

    this.gridGraphics.clear();

    // 1. Границы видимой области мира в экранных координатах
    const minWorldX = Math.max(0, -posX / scaleX);
    const minWorldY = Math.max(0, -posY / scaleY);
    const maxWorldX = Math.min(this.nutrientGrid.WORLD_SIZE, (screenWidth - posX) / scaleX);
    const maxWorldY = Math.min(this.nutrientGrid.WORLD_SIZE, (screenHeight - posY) / scaleY);

    // 2. Вычисление индексов видимых ячеек
    const minGridX = Math.max(0, Math.floor((-posX / scaleX) / cellSize));
    const maxGridX = Math.min(numCellsCols, Math.ceil(((screenWidth - posX) / scaleX) / cellSize));

    const minGridY = Math.max(0, Math.floor((-posY / scaleY) / cellSize));
    const maxGridY = Math.min(numCellsRows, Math.ceil(((screenHeight - posY) / scaleY) / cellSize));

    const g = this.gridGraphics as any;
    const isV8 = typeof g.rect === 'function';

    // ==========================================
    // ШАГ 1: Отрисовка закраски масс нутриентов
    // ==========================================
    for (let gy = minGridY; gy < maxGridY; gy++) {
      for (let gx = minGridX; gx < maxGridX; gx++) {
        const cell = this.nutrientGrid.getCell(gx, gy);
        if (!cell || cell.isLand) continue;

        const surfaceKeys = Object.keys(cell.surfaceNutrients);
        if (surfaceKeys.length === 0) continue;

        // Расчет суммарной массы и взвешенного цвета элементов
        let totalMass = 0;
        let redSum = 0;
        let greenSum = 0;
        let blueSum = 0;

        for (const key of surfaceKeys) {
          const mass = cell.surfaceNutrients[key] || 0;
          if (mass > 0.0001) {
            totalMass += mass;
            const hexColor = this.elementColors[key] ?? 0x3d5af1;
            
            const r = (hexColor >> 16) & 0xFF;
            const gVal = (hexColor >> 8) & 0xFF;
            const b = hexColor & 0xFF;

            redSum += r * mass;
            greenSum += gVal * mass;
            blueSum += b * mass;
          }
        }

        if (totalMass <= 0.0001) continue;

        // Итоговый смешанный цвет
        const finalR = Math.round(redSum / totalMass);
        const finalG = Math.round(greenSum / totalMass);
        const finalB = Math.round(blueSum / totalMass);
        const blendedColor = (finalR << 16) | (finalG << 8) | finalB;

        const sx = Math.round(gx * cellSize * scaleX + posX);
        const sy = Math.round(gy * cellSize * scaleY + posY);
        const sw = Math.round(cellSize * scaleX);
        const sh = Math.round(cellSize * scaleY);

        // Яркая прозрачность: от 0.35 (заметный тап) до 0.9 (насыщенное пятно)
        const alpha = Math.min(0.9, Math.max(0.35, (totalMass / 150) * 0.55));

        if (isV8) {
          g.rect(sx, sy, sw, sh).fill({ color: blendedColor, alpha });
        } else if (typeof g.beginFill === 'function') {
          g.beginFill(blendedColor, alpha);
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
    this.visible = visible;
  }

  public toggle(): boolean {
    const nextState = !this.container.visible;
    this.visible = nextState;
    return nextState;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
