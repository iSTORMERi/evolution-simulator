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
    
    // Применяем фильтр цветовой матрицы к миру
    this.targetContainer.filters = [this.colorMatrixFilter];
  }

  /**
   * Обновляет освещение мира по времени (timeInHours: float от 0.0 до 24.0)
   */
  public setTime(timeInHours: number): TimeState {
    // Нормализуем время в интервале [0, 24)
    const hours = (timeInHours % 24 + 24) % 24;

    let r = 1.0, g = 1.0, b = 1.0;
    let brightness = 1.0;
    let phaseName = 'День';

    // === Расчет цветовых фаз и оттенка (RGB + Яркость) ===
    if (hours >= 0 && hours < 4) {
      // Глубокая ночь (00:00 - 04:00)
      phaseName = 'Глубокая ночь';
      r = 0.25; g = 0.35; b = 0.65; // Сине-фиолетовый холодный тон
      brightness = 0.35;
    } else if (hours >= 4 && hours < 6) {
      // Предрассветные сумерки (04:00 - 06:00)
      const t = (hours - 4) / 2;
      phaseName = 'Ранний рассвет';
      r = 0.25 + t * 0.45; // 0.25 -> 0.70
      g = 0.35 + t * 0.25; // 0.35 -> 0.60
      b = 0.65 - t * 0.10; // 0.65 -> 0.55
      brightness = 0.35 + t * 0.35; // 0.35 -> 0.70
    } else if (hours >= 6 && hours < 8.5) {
      // Золотой рассвет (06:00 - 08:30)
      const t = (hours - 6) / 2.5;
      phaseName = 'Восход солнца';
      r = 0.70 + t * 0.30; // Персиковый / розовато-золотой
      g = 0.60 + t * 0.40;
      b = 0.55 + t * 0.45;
      brightness = 0.70 + t * 0.30;
    } else if (hours >= 8.5 && hours < 17) {
      // Яркий день (08:30 - 17:00)
      phaseName = 'День';
      r = 1.0; g = 1.0; b = 1.0;
      brightness = 1.0;
    } else if (hours >= 17 && hours < 19.5) {
      // Золотой час / Закат (17:00 - 19:30)
      const t = (hours - 17) / 2.5;
      phaseName = 'Закат';
      r = 1.0; 
      g = 1.0 - t * 0.45;  // Падение зеленого даёт насыщенный оранжевый
      b = 1.0 - t * 0.65;  // Падение синего
      brightness = 1.0 - t * 0.20;
    } else if (hours >= 19.5 && hours < 22) {
      // Вечерние сумерки (19:30 - 22:00)
      const t = (hours - 19.5) / 2.5;
      phaseName = 'Сумерки';
      r = 1.0 - t * 0.65;   // Оранжевый переходит в темно-фиолетовый
      g = 0.55 - t * 0.20;
      b = 0.35 + t * 0.30;
      brightness = 0.80 - t * 0.35;
    } else {
      // Наступление ночи (22:00 - 24:00)
      const t = (hours - 22) / 2;
      phaseName = 'Ночь';
      r = 0.35 - t * 0.10;
      g = 0.35;
      b = 0.65;
      brightness = 0.45 - t * 0.10;
    }

    // Применяем фильтр тонирования и яркости
    this.colorMatrixFilter.matrix = [
      r * brightness, 0,              0,              0, 0,
      0,              g * brightness, 0,              0, 0,
      0,              0,              b * brightness, 0, 0,
      0,              0,              0,              1, 0
    ];

    // Форматирование времени для UI
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    return { hours, phaseName, formattedTime };
  }
}
