import * as PIXI from 'pixi.js';
import { CoastalWaterController } from './ocean/CoastalWaterController';
import { OceanGlintsController } from './ocean/OceanGlintsController';

export class WaterManager {
  public container: PIXI.Container;

  private coastalController: CoastalWaterController;
  private glintsController: OceanGlintsController;

  private mapHeight: number;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.container = new PIXI.Container();
    this.mapHeight = mapHeight;

    // Передаем маску затухания (0.0 в центре дельты, 1.0 вне дельты)
    const deltaWaveMask = (y: number) => this.getDeltaWaveMaskFactor(y);

    // Инициализируем контроллеры с учётом расширенной маски дельты
    this.coastalController = new CoastalWaterController(
      mapWidth,
      mapHeight,
      coastalRatio,
      deltaWaveMask
    );

    this.glintsController = new OceanGlintsController(
      mapWidth,
      mapHeight,
      coastalRatio,
      60
    );

    // Добавляем береговую линию, затем поверх -- блики
    this.container.addChild(this.coastalController.container);
    this.container.addChild(this.glintsController.container);
  }

  /**
   * Вычисляет фактор затухания океанических волн/пены напротив устья дельты.
   * @param y Координата Y на карте
   * @returns 0.0 (полное отсутствие волн в центре и на рукавах дельты) ... 1.0 (обычные волны)
   */
  public getDeltaWaveMaskFactor(y: number): number {
    const deltaOriginY = this.mapHeight * 0.65; // Центр дельты[span_1](start_span)[span_1](end_span)
    
    // Расширили размах гашения волн до 11000px, чтобы с запасом перекрыть крайние рукава
    const deltaSpreadY = 11000;                 

    const distToCenterY = Math.abs(y - deltaOriginY);
    const deltaRadius = deltaSpreadY * 0.5;

    // В зоне дельты речной поток гасит прибой: плавно сводим альфу к 0[span_2](start_span)[span_2](end_span)
    if (distToCenterY < deltaRadius) {
      const factor = distToCenterY / deltaRadius;
      // Используем степень 2.5 для создания широкого и уплощенного "окна тишины"
      return Math.pow(factor, 2.5);
    }

    return 1.0;
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
