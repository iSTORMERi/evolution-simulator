// src/ui/NutrientGridToggleUI.ts

import { NutrientGridDebug } from '../visuals/NutrientGridDebug'; // Или '../debug/NutrientGridDebug' в зависимости от того, куда положил визуализатор

export class NutrientGridToggleUI {
  private button: HTMLButtonElement;
  private gridDebug: NutrientGridDebug;

  /**
   * @param gridDebug - Экземпляр визуализатора сетки
   * @param containerSelectorOrEl - Селектор или сам DOM-элемент UI-панели (по умолчанию вставляет в нужный блок)
   */
  constructor(gridDebug: NutrientGridDebug, containerSelectorOrEl: string | HTMLElement = '.ui-panel') {
    this.gridDebug = gridDebug;
    this.button = document.createElement('button');
    
    this.initUI(containerSelectorOrEl);
  }

  private initUI(containerTarget: string | HTMLElement): void {
    // Настройка идентификаторов и классов
    this.button.id = 'btn-toggle-nutrient-grid';
    this.button.className = 'ui-button toggle-btn'; // Используем существующие стили проекта
    this.button.innerHTML = '🌐 Сетка нутриентов';

    // Обработка нажатия
    this.button.addEventListener('click', () => {
      const isVisible = this.gridDebug.toggle();
      this.button.classList.toggle('active', isVisible);
    });

    // Находим родительский контейнер
    let container: HTMLElement | null = null;
    if (typeof containerTarget === 'string') {
      container = document.querySelector(containerTarget);
    } else {
      container = containerTarget;
    }

    // Если контейнер не найден, fallback на document.body
    const parent = container || document.body;

    // 🎯 Вставляем кнопку В САМОЕ НАЧАЛО панельки, чтобы она оказалась НАД кнопками течений и биомов
    if (parent.firstChild) {
      parent.insertBefore(this.button, parent.firstChild);
    } else {
      parent.appendChild(this.button);
    }
  }

  /**
   * Переключить доступность самой кнопки на экране
   */
  public setVisible(visible: boolean): void {
    this.button.style.display = visible ? 'block' : 'none';
  }
}
