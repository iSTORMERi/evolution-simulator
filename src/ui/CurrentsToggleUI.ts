export class CurrentsToggleUI {
  private _isVisible: boolean = false;
  private button: HTMLElement | null = null;
  private onToggleCallback: ((visible: boolean) => void) | null = null;

  constructor(buttonId: string = 'toggle-currents-btn') {
    this.button = document.getElementById(buttonId);
    this.init();
  }

  private init(): void {
    if (!this.button) {
      console.warn('[CurrentsToggleUI] Кнопка с ID toggle-currents-btn не найдена');
      return;
    }

    this.button.addEventListener('click', () => {
      this.toggle();
    });
  }

  /**
   * Переключает состояние видимости слоёв течений
   */
  public toggle(): void {
    this.setVisible(!this._isVisible);
  }

  /**
   * Программно устанавливает конкретное состояние видимости
   */
  public setVisible(visible: boolean): void {
    this._isVisible = visible;
    this.button?.classList.toggle('active', this._isVisible);

    if (this.onToggleCallback) {
      this.onToggleCallback(this._isVisible);
    }
  }

  /**
   * Подписка на изменение состояния кнопки
   */
  public onToggle(callback: (visible: boolean) => void): void {
    this.onToggleCallback = callback;
  }

  /**
   * Публичный геттер состояния видимости
   */
  public get isVisible(): boolean {
    return this._isVisible;
  }

  /**
   * Альтернативный геттер для обратной совместимости
   */
  public get isCurrentsVisible(): boolean {
    return this._isVisible;
  }
}
