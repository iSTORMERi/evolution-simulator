import * as PIXI from 'pixi.js';

export interface TimeState {
  hours: number;          // 0 .. 24
  phaseName: string;      // Название фазы суток
  formattedTime: string;  // Строка "18:30"
}

export class LightingController {
  private colorMatrixFilter: PIXI.ColorMatrixFilter;
  private targetContainer: PIXI.Container;

  constructor(targetContainer: PIXI.Container) {
    this.targetContainer = targetContainer;
    this.colorMatrixFilter = new PIXI.ColorMatrixFilter();
    
    this.targetContainer.filters = [this.colorMatrixFilter];
  }

  /**
   * Обновляет освещение мира по времени (timeInHours: float от 0.0 до 24.0)
   */
  public setTime(timeInHours: number): TimeState {
    const hours = (timeInHours % 24 + 24) % 24;

    let r = 1.0, g = 1.0, b = 1.0;
    let brightness = 1.0;
    let phaseName = 'День';

    if (hours >= 0 && hours < 4.5) {
      // Лунная ночь (00:00 - 04:30) -- серебристо-голубое лунное освещение
      phaseName = 'Лунная ночь';
      r = 0.35; 
      g = 0.50; 
      b = 0.80; // Серебристо-синий лунный отсвет
      brightness = 0.45; // Достаточная видимость благодаря Луне
    } else if (hours >= 4.5 && hours < 6.5) {
      // Предрассветные розово-пурпурные сумерки (04:30 - 06:30)
      const t = (hours - 4.5) / 2.0;
      phaseName = 'Предрассветные сумерки';
      r = 0.35 + t * 0.55; // 0.35 -> 0.90 (насыщенный розовый)
      g = 0.50 - t * 0.15; // 0.50 -> 0.35
      b = 0.80 - t * 0.15; // 0.80 -> 0.65
      brightness = 0.45 + t * 0.20; // 0.45 -> 0.65
    } else if (hours >= 6.5 && hours < 8.5) {
      // Нежный рассвет (06:30 - 08:30) -- малиново-золотой переход в день
      const t = (hours - 6.5) / 2.0;
      phaseName = 'Алый рассвет';
      r = 0.90 + t * 0.10; // 0.90 -> 1.00
      g = 0.35 + t * 0.65; // 0.35 -> 1.00
      b = 0.65 + t * 0.35; // 0.65 -> 1.00
      brightness = 0.65 + t * 0.35; // 0.65 -> 1.00
    } else if (hours >= 8.5 && hours < 17.5) {
      // Яркий день (08:30 - 17:30)
      phaseName = 'Яркий день';
      r = 1.0; g = 1.0; b = 1.0;
      brightness = 1.0;
    } else if (hours >= 17.5 && hours < 19.5) {
      // Алый/Розовый закат (17:30 - 19:30)
      const t = (hours - 17.5) / 2.0;
      phaseName = 'Розово-алый закат';
      r = 1.0; 
      g = 1.0 - t * 0.55;  // 1.00 -> 0.45 (красно-розовый акцент)
      b = 1.0 - t * 0.35;  // 1.00 -> 0.65 (пурпурный оттенок)
      brightness = 1.0 - t * 0.20; // 1.00 -> 0.80
    } else if (hours >= 19.5 && hours < 21.5) {
      // Вечерний багряный закат / сумерки (19:30 - 21:30)
      const t = (hours - 19.5) / 2.0;
      phaseName = 'Багряные сумерки';
      r = 1.00 - t * 0.50; // 1.00 -> 0.50
      g = 0.45 - t * 0.10; // 0.45 -> 0.35
      b = 0.65 + t * 0.15; // 0.65 -> 0.80
      brightness = 0.80 - t * 0.25; // 0.80 -> 0.55
    } else {
      // Наступление лунной ночи (21:30 - 24:00)
      const t = (hours - 21.5) / 2.5;
      phaseName = 'Наступление ночи';
      r = 0.50 - t * 0.15; // 0.50 -> 0.35
      g = 0.35 + t * 0.15; // 0.35 -> 0.50
      b = 0.80;
      brightness = 0.55 - t * 0.10; // 0.55 -> 0.45
    }

    // Применяем фильтр цветовой матрицы
    this.colorMatrixFilter.matrix = [
      r * brightness, 0,              0,              0, 0,
      0,              g * brightness, 0,              0, 0,
      0,              0,              b * brightness, 0, 0,
      0,              0,              0,              1, 0
    ];

    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    return { hours, phaseName, formattedTime };
  }
}
