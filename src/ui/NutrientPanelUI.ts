// src/ui/NutrientPanelUI.ts

export type ElementGroup = 'organogens' | 'skeletal' | 'salts' | 'catalysts' | 'extreme';

export interface NutrientElement {
  id: string;
  symbol: string;
  name: string;
  color: string;
  group: ElementGroup;
}

export const NUTRIENT_ELEMENTS: NutrientElement[] = [
  // 1. Органогены
  { id: 'C', symbol: 'C', name: 'Углерод', color: '#4A5568', group: 'organogens' },
  { id: 'N', symbol: 'N', name: 'Азот', color: '#00D2FF', group: 'organogens' },
  { id: 'P', symbol: 'P', name: 'Фосфор', color: '#BF00FF', group: 'organogens' },
  { id: 'S', symbol: 'S', name: 'Сера', color: '#FFE600', group: 'organogens' },

  // 2. Скелетные
  { id: 'Ca', symbol: 'Ca', name: 'Кальций', color: '#E2E8F0', group: 'skeletal' },
  { id: 'Si', symbol: 'Si', name: 'Кремний', color: '#FFD700', group: 'skeletal' },
  { id: 'Sr', symbol: 'Sr', name: 'Стронций', color: '#6EE7B7', group: 'skeletal' },

  // 3. Соли
  { id: 'Na', symbol: 'Na', name: 'Натрий', color: '#F6AD55', group: 'salts' },
  { id: 'Cl', symbol: 'Cl', name: 'Хлор', color: '#A3E635', group: 'salts' },
  { id: 'K', symbol: 'K', name: 'Калий', color: '#D6BCFA', group: 'salts' },

  // 4. Катализаторы
  { id: 'Fe', symbol: 'Fe', name: 'Железо', color: '#FF4500', group: 'catalysts' },
  { id: 'Mg', symbol: 'Mg', name: 'Магний', color: '#00FF66', group: 'catalysts' },
  { id: 'Cu', symbol: 'Cu', name: 'Медь', color: '#00F5D4', group: 'catalysts' },
  { id: 'Zn', symbol: 'Zn', name: 'Цинк', color: '#38BDF8', group: 'catalysts' },
  { id: 'Mn', symbol: 'Mn', name: 'Марганец', color: '#F43F5E', group: 'catalysts' },
  { id: 'Mo', symbol: 'Mo', name: 'Молибден', color: '#8B5CF6', group: 'catalysts' },
  { id: 'Co', symbol: 'Co', name: 'Кобальт', color: '#2563EB', group: 'catalysts' },

  // 5. Экстремальные
  { id: 'Se', symbol: 'Se', name: 'Селен', color: '#FB7185', group: 'extreme' },
  { id: 'I', symbol: 'I', name: 'Иод', color: '#7E22CE', group: 'extreme' },
  { id: 'V', symbol: 'V', name: 'Ванадий', color: '#059669', group: 'extreme' },
  { id: 'As', symbol: 'As', name: 'Мышьяк', color: '#84CC16', group: 'extreme' },
];

export class NutrientPanelUI {
  private container: HTMLDivElement;
  private activeTab: 'view' | 'injector' = 'view';
  private selectedGroup: ElementGroup | 'all' = 'all';
  private selectedElementId: string = 'C';
  private brushSize: number = 1;
  private onCloseCallback?: () => void;

  constructor() {
    this.injectStyles();
    this.container = this.createPanelDOM();
    document.body.appendChild(this.container);
    this.bindEvents();
    this.render();
  }

  public setOnCloseCallback(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  public show(): void {
    this.container.classList.add('visible');
  }

  public hide(): void {
    const wasVisible = this.container.classList.contains('visible');
    this.container.classList.remove('visible');
    if (wasVisible && this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  public toggle(visible?: boolean): boolean {
    const shouldShow = visible !== undefined ? visible : !this.container.classList.contains('visible');
    if (shouldShow) this.show();
    else this.hide();
    return shouldShow;
  }

  public getSelectedElement(): NutrientElement {
    return NUTRIENT_ELEMENTS.find(e => e.id === this.selectedElementId) || NUTRIENT_ELEMENTS[0];
  }

  public getActiveTab(): 'view' | 'injector' {
    return this.activeTab;
  }

  private createPanelDOM(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'nutrient-panel-ui';
    panel.className = 'nutrient-panel';
    return panel;
  }

  private render(): void {
    this.container.innerHTML = `
      <!-- Шапка панели -->
      <div class="panel-header">
        <div class="panel-title">
          <span class="icon">🧪</span>
          <span>Нутриенты и Химия</span>
        </div>
        <button class="panel-close-btn" id="btn-close-panel">✕</button>
      </div>

      <!-- Переключатель вкладок -->
      <div class="panel-tabs">
        <button class="tab-btn ${this.activeTab === 'view' ? 'active' : ''}" data-tab="view">
          👁️ Просмотр
        </button>
        <button class="tab-btn ${this.activeTab === 'injector' ? 'active' : ''}" data-tab="injector">
          🖌️ Инжектор
        </button>
      </div>

      <!-- Тело вкладок -->
      <div class="panel-content">
        ${this.activeTab === 'view' ? this.renderViewTab() : this.renderInjectorTab()}
      </div>
    `;

    this.attachDynamicListeners();
  }

  private renderViewTab(): string {
    const filteredElements = this.selectedGroup === 'all' 
      ? NUTRIENT_ELEMENTS 
      : NUTRIENT_ELEMENTS.filter(e => e.group === this.selectedGroup);

    return `
      <!-- Фильтр групп -->
      <div class="group-filter">
        <button class="filter-chip ${this.selectedGroup === 'all' ? 'active' : ''}" data-group="all">Все</button>
        <button class="filter-chip ${this.selectedGroup === 'organogens' ? 'active' : ''}" data-group="organogens">Органогены</button>
        <button class="filter-chip ${this.selectedGroup === 'skeletal' ? 'active' : ''}" data-group="skeletal">Скелет</button>
        <button class="filter-chip ${this.selectedGroup === 'salts' ? 'active' : ''}" data-group="salts">Соли</button>
        <button class="filter-chip ${this.selectedGroup === 'catalysts' ? 'active' : ''}" data-group="catalysts">Катализ</button>
        <button class="filter-chip ${this.selectedGroup === 'extreme' ? 'active' : ''}" data-group="extreme">Экстрем</button>
      </div>

      <!-- Сетка элементов -->
      <div class="elements-grid">
        ${filteredElements.map(el => `
          <div class="element-card ${this.selectedElementId === el.id ? 'selected' : ''}" data-element-id="${el.id}">
            <span class="color-badge" style="background-color: ${el.color}; box-shadow: 0 0 6px ${el.color}aa;"></span>
            <span class="element-symbol">${el.symbol}</span>
            <span class="element-name">${el.name}</span>
          </div>
        `).join('')}
      </div>

      <!-- Шкала концентрации -->
      <div class="heatmap-legend">
        <span class="legend-label">0 mg/L</span>
        <div class="gradient-bar"></div>
        <span class="legend-label">Max</span>
      </div>
    `;
  }

  private renderInjectorTab(): string {
    const selectedEl = this.getSelectedElement();

    return `
      <div class="injector-active-element">
        <span class="label">Кисть элемента:</span>
        <div class="selected-badge" style="border-color: ${selectedEl.color}">
          <span class="dot" style="background-color: ${selectedEl.color}"></span>
          <strong>${selectedEl.symbol}</strong> -- ${selectedEl.name}
        </div>
      </div>

      <div class="control-group">
        <label>Размер кисти (ячейки):</label>
        <div class="size-selector">
          <button class="size-btn ${this.brushSize === 1 ? 'active' : ''}" data-size="1">1 x 1</button>
          <button class="size-btn ${this.brushSize === 3 ? 'active' : ''}" data-size="3">3 x 3</button>
          <button class="size-btn ${this.brushSize === 5 ? 'active' : ''}" data-size="5">5 x 5</button>
        </div>
      </div>

      <div class="control-group">
        <label>Интенсивность распыления:</label>
        <div class="slider-wrapper">
          <input type="range" min="10" max="500" value="100" class="intensity-slider" id="intensity-slider">
          <span class="slider-value" id="intensity-val">100 mg</span>
        </div>
      </div>

      <div class="injector-actions">
        <button class="action-btn danger">🧹 Очистить сетку</button>
        <button class="action-btn secondary">⏸️ Пауза диффузии</button>
      </div>
    `;
  }

  private bindEvents(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.closest('#btn-close-panel')) {
        this.hide();
        return;
      }

      const tabBtn = target.closest('.tab-btn') as HTMLElement;
      if (tabBtn) {
        this.activeTab = tabBtn.dataset.tab as 'view' | 'injector';
        this.render();
        return;
      }

      const groupChip = target.closest('.filter-chip') as HTMLElement;
      if (groupChip) {
        this.selectedGroup = groupChip.dataset.group as ElementGroup | 'all';
        this.render();
        return;
      }

      const elCard = target.closest('.element-card') as HTMLElement;
      if (elCard) {
        this.selectedElementId = elCard.dataset.elementId!;
        this.render();
        return;
      }

      const sizeBtn = target.closest('.size-btn') as HTMLElement;
      if (sizeBtn) {
        this.brushSize = parseInt(sizeBtn.dataset.size!, 10);
        this.render();
        return;
      }
    });
  }

  private attachDynamicListeners(): void {
    const slider = this.container.querySelector('#intensity-slider') as HTMLInputElement;
    const sliderVal = this.container.querySelector('#intensity-val');
    if (slider && sliderVal) {
      slider.addEventListener('input', () => {
        sliderVal.textContent = `${slider.value} mg`;
      });
    }
  }

  private injectStyles(): void {
    if (document.getElementById('nutrient-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'nutrient-panel-styles';
    style.textContent = `
      .nutrient-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        background: rgba(22, 27, 34, 0.88);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        color: #c9d1d9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        z-index: 9999;
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        overflow: hidden;
      }

      .nutrient-panel.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 14px;
        color: #f0f6fc;
      }

      .panel-close-btn {
        background: none;
        border: none;
        color: #8b949e;
        font-size: 16px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: all 0.15s ease;
      }

      .panel-close-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }

      .panel-tabs {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.2);
      }

      .tab-btn {
        flex: 1;
        padding: 10px;
        background: none;
        border: none;
        color: #8b949e;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .tab-btn:hover {
        color: #c9d1d9;
        background: rgba(255, 255, 255, 0.02);
      }

      .tab-btn.active {
        color: #58a6ff;
        border-bottom: 2px solid #58a6ff;
        background: rgba(88, 166, 255, 0.05);
      }

      .panel-content {
        padding: 14px;
        max-height: 480px;
        overflow-y: auto;
      }

      .group-filter {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 12px;
      }

      .filter-chip {
        padding: 4px 8px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        color: #8b949e;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .filter-chip:hover {
        border-color: rgba(255, 255, 255, 0.2);
        color: #c9d1d9;
      }

      .filter-chip.active {
        background: #238636;
        color: #ffffff;
        border-color: #2ea043;
      }

      .elements-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
        margin-bottom: 14px;
      }

      .element-card {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .element-card:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.15);
      }

      .element-card.selected {
        border-color: #58a6ff;
        background: rgba(88, 166, 255, 0.12);
      }

      .color-badge {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .element-symbol {
        font-weight: 700;
        font-size: 11px;
        color: #f0f6fc;
        min-width: 18px;
      }

      .element-name {
        font-size: 11px;
        color: #8b949e;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .heatmap-legend {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .gradient-bar {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: linear-gradient(90deg, rgba(0,210,255,0.05) 0%, rgba(0,210,255,1) 100%);
      }

      .legend-label {
        font-size: 10px;
        color: #8b949e;
      }

      .injector-active-element {
        margin-bottom: 12px;
      }

      .injector-active-element .label {
        font-size: 11px;
        color: #8b949e;
        display: block;
        margin-bottom: 4px;
      }

      .selected-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #00D2FF;
        border-radius: 6px;
        font-size: 12px;
      }

      .selected-badge .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .control-group {
        margin-bottom: 12px;
      }

      .control-group label {
        display: block;
        font-size: 11px;
        color: #8b949e;
        margin-bottom: 6px;
      }

      .size-selector {
        display: flex;
        gap: 6px;
      }

      .size-btn {
        flex: 1;
        padding: 6px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #c9d1d9;
        font-size: 11px;
        cursor: pointer;
      }

      .size-btn.active {
        background: #1f6feb;
        border-color: #388bfd;
        color: #ffffff;
      }

      .slider-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .intensity-slider {
        flex: 1;
        accent-color: #58a6ff;
      }

      .slider-value {
        font-size: 11px;
        color: #58a6ff;
        font-weight: 600;
        min-width: 45px;
      }

      .injector-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 14px;
      }

      .action-btn {
        padding: 8px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .action-btn.danger {
        background: rgba(248, 81, 73, 0.1);
        border-color: rgba(248, 81, 73, 0.4);
        color: #ff7b72;
      }

      .action-btn.danger:hover {
        background: rgba(248, 81, 73, 0.2);
      }

      .action-btn.secondary {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
        color: #c9d1d9;
      }
    `;
    document.head.appendChild(style);
  }
}
