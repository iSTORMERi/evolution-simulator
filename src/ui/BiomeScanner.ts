// src/ui/BiomeScanner.ts

import { WorldMap } from '../world/WorldMap';
import { ZoneConfig } from '../world/types';
import { LightingController } from '../world/LightingController';

export class BiomeScanner {
  private isActive: boolean = false;
  private worldMap: WorldMap;
  private lightingController: LightingController;
  
  private toggleButton: HTMLButtonElement;
  private tooltipElement: HTMLDivElement;

  // Состояние выбранной зоны для живого обновления UI
  private currentSelectedZone: ZoneConfig | null = null;
  private lastScreenX: number = 0;
  private lastScreenY: number = 0;

  constructor(worldMap: WorldMap, lightingController: LightingController) {
    this.worldMap = worldMap;
    this.lightingController = lightingController;

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
    btn.innerHTML = '🔍';
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
      pointerEvents: 'none',
      transform: 'translate(-50%, -120%)',
      transition: 'opacity 0.2s ease',
    });
  }

  private bindEvents(): void {
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
        this.worldMap.highlightZone(null);
      }
    });

    this.worldMap.container.eventMode = 'static';
    this.worldMap.container.on('pointerdown', (event) => {
      if (!this.isActive) return;

      const localPos = event.getLocalPosition(this.worldMap.container);
      const zone = this.worldMap.getZoneAt(localPos.x, localPos.y);

      this.worldMap.highlightZone(zone.hexColor, localPos.x, localPos.y);

      this.currentSelectedZone = zone;
      this.lastScreenX = event.global.x;
      this.lastScreenY = event.global.y;

      this.renderTooltip();
    });
  }

  /**
   * Вызывается каждый кадр в игровом цикле main.ts для динамического обновления UI
   */
  public update(): void {
    if (this.isActive && this.currentSelectedZone && this.tooltipElement.style.display !== 'none') {
      this.renderTooltip();
    }
  }

  /**
   * Считывание текущего часа из контроллера освещения
   */
  private getHoursFromController(): number {
    if (this.lightingController && typeof this.lightingController.getCurrentHours === 'function') {
      return this.lightingController.getCurrentHours();
    }
    return 12;
  }

  private renderTooltip(): void {
    if (!this.currentSelectedZone) return;

    const zone = this.currentSelectedZone;
    const params = zone.params;

    // Получаем текущее время суток от LightingController (в часах: 0.0 - 24.0)
    const currentHour = this.getHoursFromController();

    // 1. Явный расчёт солнечного света (только с 06:00 до 18:00)
    let sunFactor = 0;
    if (currentHour >= 6 && currentHour <= 18) {
      const dayProgress = (currentHour - 6) / 12; // от 0 до 1
      sunFactor = Math.sin(dayProgress * Math.PI); // синусоида дня (0 -> 1 -> 0)
    }

    // Минимальный ночной свет от Луны -- 3% (0.03), дневной максимум -- 100% (1.0)
    const effectiveLightFactor = Math.max(0.03, sunFactor);
    const currentLightVal = params.baseLight * effectiveLightFactor;
    const lightPercent = Math.round(currentLightVal * 100);

    // 2. Гладкий 24-часовой расчёт температуры от Солнца
    // Пик прогрева в 14:00 (+3 °C), минимум предрассветный в 02:00 (-3 °C)
    const tempAngle = ((currentHour - 2) / 24) * 2 * Math.PI;
    const deltaTempSun = -Math.cos(tempAngle) * 3.0;
    const currentTemp = (params.baseTemperature + (params.tempSensitivity * deltaTempSun)).toFixed(1);

    this.tooltipElement.innerHTML = `
      <div style="font-weight: bold; font-size: 15px; color: #38bdf8; margin-bottom: 6px;">
        ${zone.name || 'Неизвестный биом'}
      </div>
      <div style="display: grid; grid-template-columns: auto auto; gap: 4px 12px;">
        <span>🌡️ Температура:</span> <b>${currentTemp} °C</b>
        <span>🧂 Солёность:</span> <b>${params.salinity ?? '--'} ‰</b>
        <span>⚓ Давление:</span> <b>${params.pressure ?? '--'} атм</b>
        <span>☀️ Свет:</span> <b>${lightPercent} %</b>
      </div>
    `;

    const clampX = Math.max(100, Math.min(window.innerWidth - 100, this.lastScreenX));
    const clampY = Math.max(120, this.lastScreenY);

    this.tooltipElement.style.left = `${clampX}px`;
    this.tooltipElement.style.top = `${clampY}px`;
    this.tooltipElement.style.display = 'block';
  }

  public hideTooltip(): void {
    this.tooltipElement.style.display = 'none';
    this.currentSelectedZone = null;
  }
}
