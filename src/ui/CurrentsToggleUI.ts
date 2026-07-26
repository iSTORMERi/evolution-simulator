export class CurrentsToggleUI {
  private isVisible: boolean = false;
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
      this.isVisible = !this.isVisible;
      this.button?.classList.toggle('active', this.isVisible);

      if (this.onToggleCallback) {
        this.onToggleCallback(this.isVisible);
      }
    });
  }

  public onToggle(callback: (visible: boolean) => void): void {
    this.onToggleCallback = callback;
  }

  public get isCurrentsVisible(): boolean {
    return this.isVisible;
  }
}
