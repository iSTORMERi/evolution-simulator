import * as PIXI from 'pixi.js';
import { CoastalWaterController } from './ocean/CoastalWaterController';

export class WaterManager {
  public container: PIXI.Container;

  private coastalController: CoastalWaterController;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.container = new PIXI.Container();

    // Инициализируем контроллер прибрежной воды
    this.coastalController = new CoastalWaterController(mapWidth, mapHeight, coastalRatio);

    // Добавляем его контейнер в менеджер
    this.container.addChild(this.coastalController.container);
  }

  public updateTimeState(hours: number): void {
    this.coastalController.updateTimeState(hours);
  }

  public update(deltaSeconds: number): void {
    this.coastalController.update(deltaSeconds);
  }
}
