// src/entities/SurfacePlankton.ts

export class SurfacePlankton {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public scale: number;
  public opacity: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    // Разброс размеров и прозрачности для естественности
    this.scale = 0.8 + Math.random() * 0.6;
    this.opacity = 0.3 + Math.random() * 0.3;
  }

  /**
   * Обновление позиции на основе вектора течений
   */
  public update(currentVx: number, currentVy: number, dt: number, worldWidth: number, worldHeight: number): void {
    // Небольшой хаотичный шум (диффузия)
    const jitterX = (Math.random() - 0.5) * 5;
    const jitterY = (Math.random() - 0.5) * 5;

    this.vx = currentVx + jitterX;
    this.vy = currentVy + jitterY;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Зацикливание при выходе за границы мира
    if (this.x < 0) this.x = worldWidth;
    if (this.x > worldWidth) this.x = 0;
    if (this.y < 0) this.y = worldHeight;
    if (this.y > worldHeight) this.y = 0;
  }
}
