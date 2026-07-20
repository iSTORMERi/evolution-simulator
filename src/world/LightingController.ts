import * as PIXI from 'pixi.js';
import { WaterEffectsController } from './WaterEffectsController';

export interface TimeState {
  hours: number;
  phaseName: string;
  formattedTime: string;
}

export class LightingController {
  private colorMatrixFilter: PIXI.ColorMatrixFilter;
  private targetContainer: PIXI.Container;
  private waterEffects?: WaterEffectsController;

  constructor(targetContainer: PIXI.Container, waterEffects?: WaterEffectsController) {
    this.targetContainer = targetContainer;
    this.waterEffects = waterEffects;
    this.colorMatrixFilter = new PIXI.ColorMatrixFilter();
    
    this.targetContainer.filters = [this.colorMatrixFilter];
  }

  public setTime(timeInHours: number): TimeState {
    const hours = (timeInHours % 24 + 24) % 24;

    let r = 1.0, g = 1.0, b = 1.0;
    let brightness = 1.0;
    let phaseName = 'День';

    if (hours >= 0 && hours < 4.5) {
      phaseName = 'Лунная ночь';
      r = 0.35; g = 0.50; b = 0.80;
      brightness = 0.45;
    } else if (hours >= 4.5 && hours < 6.5) {
      const t = (hours - 4.5) / 2.0;
      phaseName = 'Предрассветные сумерки';
      r = 0.35 + t * 0.55;
      g = 0.50 - t * 0.15;
      b = 0.80 - t * 0.15;
      brightness = 0.45 + t * 0.20;
    } else if (hours >= 6.5 && hours < 8.5) {
      const t = (hours - 6.5) / 2.0;
      phaseName = 'Алый рассвет';
      r = 0.90 + t * 0.10;
      g = 0.35 + t * 0.65;
      b = 0.65 + t * 0.35;
      brightness = 0.65 + t * 0.35;
    } else if (hours >= 8.5 && hours < 17.5) {
      phaseName = 'Яркий день';
      r = 1.0; g = 1.0; b = 1.0;
      brightness = 1.0;
    } else if (hours >= 17.5 && hours < 19.5) {
      const t = (hours - 17.5) / 2.0;
      phaseName = 'Розово-алый закат';
      r = 1.0; 
      g = 1.0 - t * 0.55;
      b = 1.0 - t * 0.35;
      brightness = 1.0 - t * 0.20;
    } else if (hours >= 19.5 && hours < 21.5) {
      const t = (hours - 19.5) / 2.5;
      phaseName = 'Багряные сумерки';
      r = 1.00 - t * 0.50;
      g = 0.45 - t * 0.10;
      b = 0.65 + t * 0.15;
      brightness = 0.80 - t * 0.25;
    } else {
      const t = (hours - 21.5) / 2.5;
      phaseName = 'Наступление ночи';
      r = 0.50 - t * 0.15;
      g = 0.35 + t * 0.15;
      b = 0.80;
      brightness = 0.55 - t * 0.10;
    }

    this.colorMatrixFilter.matrix = [
      r * brightness, 0,              0,              0, 0,
      0,              g * brightness, 0,              0, 0,
      0,              0,              b * brightness, 0, 0,
      0,              0,              0,              1, 0
    ];

    // Синхронизируем эффекты воды
    if (this.waterEffects) {
      this.waterEffects.updateTimeState(hours);
    }

    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    return { hours, phaseName, formattedTime };
  }
}
