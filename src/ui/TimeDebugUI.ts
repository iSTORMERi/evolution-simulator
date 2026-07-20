import { LightingController } from '../world/LightingController';

export class TimeDebugUI {
  private lightingController: LightingController;
  private container: HTMLDivElement;
  private timeSlider: HTMLInputElement;
  private timeDisplay: HTMLDivElement;
  private playButton: HTMLButtonElement;

  private isPlaying = false;
  private currentTimeInHours = 12.0; // По умолчанию полдень
  private animFrameId: number | null = null;

  constructor(lightingController: LightingController) {
    this.lightingController = lightingController;

    // Создаём верстку виджета
    this.container = document.createElement('div');
    this.setupStyles();

    this.container.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 6px; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
        <span>🕒 Время суток</span>
        <span id="time-text" style="color: #58a6ff;">12:00 (День)</span>
      </div>
      <input type="range" id="time-slider" min="0" max="24" step="0.1" value="12" style="width: 100%; cursor: pointer;" />
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <button id="play-btn" style="flex: 1; padding: 6px; background: #238636; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
          ▶ Авто-прокрутка
        </button>
      </div>
    `;

    document.body.appendChild(this.container);

    this.timeSlider = this.container.querySelector('#time-slider') as HTMLInputElement;
    this.timeDisplay = this.container.querySelector('#time-text') as HTMLDivElement;
    this.playButton = this.container.querySelector('#play-btn') as HTMLButtonElement;

    this.bindEvents();
    this.update(this.currentTimeInHours);
  }

  private setupStyles(): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(13, 17, 23, 0.85)',
      backdropFilter: 'blur(8px)',
      color: '#c9d1d9',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      zIndex: '1000',
      minWidth: '280px',
      maxWidth: '90vw',
      border: '1px solid #30363d',
    });
  }

  private bindEvents(): void {
    // Ручная прокрутка ползунка
    this.timeSlider.addEventListener('input', () => {
      this.isPlaying = false;
      this.playButton.textContent = '▶ Авто-прокрутка';
      this.playButton.style.backgroundColor = '#238636';

      this.currentTimeInHours = parseFloat(this.timeSlider.value);
      this.update(this.currentTimeInHours);
    });

    // Кнопка Play/Pause
    this.playButton.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      if (this.isPlaying) {
        this.playButton.textContent = '⏸ Пауза';
        this.playButton.style.backgroundColor = '#da3633';
        this.startLoop();
      } else {
        this.playButton.textContent = '▶ Авто-прокрутка';
        this.playButton.style.backgroundColor = '#238636';
      }
    });
  }

  private startLoop(): void {
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!this.isPlaying) return;

      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;

      // 1 игровая минута = за пару секунд real-time (полный цикл 24ч занимает ~24 сек)
      this.currentTimeInHours = (this.currentTimeInHours + deltaSeconds * 1.0) % 24;
      this.timeSlider.value = this.currentTimeInHours.toString();
      this.update(this.currentTimeInHours);

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private update(hours: number): void {
    const state = this.lightingController.setTime(hours);
    this.timeDisplay.textContent = `${state.formattedTime} (${state.phaseName})`;
  }

  public destroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.container.parentNode) this.container.parentNode.removeChild(this.container);
  }
}
