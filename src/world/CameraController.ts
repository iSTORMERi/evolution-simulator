import * as PIXI from 'pixi.js';

export class CameraController {
  private container: PIXI.Container;
  private canvasElement: HTMLElement;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private containerStart = { x: 0, y: 0 };

  private worldWidth: number;
  private worldHeight: number;

  public minScale = 0.02;
  public maxScale = 15.0;

  private initialTouchDistance = 0;
  private initialScale = 1;

  constructor(
    container: PIXI.Container,
    canvasElement: HTMLElement,
    worldWidth: number,
    worldHeight: number
  ) {
    this.container = container;
    this.canvasElement = canvasElement;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.setupEvents();
  }

  private setupEvents(): void {
    const element = this.canvasElement;

    element.addEventListener('pointerdown', (e) => {
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

      this.clampBounds();
    });

    const stopDrag = () => {
      this.isDragging = false;
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
      this.zoomAt(e.clientX, e.clientY, zoomFactor);
    }, { passive: false });

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

    this.clampBounds();
  }

  public clampBounds(): void {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const scale = this.container.scale.x;
    const scaledWorldWidth = this.worldWidth * scale;
    const scaledWorldHeight = this.worldHeight * scale;

    // По Х
    if (scaledWorldWidth <= screenWidth) {
      this.container.x = (screenWidth - scaledWorldWidth) / 2;
    } else {
      const minX = screenWidth - scaledWorldWidth;
      this.container.x = Math.min(Math.max(this.container.x, minX), 0);
    }

    // По Y
    if (scaledWorldHeight <= screenHeight) {
      this.container.y = (screenHeight - scaledWorldHeight) / 2;
    } else {
      const minY = screenHeight - scaledWorldHeight;
      this.container.y = Math.min(Math.max(this.container.y, minY), 0);
    }
  }

  // Заполнение всего экрана без черных полей
  public fillScreen(screenWidth: number, screenHeight: number): void {
    const scaleX = screenWidth / this.worldWidth;
    const scaleY = screenHeight / this.worldHeight;
    
    // Берем бóльший масштаб, чтобы закрасить весь холст без остатка
    const scale = Math.max(scaleX, scaleY);
    this.container.scale.set(scale);
    
    // Вычисляем минимальный допустимый зум, чтобы нельзя было «ужать» карту меньше размера экрана
    this.minScale = Math.max(scaleX, scaleY);

    this.clampBounds();
  }
}
