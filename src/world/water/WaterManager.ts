import * as PIXI from 'pixi.js';
import { CoastalWaterController } from './CoastalWaterController';

export class WaterManager {
  public container: PIXI.Container;

  private coastalController: CoastalWaterController;
  // Сюда позже добавим: private deepController: DeepWaterController;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.container = new PIXI.Container();

    this.coastalController = new CoastalWaterController(mapWidth, mapHeight, coastalRatio);

    // Подключаем слои в правильном порядке
    this.container.addChild(this.coastalController.container);
  }

  public updateTimeState(hours: number): void {
    this.coastalController.updateTimeState(hours);
  }

  public update(deltaSeconds: number): void {
    this.coastalController.update(deltaSeconds);
  }
}
