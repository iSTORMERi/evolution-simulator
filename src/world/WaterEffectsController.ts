import * as PIXI from 'pixi.js';

export class WaterEffectsController {
  public container: PIXI.Container;
  
  private causticsGraphics: PIXI.Graphics;
  private bioluminescenceGraphics: PIXI.Graphics;
  private foamGraphics: PIXI.Graphics;

  private mapWidth: number;
  private mapHeight: number;
  private coastalRatio: number; // Граница мелководья

  private animTime = 0;
  private causticsAlpha = 1.0;
  private biolumAlpha = 0.0;

  constructor(mapWidth: number, mapHeight: number, coastalRatio: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.coastalRatio = coastalRatio;

    this.container = new PIXI.Container();

    this.causticsGraphics = new PIXI.Graphics();
    this.bioluminescenceGraphics = new PIXI.Graphics();
    this.foamGraphics = new PIXI.Graphics();

    // Слои анимации воды
    this.container.addChild(this.causticsGraphics);
    this.container.addChild(this.bioluminescenceGraphics);
    this.container.addChild(this.foamGraphics);

    this.drawWaterOverlays();
  }

  /**
   * Генерация базовой структуры оверлеев каустики и свечения
   */
  private drawWaterOverlays(): void {
    const coastX = this.mapWidth * this.coastalRatio;

    // === 1. Солнечная каустика (Сетка преломления света на мелководье) ===
    this.causticsGraphics.clear();
    this.causticsGraphics.beginFill(0xffffff, 0.18);
    
    // Рисуем сетчатый узор из полигонов на мелководной полосе
    const causticsWidth = coastX * 0.8;
    const step = 200;
    for (let x = coastX - causticsWidth; x < coastX; x += step) {
      for (let y = 0; y < this.mapHeight; y += step) {
        if ((Math.floor(x / step) + Math.floor(y / step)) % 2 === 0) {
          this.causticsGraphics.drawPolygon([
            x, y,
            x + step * 0.7, y + step * 0.3,
            x + step * 0.9, y + step * 0.8,
            x + step * 0.2, y + step * 0.9,
          ]);
        }
      }
    }
    this.causticsGraphics.endFill();

    // === 2. Ночная биолюминесценция планктона (Вдоль прибойной зоны) ===
    this.bioluminescenceGraphics.clear();
    this.bioluminescenceGraphics.beginFill(0x00f3ff, 0.35); // Неоново-бирюзовый
    const bioZoneWidth = 180;
    this.bioluminescenceGraphics.drawRect(coastX - bioZoneWidth, 0, bioZoneWidth, this.mapHeight);
    this.bioluminescenceGraphics.endFill();

    // === 3. Береговая пена прибоя ===
    this.foamGraphics.clear();
    this.foamGraphics.beginFill(0xffffff, 0.4);
    this.foamGraphics.drawRect(coastX - 35, 0, 35, this.mapHeight);
    this.foamGraphics.endFill();
  }

  /**
   * Обновление прозрачности и цвета эффектов в зависимости от времени суток
   */
  public updateTimeState(hours: number): void {
    // === Дневная солнечная каустика ===
    if (hours >= 8.5 && hours <= 17.0) {
      // Полный яркий день
      this.causticsAlpha = 1.0;
      this.causticsGraphics.tint = 0xffffff;
    } else if ((hours >= 6.0 && hours < 8.5) || (hours > 17.0 && hours <= 19.5)) {
      // Рассвет / Закат (Каустика приобретает золотисто-оранжевый оттенок и затухает)
      this.causticsAlpha = 0.5;
      this.causticsGraphics.tint = 0xffa055;
    } else {
      // Ночь -- солнечной сетки нет
      this.causticsAlpha = 0.0;
    }

    // === Ночная биолюминесценция планктона ===
    if (hours >= 21.0 || hours <= 4.5) {
      // Ночь -- яркое неоновое свечение
      this.biolumAlpha = 0.85;
    } else if (hours > 4.5 && hours < 6.5) {
      // Утреннее угасание
      const t = (6.5 - hours) / 2.0;
      this.biolumAlpha = Math.max(0, t * 0.85);
    } else if (hours > 19.0 && hours < 21.0) {
      // Вечернее разгорание
      const t = (hours - 19.0) / 2.0;
      this.biolumAlpha = Math.min(0.85, t * 0.85);
    } else {
      // Днём планктон не светится
      this.biolumAlpha = 0.0;
    }

    this.causticsGraphics.alpha = this.causticsAlpha;
  }

  /**
   * Кадровый апдейт анимации движения волн и каустики
   */
  public update(deltaSeconds: number): void {
    this.animTime += deltaSeconds;

    // 1. Движение каустики (плавное покачивание сетки света)
    if (this.causticsAlpha > 0) {
      this.causticsGraphics.x = Math.sin(this.animTime * 0.8) * 15;
      this.causticsGraphics.y = Math.cos(this.animTime * 0.5) * 10;
    }

    // 2. Пульсация ночного биолюминесцентного планктона
    if (this.biolumAlpha > 0) {
      const pulse = Math.sin(this.animTime * 2.5) * 0.15;
      this.bioluminescenceGraphics.alpha = Math.max(0, this.biolumAlpha + pulse);
      this.bioluminescenceGraphics.x = Math.sin(this.animTime * 1.2) * 8;
    } else {
      this.bioluminescenceGraphics.alpha = 0;
    }

    // 3. Анимация наката пены прибоя на берег (ритм каждые ~3.5 секунды)
    const foamWave = (Math.sin(this.animTime * 1.8) + 1) / 2; // [0..1]
    this.foamGraphics.x = foamWave * 25;
    this.foamGraphics.alpha = 0.25 + foamWave * 0.35;
  }
}
