// src/visuals/PlanktonOverlay.ts

import * as PIXI from 'pixi.js';
import { SurfacePlankton, PlanktonType } from '../entities/SurfacePlankton';
import { OceanCurrentsManager } from '../simulation/OceanCurrentsManager';

export class PlanktonOverlay {
  public container: PIXI.Container;
  private planktonList: SurfacePlankton[] = [];
  private colonyGraphics: PIXI.Container[] = [];
  private currentsManager: OceanCurrentsManager;
  private worldWidth: number;
  private worldHeight: number;

  constructor(
    _app: PIXI.Application,
    currentsManager: OceanCurrentsManager,
    _count: number = 600, // Сохраняем аргумент для обратной совместимости
    worldWidth: number = 8000,
    worldHeight: number = 8000,
    customColonies?: SurfacePlankton[]
  ) {
    this.container = new PIXI.Container();
    this.currentsManager = currentsManager;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Берем переданные колонии или генерируем 8 тестовых средних колоний (по 2 на тип)
    this.planktonList = customColonies ?? SurfacePlankton.createDefaultTestColonies(worldWidth, worldHeight);

    // Отрисовываем каждую колонию
    for (const colony of this.planktonList) {
      const visual = this.createColonyGraphics(colony);
      this.colonyGraphics.push(visual);
      this.container.addChild(visual);
    }
  }

  /**
   * Генерация визуального стиля колонии в зависимости от её типа
   */
  private createColonyGraphics(colony: SurfacePlankton): PIXI.Container {
    const container = new PIXI.Container();
    container.x = colony.x;
    container.y = colony.y;
    container.rotation = colony.rotation;

    const g = new PIXI.Graphics();

    switch (colony.type) {
      case PlanktonType.DIATOMS:
        this.drawDiatomsColony(g, colony);
        break;
      case PlanktonType.DINOFLAGELLATES:
        this.drawDinoflagellatesColony(g, colony);
        break;
      case PlanktonType.COCCOLITHOPHORES:
        this.drawCoccolithophoresColony(g, colony);
        break;
      case PlanktonType.CYANOBACTERIA:
        this.drawCyanobacteriaColony(g, colony);
        break;
    }

    container.addChild(g);
    return container;
  }

  /**
   * 1. Диатомеи: Оливково-золотые вытянутые ленты / струи
   * Вытянуты по направлению течения, плотное ядро, размытый хвост.
   */
  private drawDiatomsColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const baseColor = 0x8B6508; // Янтарно-золотой
    const coreColor = 0x556B2F; // Тёмно-оливковый

    // Внешний размытый хвостовой шлейф
    g.ellipse(0, 0, r * 1.6, r * 0.5).fill({ color: baseColor, alpha: 0.25 * colony.density });
    // Основная маслянистая струя
    g.ellipse(-r * 0.1, 0, r * 1.2, r * 0.38).fill({ color: baseColor, alpha: 0.55 * colony.density });
    // Плотное внутреннее ядро с четкими боковыми границами
    g.ellipse(-r * 0.2, 0, r * 0.7, r * 0.22).fill({ color: coreColor, alpha: 0.85 * colony.density });
  }

  /**
   * 2. Динофлагеллаты: Багрово-красные жилы / рваные очаги
   * Контрастные, рваные зубчатые границы, очень высокая оптическая плотность.
   */
  private drawDinoflagellatesColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const redColor = 0x8B2222; // Ржаво-красный / махагон
    const darkRed = 0x5C0909;  // Бордовое ядро

    // Внешний рваный очаг (зубчатый многоугольник)
    const pointsCount = 10;
    const points: number[] = [];
    for (let i = 0; i < pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
      const dist = r * (0.6 + Math.sin(i * 3.7 + colony.seed) * 0.35);
      points.push(Math.cos(angle) * dist, Math.sin(angle) * dist);
    }
    g.poly(points).fill({ color: redColor, alpha: 0.75 * colony.density });

    // Внутреннее плотное ядро
    const corePoints: number[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = r * 0.4 * (0.7 + Math.cos(i * 2.5 + colony.seed) * 0.3);
      corePoints.push(Math.cos(angle) * dist, Math.sin(angle) * dist);
    }
    g.poly(corePoints).fill({ color: darkRed, alpha: 0.95 * colony.density });
  }

  /**
   * 3. Кокколитофориды: Молочно-бирюзовые спиралевидные вихри
   * Мягкие градиенты, шелковистые края, пастельный растворяющийся тон.
   */
  private drawCoccolithophoresColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const turquoise = 0x40E0D0; // Аквамарин / Бирюза
    const milkyWhite = 0xE0FFFF; // Пастельно-молочный

    // Мягкое внешнее градиентное облако
    g.circle(0, 0, r * 1.3).fill({ color: turquoise, alpha: 0.15 * colony.density });
    g.circle(0, 0, r * 0.95).fill({ color: turquoise, alpha: 0.35 * colony.density });

    // Спиральные рукава (орбитальный мезомасштабный вихрь)
    for (let i = 0; i < 3; i++) {
      const angleOffset = (i * Math.PI * 2) / 3;
      const x = Math.cos(angleOffset) * (r * 0.35);
      const y = Math.sin(angleOffset) * (r * 0.35);
      g.circle(x, y, r * 0.45).fill({ color: milkyWhite, alpha: 0.45 * colony.density });
    }

    // Пастельный центр
    g.circle(0, 0, r * 0.35).fill({ color: milkyWhite, alpha: 0.7 * colony.density });
  }

  /**
   * 4. Цианобактерии: Кислотно-салатовая нитевидная паутина
   * Поверхностная пленка с четко выраженными параллельными ветровыми штрихами.
   */
  private drawCyanobacteriaColony(g: PIXI.Graphics, colony: SurfacePlankton): void {
    const r = colony.radius;
    const limeColor = 0x32CD32; // Кислотно-салатовый
    const darkGreen = 0x228B22; // Травянисто-зеленый

    // Фоновая полупрозрачная зеленая подложка
    g.ellipse(0, 0, r * 1.2, r * 0.8).fill({ color: darkGreen, alpha: 0.18 * colony.density });

    // Параллельные нити и волокна («паутина» от ветра)
    const lineCount = 12;
    for (let i = 0; i < lineCount; i++) {
      const offsetY = ((i - lineCount / 2) / lineCount) * (r * 1.1);
      const width = Math.sqrt(Math.max(0, r * r - offsetY * offsetY)) * 1.2;
      const startX = -width + Math.sin(i + colony.seed) * 10;
      const endX = width + Math.cos(i + colony.seed) * 10;

      g.moveTo(startX, offsetY)
       .lineTo(endX, offsetY)
       .stroke({ width: 2.5 + Math.random() * 2, color: limeColor, alpha: 0.6 * colony.density });
    }
  }

  /**
   * Обновление визуального слоя
   */
  public update(_dt: number, _isNight: boolean): void {
    // Синхронизация позиций и углов с объектами SurfacePlankton
    for (let i = 0; i < this.planktonList.length; i++) {
      const colony = this.planktonList[i];
      const visual = this.colonyGraphics[i];

      if (visual) {
        visual.x = colony.x;
        visual.y = colony.y;
        visual.rotation = colony.rotation;
      }
    }
  }
}
