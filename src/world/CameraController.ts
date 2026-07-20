import * as PIXI from 'pixi.js';

export class CameraController {
  private container: PIXI.Container;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private containerStart = { x: 0, y: 0 };

  // Ограничения масштаба
  public minScale = 0.2;
  public maxScale = 5.0;

  // Touch/Pinch параметры для мобильных
  private initialTouchDistance = 0;
  private initialScale = 1;

  constructor(container: PIXI.Container, canvasElement: HTMLElement) {
    this.container = container;
    this.setupEvents(canvasElement);
  }

  private setupEvents(element: HTMLElement): void {
    // === Драг мышью и одним пальцем ===
    element.addEventListener('pointerdown', (e) => {
      // Игнорируем стартовый драг, если касание двумя пальцами (pinch)
      if (e.pointerType === 'touch' && !e.isPrimary) return;

      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.containerStart = { x: this.container.x, y: this.container.y };
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;

      this.container.x = this.containerStart.x + dx;
      this.container.y = this.containerStart.y + dy;
    });

    const stopDrag = () => {
      this.isDragging = false;
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    // === Колесо мыши (Zoom) ===
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAt(e.clientX, e.clientY, zoomFactor);
    }, { passive: false });

    // === Multi-touch (Pinch-to-zoom на iPhone) ===
    element.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.isDragging = false;
        this.initialTouchDistance = this.getTouchDistance(e.touches);
        this.initialScale = this.container.scale.x;
      }
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = this.getTouchDistance(e.touches);
        if (this.initialTouchDistance > 0) {
          const factor = currentDistance / this.initialTouchDistance;
          const targetScale = Math.min(Math.max(this.initialScale * factor, this.minScale), this.maxScale);

          // Центр между двумя пальцами
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

          this.zoomToScale(midX, midY, targetScale);
        }
      }
    }, { passive: false });
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  public zoomAt(screenX: number, screenY: number, factor: number): void {
    const currentScale = this.container.scale.x;
    const newScale = Math.min(Math.max(currentScale * factor, this.minScale), this.maxScale);
    this.zoomToScale(screenX, screenY, newScale);
  }

  public zoomToScale(screenX: number, screenY: number, newScale: number): void {
    const currentScale = this.container.scale.x;
    const worldPos = {
      x: (screenX - this.container.x) / currentScale,
      y: (screenY - this.container.y) / currentScale,
    };

    this.container.scale.set(newScale);
    this.container.x = screenX - worldPos.x * newScale;
    this.container.y = screenY - worldPos.y * newScale;
  }

  // Заполнить экран по высоте по умолчанию
  public fitToView(screenWidth: number, screenHeight: number, worldWidth: number, worldHeight: number): void {
    const scale = Math.max(screenWidth / worldWidth, screenHeight / worldHeight);
    this.container.scale.set(scale);
    this.container.x = (screenWidth - worldWidth * scale) / 2;
    this.container.y = (screenHeight - worldHeight * scale) / 2;
  }
}
