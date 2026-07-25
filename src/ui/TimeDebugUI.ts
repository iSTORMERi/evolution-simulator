// src/ui/TimeDebugUI.ts

import { LightingController } from '../world/LightingController';

export class TimeDebugUI {
  private lightingController: LightingController;
  private container: HTMLDivElement;
  private slider: HTMLInputElement;
  private timeLabel: HTMLDivElement;
  private autoPlayButton: HTMLButtonElement;

  private isAutoPlaying: boolean = false;
  private intervalId: number | null = null;

  constructor(lightingController: LightingController) {
    this.lightingController = lightingController;

    // 1. Главный контейнер (зафиксирован сверху по центру, статичный размер)
    this.container = document.createElement('div');
    this.setupContainerStyles();

    // 2. Верхняя строка: Текст времени (слева) + Кнопка автопрокрутки (справа)
    const headerRow = document.createElement('div');
    Object.assign(headerRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px',
      gap: '8px',
    });

    this.timeLabel = document.createElement('div');
    Object.assign(this.timeLabel.style, {
      fontWeight: 'bold',
      color: '#38bdf8',
      fontSize: '13px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: '0', // Защита от переполнения
    });
    this.timeLabel.innerText = '🕒 12:00 (Яркий день)';

    this.autoPlayButton = document.createElement('button');
    this.setupAutoPlayButtonStyles();
    this.autoPlayButton.addEventListener('click', () => this.toggleAutoPlay());

    headerRow.appendChild(this.timeLabel);
    headerRow.appendChild(this.autoPlayButton);

    // 3. Ползунок переключения времени суток
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '24';
    this.slider.step = '0.05';
    this.slider.value = '12';
    Object.assign(this.slider.style, {
      width: '100%',
      cursor: 'pointer',
      accentColor: '#38bdf8',
    });

    this.slider.addEventListener('input', () => {
      // При ручном перетаскивании останавливаем автопрокрутку
      if (this.isAutoPlaying) {
        this.stopAutoPlay();
      }
      const hours = parseFloat(this.slider.value);
      this.setTime(hours);
    });

    this.container.appendChild(headerRow);
    this.container.appendChild(this.slider);
    document.body.appendChild(this.container);

    // Устанавливаем начальное значение
    this.setTime(12);
  }

  private setupContainerStyles(): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: '400px',
      padding: '10px 14px',
      borderRadius: '12px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      zIndex: '1000',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      boxSizing: 'border-box',
    });
  }

  private setupAutoPlayButtonStyles(): void {
    this.autoPlayButton.innerHTML = '▶️ 5м/с';
    Object.assign(this.autoPlayButton.style, {
      padding: '4px 10px',
      borderRadius: '6px',
      border: '1px solid rgba(56, 189, 248, 0.4)',
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      color: '#f8fafc',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: '0',
      transition: 'all 0.2s ease',
    });
  }

  private toggleAutoPlay(): void {
    if (this.isAutoPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  }

  private startAutoPlay(): void {
    this.isAutoPlaying = true;
    this.autoPlayButton.innerHTML = '⏸️ Пауза';
    this.autoPlayButton.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
    this.autoPlayButton.style.borderColor = 'rgba(239, 68, 68, 0.5)';

    // Добавляем +5 минут игрового времени каждую секунду (прибавка по 0.5 мин каждые 100 мс)
    this.intervalId = window.setInterval(() => {
      let currentHours = parseFloat(this.slider.value);
      currentHours = (currentHours + (5 / 60) / 10) % 24;
      this.setTime(currentHours);
    }, 100);
  }

  private stopAutoPlay(): void {
    this.isAutoPlaying = false;
    this.autoPlayButton.innerHTML = '▶️ 5м/с';
    this.autoPlayButton.style.backgroundColor = 'rgba(56, 189, 248, 0.15)';
    this.autoPlayButton.style.borderColor = 'rgba(56, 189, 248, 0.4)';

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
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
