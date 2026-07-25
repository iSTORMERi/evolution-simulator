// src/ui/TimeDebugUI.ts

import { LightingController } from '../world/LightingController';

export class TimeDebugUI {
  private lightingController: LightingController;
  private container: HTMLDivElement;
  private slider: HTMLInputElement;
  private timeLabel: HTMLDivElement;

  constructor(lightingController: LightingController) {
    this.lightingController = lightingController;

    // 1. Панель управления временем (сверху справа)
    this.container = document.createElement('div');
    this.setupContainerStyles();

    // 2. Текстовая плашка со временем и фазой
    this.timeLabel = document.createElement('div');
    this.timeLabel.style.marginBottom = '8px';
    this.timeLabel.style.fontWeight = 'bold';
    this.timeLabel.style.color = '#38bdf8';
    this.timeLabel.innerText = 'Время: 12:00';

    // 3. Ползунок переключения времени суток
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '24';
    this.slider.step = '0.1';
    this.slider.value = '12';
    this.slider.style.width = '100%';
    this.slider.style.cursor = 'pointer';

    this.slider.addEventListener('input', () => {
      const hours = parseFloat(this.slider.value);
      this.setTime(hours);
    });

    this.container.appendChild(this.timeLabel);
    this.container.appendChild(this.slider);
    document.body.appendChild(this.container);

    // Устанавливаем начальное значение
    this.setTime(12);
  }

  private setupContainerStyles(): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '12px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      zIndex: '1000',
      minWidth: '180px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    });
  }

  /**
   * Обновляет контроллер освещения и интерфейс
   */
  public setTime(hours: number): void {
    const state = this.lightingController.setTime(hours);
    this.slider.value = hours.toString();

    if (state) {
      const timeStr = state.formattedTime || '12:00';
      const phaseStr = state.phaseName ? ` (${state.phaseName})` : '';
      this.timeLabel.innerText = `🕒 ${timeStr}${phaseStr}`;
    }
  }
}
