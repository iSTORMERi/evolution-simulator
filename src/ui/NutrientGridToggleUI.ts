// src/ui/NutrientGridToggleUI.ts

import { NutrientGridDebug } from '../visuals/NutrientGridDebug';
import { NutrientPanelUI } from './NutrientPanelUI';

export class NutrientGridToggleUI {
  private gridButton: HTMLButtonElement;
  private configButton: HTMLButtonElement;
  private gridDebug: NutrientGridDebug;
  private panelUI: NutrientPanelUI;

  constructor(gridDebug: NutrientGridDebug) {
    this.gridDebug = gridDebug;
    this.panelUI = new NutrientPanelUI();

    this.gridButton = document.createElement('button');
    this.configButton = document.createElement('button');

    this.initUI();
  }

  private initUI(): void {
    // 1. Главная кнопка сетки 🌐
    this.gridButton.id = 'btn-toggle-nutrient-grid';
    this.gridButton.innerHTML = '🌐';
    this.gridButton.title = 'Показать / скрыть сетку нутриентов';

    Object.assign(this.gridButton.style, {
      position: 'fixed',
      bottom: '140px', // Расположение НАД кнопкой течений (80px + отступ)
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
      zIndex: '1000',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      transition: 'all 0.2s ease',
      outline: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none',
    });

    // 2. Дополнительная кнопка панели 🧪 (выезжает слева на right: 80px)
    this.configButton.id = 'btn-config-nutrient-panel';
    this.configButton.innerHTML = '🧪';
    this.configButton.title = 'Панель элементов и инжектора';

    Object.assign(this.configButton.style, {
      position: 'fixed',
      bottom: '140px',
      right: '80px',
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
      display: 'none', // Скрыта по умолчанию
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1000',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      transform: 'scale(0.5)',
      opacity: '0',
      outline: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none',
    });

    // Логика клика по кнопке 🌐 (сетка)
    this.gridButton.addEventListener('click', () => {
      const isGridVisible = this.gridDebug.toggle();

      if (isGridVisible) {
        // Подсвечиваем главную кнопку
        this.gridButton.style.backgroundColor = 'rgba(74, 160, 237, 0.4)';
        this.gridButton.style.borderColor = '#4aa0ed';
        this.gridButton.style.boxShadow = '0 0 12px rgba(74, 160, 237, 0.5)';

        // Плавно выдвигаем кнопку 🧪
        this.showConfigButton();
      } else {
        // Снимаем подсветку с главной кнопки
        this.gridButton.style.backgroundColor = 'rgba(30, 35, 45, 0.75)';
        this.gridButton.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        this.gridButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';

        // Прячем кнопку 🧪 и закрываем окно настроек
        this.hideConfigButton();
        this.panelUI.hide();
        this.updateConfigButtonActiveState(false);
      }
    });

    // Логика клика по кнопке 🧪 (вызов/скрытие окна элементов)
    this.configButton.addEventListener('click', () => {
      const isPanelVisible = this.panelUI.toggle();
      this.updateConfigButtonActiveState(isPanelVisible);
    });

    // Синхронизируем состояние кнопки 🧪 при закрытии окна крестиком (✕)
    this.panelUI.setOnCloseCallback(() => {
      this.updateConfigButtonActiveState(false);
    });

    document.body.appendChild(this.gridButton);
    document.body.appendChild(this.configButton);
  }

  private showConfigButton(): void {
    this.configButton.style.display = 'flex';
    requestAnimationFrame(() => {
      this.configButton.style.opacity = '1';
      this.configButton.style.transform = 'scale(1)';
    });
  }

  private hideConfigButton(): void {
    this.configButton.style.opacity = '0';
    this.configButton.style.transform = 'scale(0.5)';
    setTimeout(() => {
      if (this.configButton.style.opacity === '0') {
        this.configButton.style.display = 'none';
      }
    }, 250);
  }

  private updateConfigButtonActiveState(active: boolean): void {
    if (active) {
      this.configButton.style.backgroundColor = 'rgba(88, 166, 255, 0.4)';
      this.configButton.style.borderColor = '#58a6ff';
      this.configButton.style.boxShadow = '0 0 12px rgba(88, 166, 255, 0.5)';
    } else {
      this.configButton.style.backgroundColor = 'rgba(30, 35, 45, 0.75)';
      this.configButton.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      this.configButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    }
  }

  public setVisible(visible: boolean): void {
    this.gridButton.style.display = visible ? 'flex' : 'none';
    if (!visible) {
      this.hideConfigButton();
      this.panelUI.hide();
    }
  }
}
