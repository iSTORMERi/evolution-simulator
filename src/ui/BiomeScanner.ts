// src/ui/BiomeScanner.ts

import { WorldMap } from '../world/WorldMap';
import { ZoneConfig } from '../world/types';

export class BiomeScanner {
  private isActive: boolean = false;
  private worldMap: WorldMap;
  
  private toggleButton: HTMLButtonElement;
  private tooltipElement: HTMLDivElement;

  constructor(worldMap: WorldMap) {
    this.worldMap = worldMap;

    // 1. Создаем кнопку сканера (справа снизу)
    this.toggleButton = document.createElement('button');
    this.setupButtonStyles();

    // 2. Создаем карточку характеристик
    this.tooltipElement = document.createElement('div');
    this.setupTooltipStyles();

    document.body.appendChild(this.toggleButton);
    document.body.appendChild(this.tooltipElement);

    this.bindEvents();
  }

  private setupButtonStyles(): void {
    const btn = this.toggleButton;
    btn.innerHTML = '🔍'; // Можно заменить на SVG иконку
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '54px',
      height: '54px',
      borderRadius: '50%',
      border: '2px solid rgba(255, 255, 255, 0.4)',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      color: '#ffffff',
      fontSize: '24px',
      zIndex: '1000',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      outline: 'none',
      webkitTapHighlightColor: 'transparent',
      transition: 'transform 0.2s, background-color 0.2s, border-color 0.2s',
    });
  }

  private setupTooltipStyles(): void {
    const card = this.tooltipElement;
    Object.assign(card.style, {
      position: 'fixed',
      display: 'none',
      zIndex: '1001',
      padding: '12px 16px',
      borderRadius: '12px',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      color: '#f8fafc',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
      pointerEvents: 'none', // чтобы тап сквозь плашку не лагал
      transform: 'translate(-50%, -120%)', // Центрируем над пальцем
      transition: 'opacity 0.2s ease',
    });
  }

  private bindEvents(): void {
    // Переключение режима сканирования
    this.toggleButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isActive = !this.isActive;
      
      if (this.isActive) {
        this.toggleButton.style.backgroundColor = 'rgba(14, 165, 233, 0.9)';
        this.toggleButton.style.borderColor = '#38bdf8';
      } else {
        this.toggleButton.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
        this.toggleButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        this.hideTooltip();
        // Снимаем подсветку и убираем маркер
        this.worldMap.highlightZone(null);
      }
    });

    // Обработка тапа по интерактивному контейнеру WorldMap
    this.worldMap.container.eventMode = 'static';
    this.worldMap.container.on('pointerdown', (event) => {
      if (!this.isActive) return;

      // Берем мировые координаты тапа
      const localPos = event.getLocalPosition(this.worldMap.container);
      const zone = this.worldMap.getZoneAt(localPos.x, localPos.y);

      // Включаем шейдерную подсветку биома и ставим прицел в точку клика
      this.worldMap.highlightZone(zone.hexColor, localPos.x, localPos.y);

      // Экранные координаты для позиционирования HTML-плашки
      const screenX = event.global.x;
      const screenY = event.global.y;

      this.showZoneInfo(zone, screenX, screenY);
    });
  }

  private showZoneInfo(zone: ZoneConfig, screenX: number, screenY: number): void {
    this.tooltipElement.innerHTML = `
      <div style="font-weight: bold; font-size: 15px; color: #38bdf8; margin-bottom: 6px;">
        ${zone.name || 'Неизвестный биом'}
      </div>
      <div style="display: grid; grid-template-columns: auto auto; gap: 4px 12px;">
        <span>🌡️ Температура:</span> <b>${zone.temperature ?? '--'} °C</b>
        <span>🧂 Солёность:</span> <b>${zone.salinity ?? '--'} ‰</b>
        <span>⚓ Давление:</span> <b>${zone.pressure ?? '--'} атм</b>
        <span>☀️ Свет:</span> <b>${zone.lightLevel ?? '--'} %</b>
      </div>
    `;

    // Корректируем координаты, чтобы плашка не вылезала за края экрана телефона
    const clampX = Math.max(100, Math.min(window.innerWidth - 100, screenX));
    const clampY = Math.max(120, screenY);

    this.tooltipElement.style.left = `${clampX}px`;
    this.tooltipElement.style.top = `${clampY}px`;
    this.tooltipElement.style.display = 'block';
  }

  public hideTooltip(): void {
    this.tooltipElement.style.display = 'none';
  }
}
