// src/world/LightingController.ts

export interface LightingState {
  formattedTime: string;
  phaseName: string;
  ambientColor?: number;
  intensity?: number;
  [key: string]: any; // На случай дополнительных параметров вашей реализации
}

export class LightingController {
  // Сохраняем текущее время (по умолчанию 12:00)
  private currentHour: number = 12.0;

  /**
   * Устанавливает время суток и сохраняет его в контроллере
   * @param hours Время в часах (от 0.0 до 24.0)
   */
  public setTime(hours: number): LightingState {
    this.currentHour = hours;

    // --- Ваша текущая логика обновления шейдеров/цвета ---
    // (Оставьте здесь ваш существующий код расчета освещения)
    
    const formattedTime = this.formatTime(hours);
    const phaseName = this.getPhaseName(hours);

    return {
      formattedTime,
      phaseName,
    };
  }

  /**
   * Возвращает текущее время суток в часах (0.0 - 24.0)
   * Теперь BiomeScanner и любые другие системы могут считывать время отсюда
   */
  public getCurrentHours(): number {
    return this.currentHour;
  }

  /**
   * Вспомогательный метод форматирования времени (00:00)
   */
  private formatTime(hours: number): string {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours - Math.floor(hours)) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /**
   * Вспомогательный метод определения фазы суток
   */
  private getPhaseName(hours: number): string {
    if (hours >= 5 && hours < 8) return 'Рассвет';
    if (hours >= 8 && hours < 17) return 'Яркий день';
    if (hours >= 17 && hours < 21) return 'Закат';
    return 'Лунная ночь';
  }
}
