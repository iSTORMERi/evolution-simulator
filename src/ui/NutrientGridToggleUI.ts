// src/ui/NutrientGridToggleUI.ts

import { NutrientGridDebug } from '../visuals/NutrientGridDebug';
import { NutrientPanelUI } from './NutrientPanelUI';

export class NutrientGridToggleUI {
  private button: HTMLButtonElement;
  private gridDebug: NutrientGridDebug;
  private panelUI: NutrientPanelUI;

  constructor(gridDebug: NutrientGridDebug) {
    this.gridDebug = gridDebug;
    this.panelUI = new NutrientPanelUI();
    this.button = document.createElement('button');
    this.initUI();
  }

  private initUI(): void {
    this.button.id = 'btn-toggle-nutrient-grid';
    // Иконка сетки / глобуса
    this.button.innerHTML = '🌐';
    this.button.title = 'Сетка нутриентов';

    // Стилизуем под круглые плавающие кнопки в правом нижнем углу
    Object.assign(this.button.style, {
      position: 'fixed',
      bottom: '140px', // Располагаем НАД кнопкой течений (80px + отступ)
      right: '20px',
      width: '50px',
      height: '50px',
      borderRadius: '50%',
      backgroundColor: 'rgba(30, 35, 45, 0.75)',
      backdropFilter: 'blur(8px)',
      webkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      color: '#ffffff',
      fontSize: '22px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1000', // Поверх PixiJS холста
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      transition: 'all 0.2s ease',
      outline: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none',
    });

    // Эффект при клике (подсветка синим при включении и показ панели UI)
    this.button.addEventListener('click', () => {
      const isVisible = this.gridDebug.toggle();

      // Синхронизируем состояние боковой панели нутриентов
      this.panelUI.toggle(isVisible);

      if (isVisible) {
        this.button.style.backgroundColor = 'rgba(74, 160, 237, 0.4)';
        this.button.style.borderColor = '#4aa0ed';
        this.button.style.boxShadow = '0 0 12px rgba(74, 160, 237, 0.5)';
      } else {
        this.button.style.backgroundColor = 'rgba(30, 35, 45, 0.75)';
        this.button.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        this.button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      }
    });

    document.body.appendChild(this.button);
  }

  public setVisible(visible: boolean): void {
    this.button.style.display = visible ? 'flex' : 'none';
  }
}
