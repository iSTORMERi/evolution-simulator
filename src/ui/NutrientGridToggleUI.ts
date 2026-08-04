// src/ui/NutrientGridToggleUI.ts

import * as PIXI from 'pixi.js';
import { NutrientGridDebug } from '../visuals/NutrientGridDebug';
import { NutrientPanelUI } from './NutrientPanelUI';
import { NutrientGrid } from '../simulation/NutrientGrid';

export class NutrientGridToggleUI {
  private gridButton: HTMLButtonElement;
  private configButton: HTMLButtonElement;
  private gridDebug: NutrientGridDebug;
  private nutrientGrid: NutrientGrid;
  private panelUI: NutrientPanelUI;
  private app?: PIXI.Application;
  private worldContainer?: PIXI.Container;

  private isMouseDown: boolean = false;

  constructor(
    gridDebug: NutrientGridDebug, 
    nutrientGrid: NutrientGrid,
    app?: PIXI.Application,
    worldContainer?: PIXI.Container
  ) {
    this.gridDebug = gridDebug;
    this.nutrientGrid = nutrientGrid;
    this.app = app;
    this.worldContainer = worldContainer;

    // Передаем ссылку на NutrientGrid в интерфейс панели
    this.panelUI = new NutrientPanelUI(this.nutrientGrid);

    this.gridButton = document.createElement('button');
    this.configButton = document.createElement('button');

    this.initUI();
    this.initWorldInjectorEvents();
  }

  private initUI(): void {
    // 1. Главная кнопка сетки 🌐
    this.gridButton.id = 'btn-toggle-nutrient-grid';
    this.gridButton.innerHTML = '🌐';
    this.gridButton.title = 'Показать / скрыть сетку нутриентов';

    Object.assign(this.gridButton.style, {
      position: 'fixed',
      bottom: '140px',
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

    // 2. Дополнительная кнопка панели 🧪
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
      display: 'none',
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

    // Клик по 🌐 (переключение сетки)
    this.gridButton.addEventListener('click', () => {
      const isGridVisible = this.gridDebug.toggle();
      this.updateGridButtonState(isGridVisible);

      if (isGridVisible) {
        this.showConfigButton();
      } else {
        this.hideConfigButton();
        this.panelUI.hide();
        this.updateConfigButtonActiveState(false);
      }
    });

    // Клик по 🧪 (открытие окна инжектора)
    this.configButton.addEventListener('click', () => {
      const isPanelVisible = this.panelUI.toggle();
      this.updateConfigButtonActiveState(isPanelVisible);

      // Если открываем панель, а сетка была выключена — автоматически включаем её
      if (isPanelVisible && !this.gridDebug.container.visible) {
        this.gridDebug.container.visible = true;
        this.updateGridButtonState(true);
      }
    });

    this.panelUI.setOnCloseCallback(() => {
      this.updateConfigButtonActiveState(false);
    });

    document.body.appendChild(this.gridButton);
    document.body.appendChild(this.configButton);
  }

  /**
   * Обновление стилей главной кнопки сетки 🌐
   */
  private updateGridButtonState(isVisible: boolean): void {
    if (isVisible) {
      this.gridButton.style.backgroundColor = 'rgba(74, 160, 237, 0.4)';
      this.gridButton.style.borderColor = '#4aa0ed';
      this.gridButton.style.boxShadow = '0 0 12px rgba(74, 160, 237, 0.5)';
    } else {
      this.gridButton.style.backgroundColor = 'rgba(30, 35, 45, 0.75)';
      this.gridButton.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      this.gridButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    }
  }

  /**
   * Слушатели мыши/тача для распыления вещества прямо по игровому миру
   */
  private initWorldInjectorEvents(): void {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (!this.panelUI.isInjectorActive()) return;

      // Игнорируем клики, если они приходятся строго на элементы UI управления
      const target = e.target as HTMLElement;
      if (target && (target.closest('#nutrient-panel-ui') || target.closest('button'))) {
        return;
      }

      // Автоматически включаем видимость сетки при первом же тапе инжектором
      if (!this.gridDebug.container.visible) {
        this.gridDebug.container.visible = true;
        this.updateGridButtonState(true);
      }

      this.isMouseDown = true;
      this.triggerInjection(e);
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (this.isMouseDown && this.panelUI.isInjectorActive()) {
        this.triggerInjection(e);
      }
    };

    const handlePointerUp = () => {
      this.isMouseDown = false;
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    window.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  }

  /**
   * Преобразование экранных координат клика в мировые координаты PixiJS и вызов инжектора
   */
  private triggerInjection(e: MouseEvent | TouchEvent): void {
    let clientX = 0;
    let clientY = 0;

    if (e instanceof MouseEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    let worldX = clientX;
    let worldY = clientY;

    // Точный перевод экранных пикселей в мировые координаты с учетом масштаба и сдвига камеры
    if (this.worldContainer) {
      worldX = (clientX - this.worldContainer.position.x) / this.worldContainer.scale.x;
      worldY = (clientY - this.worldContainer.position.y) / this.worldContainer.scale.y;
    }

    const config = this.panelUI.getInjectorConfig();
    this.nutrientGrid.injectNutrient(
      worldX,
      worldY,
      config.element,
      config.intensity,
      config.brushSize
    );
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
