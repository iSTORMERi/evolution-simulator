import * as PIXI from 'pixi.js';
import { CoastalWaterController } from './ocean/CoastalWaterController';
import { OceanGlintsController } from './ocean/OceanGlintsController';

export class WaterManager {
  public container: PIXI.Container;

  private coastalController: CoastalWaterController;
  private glintsController: OceanGlintsController;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.container = new PIXI.Container();

    // Инициализируем контроллеры
    this.coastalController = new CoastalWaterController(mapWidth, mapHeight, coastalRatio);
    // 60 точек дадут красивое мягкое мерцание и 0 нагрузки на CPU/GPU
    this.glintsController = new OceanGlintsController(mapWidth, mapHeight, coastalRatio, 60);

    // Добавляем берег, а затем поверх воды -- солнечные блики
    this.container.addChild(this.coastalController.container);
    this.container.addChild(this.glintsController.container);
  }

  public updateTimeState(hours: number): void {
    this.coastalController.updateTimeState(hours);
    this.glintsController.updateTimeState(hours);
  }

  public update(deltaSeconds: number): void {
    this.coastalController.update(deltaSeconds);
    this.glintsController.update(deltaSeconds);
  }
}
