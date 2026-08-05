// src/visuals/NutrientGridDebug.ts

import * as PIXI from 'pixi.js';
import { NutrientGrid } from '../simulation/NutrientGrid';

export type NutrientRenderMode = 'surface' | 'benthic' | 'both';

export class NutrientGridDebug {
  public container: PIXI.Container;
  private gridGraphics: PIXI.Graphics;
  private nutrientGrid: NutrientGrid;
  private app: PIXI.Application;
  private worldContainer: PIXI.Container;

  // Режим отображения слоев: 'surface' (Пелагиаль), 'benthic' (Бенталь), 'both' (Интегральный)
  public renderMode: NutrientRenderMode = 'surface';

  // Множество выбранных элементов для визуализации (по умолчанию пустое)
  private activeElements: Set<string> = new Set();

  // Карта HEX-цветов элементов для отображения на сетке
  private elementColors: Record<string, number> = {
    'C':  0xffd600, // Углерод — Желтый
    'N':  0x00e5ff, // Азот — Бирюзовый
    'P':  0xd500f9, // Фосфор — Фиолетовый
    'S':  0xffab00, // Сера — Ярко-желтый/Янтарный
    'Ca': 0xffffff, // Кальций — Белый
    'Si': 0x76ff03, // Кремний — Салатовый
    'Sr': 0x64ffda, // Стронций — Мятный
    'Na': 0xff6d00, // Натрий — Оранжевый
    'Cl': 0xaeea00, // Хлор — Лайм
    'K':  0xaa00ff, // Калий — Насыщенный фиолетовый
    'Fe': 0xff3d00, // Железо — Красный
    'Mg': 0x00e676, // Магний — Зеленый
    'Cu': 0x1de9b6, // Медь — Лазурный
    'Zn': 0x29b6f6, // Цинк — Голубой
    'Mn': 0xf44336, // Марганец — Алый
    'Mo': 0x7c4dff, // Молибден — Индиго
    'Co': 0x2979ff, // Кобальт — Синий
    'Se': 0xff1744, // Селен — Малиновый
    'I':  0x651fff, // Иод — Темно-фиолетовый
    'V':  0x00b0ff, // Ванадий — Светло-синий
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
   * Явная установка режима отображения горизонта (Пелагиаль / Бенталь / Интегральный)
   */
  public setRenderMode(mode: NutrientRenderMode): void {
    this.renderMode = mode;
    if (this.visible) {
      this.update();
    }
  }

  /**
   * Циклическое переключение режимов: Пелагиаль -> Бенталь -> Интегральный
   */
  public cycleRenderMode(): NutrientRenderMode {
    if (this.renderMode === 'surface') {
      this.renderMode = 'benthic';
    } else if (this.renderMode === 'benthic') {
      this.renderMode = 'both';
    } else {
      this.renderMode = 'surface';
    }

    if (this.visible) {
      this.update();
    }
    return this.renderMode;
  }

  // ==========================================
  // УПРАВЛЕНИЕ АКТИВНЫМИ ЭЛЕМЕНТАМИ (ФИЛЬТРАЦИЯ)
  // ==========================================

  /**
   * Переключить состояние элемента (выбран / не выбран)
   */
  public toggleElement(symbol: string): boolean {
    if (this.activeElements.has(symbol)) {
      this.activeElements.delete(symbol);
    } else {
      this.activeElements.add(symbol);
    }
    if (this.visible) {
      this.update();
    }
    return this.activeElements.has(symbol);
  }

  /**
   * Проверить, выбран ли конкретный элемент
   */
  public isElementActive(symbol: string): boolean {
    return this.activeElements.has(symbol);
  }

  /**
   * Установить точный список выбранных элементов
   */
  public setActiveElements(elements: string[]): void {
    this.activeElements = new Set(elements);
    if (this.visible) {
      this.update();
    }
  }

  /**
   * Сбросить все выбранные элементы (очистить карту)
   */
  public clearActiveElements(): void {
    this.activeElements.clear();
    if (this.visible) {
      this.update();
    }
  }

  /**
   * Получить текущие активные элементы
   */
  public getActiveElements(): string[] {
    return Array.from(this.activeElements);
  }

  // ==========================================
  // РЕНДЕРИНГ
  // ==========================================

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
    // ШАГ 1: Отрисовка ТОЛЬКО выбранных нутриентов
    // ==========================================
    // Если ни один элемент не выбран, отрисовку пятен веществ пропускаем
    if (this.activeElements.size > 0) {
      for (let gy = minGridY; gy < maxGridY; gy++) {
        for (let gx = minGridX; gx < maxGridX; gx++) {
          const cell = this.nutrientGrid.getCell(gx, gy);
          
          // Строгая блокировка отрисовки на суше
          if (!cell || cell.isLand || !cell.isWater) continue;

          // Агрегируем химические массы только для выбранных элементов
          const activeNutrients: Record<string, number> = {};

          if (this.renderMode === 'surface' || this.renderMode === 'both') {
            for (const key of this.activeElements) {
              if (cell.surfaceNutrients && cell.surfaceNutrients[key]) {
                activeNutrients[key] = (activeNutrients[key] || 0) + cell.surfaceNutrients[key];
              }
            }
          }

          if (this.renderMode === 'benthic' || this.renderMode === 'both') {
            for (const key of this.activeElements) {
              if (cell.benthicNutrients && cell.benthicNutrients[key]) {
                activeNutrients[key] = (activeNutrients[key] || 0) + cell.benthicNutrients[key];
              }
            }
          }

          const keys = Object.keys(activeNutrients);
          if (keys.length === 0) continue;

          // Расчет суммарной массы и взвешенного цвета элементов
          let totalMass = 0;
          let redSum = 0;
          let greenSum = 0;
          let blueSum = 0;

          for (const key of keys) {
            const mass = activeNutrients[key] || 0;
            if (mass > 1e-8) {
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

          if (totalMass <= 1e-8) continue;

          // Итоговый смешанный цвет
          const finalR = Math.round(redSum / totalMass);
          const finalG = Math.round(greenSum / totalMass);
          const finalB = Math.round(blueSum / totalMass);
          const blendedColor = (finalR << 16) | (finalG << 8) | finalB;

          const sx = Math.round(gx * cellSize * scaleX + posX);
          const sy = Math.round(gy * cellSize * scaleY + posY);
          const sw = Math.round(cellSize * scaleX);
          const sh = Math.round(cellSize * scaleY);

          // Логарифмический масштаб прозрачности: виден даже слабый фронт диффузии
          let alpha = Math.min(0.85, Math.max(0.08, Math.log10(totalMass + 1) * 0.4 + (totalMass > 0.01 ? 0.2 : 0.05)));

          // Легкая корректировка прозрачности для донного слоя
          if (this.renderMode === 'benthic') {
            alpha *= 0.85; 
          }

          if (isV8) {
            g.rect(sx, sy, sw, sh).fill({ color: blendedColor, alpha });
          } else if (typeof g.beginFill === 'function') {
            g.beginFill(blendedColor, alpha);
            g.drawRect(sx, sy, sw, sh);
            g.endFill();
          }
        }
      }
    }

    // ==========================================
    // ШАГ 2: Отрисовка видимой сетки с индикацией горизонта
    // ==========================================
    const startSx = Math.max(0, Math.round(minWorldX * scaleX + posX));
    const endSx = Math.min(screenWidth, Math.round(maxWorldX * scaleX + posX));
    const startSy = Math.max(0, Math.round(minWorldY * scaleY + posY));
    const endSy = Math.min(screenHeight, Math.round(maxWorldY * scaleY + posY));

    // Динамический цвет сетки для визуального подтверждения текущего режима:
    // Пелагиаль = Бирюзовый (0x00e5ff)
    // Бенталь = Оранжевый/Песочный (0xff9100)
    // Интегральный = Пурпурный (0xe040fb)
    const gridColor = this.renderMode === 'surface' 
      ? 0x00e5ff 
      : this.renderMode === 'benthic' 
        ? 0xff9100 
        : 0xe040fb;

    // Горизонтальные линии
    for (let j = minGridY; j <= maxGridY; j++) {
      const sy = Math.round(j * cellSize * scaleY + posY);
      if (isV8) {
        g.moveTo(startSx, sy);
        g.lineTo(endSx, sy);
      } else {
        g.lineStyle(1, gridColor, 0.2);
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
        g.lineStyle(1, gridColor, 0.2);
        g.moveTo(sx, startSy);
        g.lineTo(sx, endSy);
      }
    }

    if (isV8 && typeof g.stroke === 'function') {
      g.stroke({
        width: 1,
        color: gridColor,
        alpha: 0.2,
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
