import * as PIXI from 'pixi.js';

export class CameraController {
  private container: PIXI.Container;
  private canvasElement: HTMLElement;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private containerStart = { x: 0, y: 0 };

  // Размеры логического мира
  private worldWidth: number = 0;
  private worldHeight: number = 0;

  // Расширенные границы масштаба (от глубокого отдаления до сильного приближения)
  public minScale = 0.05;
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

    // === Перетаскивание мышью / одним пальцем ===
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

    // === Колесо мыши (Zoom) ===
    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
      this.zoomAt(e.clientX, e.clientY, zoomFactor);
    }, { passive: false });

    // === Multi-touch (Pinch-to-zoom) ===
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

  // Запрещает выезд за пределы мира
  private clampBounds(): void {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const scale = this.container.scale.x;
    const scaledWorldWidth = this.worldWidth * scale;
    const scaledWorldHeight = this.worldHeight * scale;

    // Ограничение по X
    if (scaledWorldWidth <= screenWidth) {
      // Если карта меньше экрана по ширине -- центрируем
      this.container.x = (screenWidth - scaledWorldWidth) / 2;
    } else {
      // Зажимаем между левым и правым краем
      const minX = screenWidth - scaledWorldWidth;
      const maxX = 0;
      this.container.x = Math.min(Math.max(this.container.x, minX), maxX);
    }

    // Ограничение по Y
    if (scaledWorldHeight <= screenHeight) {
      // Если карта меньше экрана по высоте -- центрируем
      this.container.y = (screenHeight - scaledWorldHeight) / 2;
    } else {
      // Зажимаем между верхним и нижним краем
      const minY = screenHeight - scaledWorldHeight;
      const maxY = 0;
      this.container.y = Math.min(Math.max(this.container.y, minY), maxY);
    }
  }

  public fitToView(screenWidth: number, screenHeight: number): void {
    const scale = Math.max(screenWidth / this.worldWidth, screenHeight / this.worldHeight);
    this.container.scale.set(scale);
    this.clampBounds();
  }
}
