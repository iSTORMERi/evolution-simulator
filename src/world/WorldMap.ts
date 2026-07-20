import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_COLOR } from './zoneConfig';

export class WorldMap {
  public container: PIXI.Container;
  private width: number;
  private height: number;
  private oceanWidthRatio: number;

  constructor(width: number, height: number, oceanWidthRatio: number = 0.50) {
    this.container = new PIXI.Container();
    this.width = width;
    this.height = height;
    this.oceanWidthRatio = oceanWidthRatio;

    this.renderMap();
  }

  // Расчет плавной береговой линии
  private getCoastlineX(y: number, baseOceanWidth: number): number {
    const wave1 = Math.sin(y * 0.0002) * 600;
    const wave2 = Math.cos(y * 0.0006) * 300;
    const wave3 = Math.sin(y * 0.0015) * 120;

    return baseOceanWidth + wave1 + wave2 + wave3;
  }

  // Вспомогательный метод для конвертации hex (0x123456) в RGB
  private hexToRgb(hex: number): { r: number; g: number; b: number } {
    return {
      r: (hex >> 16) & 255,
      g: (hex >> 8) & 255,
      b: hex & 255,
    };
  }

  // Функция получения цвета океана в зависимости от расстояния до берега (от 0.0 до 1.0)
  private getOceanColor(distRatio: number): { r: number; g: number; b: number } {
    // distRatio = 0.0 (глубокий океан слева), distRatio = 1.0 (берег справа)
    const zones = OCEAN_ZONES_CONFIG;
    let accumulatedWidth = 0;

    for (let i = 0; i < zones.length; i++) {
      const zoneStart = accumulatedWidth;
      const zoneEnd = accumulatedWidth + zones[i].widthRatio;

      if (distRatio >= zoneStart && distRatio <= zoneEnd) {
        const localRatio = (distRatio - zoneStart) / zones[i].widthRatio;
        const currentColor = this.hexToRgb(zones[i].color);

        // Если есть следующая зона -- плавно интерполируем к ней
        if (i < zones.length - 1 && localRatio > 0.5) {
          const nextColor = this.hexToRgb(zones[i + 1].color);
          const blendFactor = (localRatio - 0.5) * 2; // 0.0 -> 1.0 на второй половине зоны
          return {
            r: Math.round(currentColor.r + (nextColor.r - currentColor.r) * blendFactor),
            g: Math.round(currentColor.g + (nextColor.g - currentColor.g) * blendFactor),
            b: Math.round(currentColor.b + (nextColor.b - currentColor.b) * blendFactor),
          };
        } else if (i > 0 && localRatio <= 0.5) {
          const prevColor = this.hexToRgb(zones[i - 1].color);
          const blendFactor = (0.5 - localRatio) * 2;
          return {
            r: Math.round(currentColor.r + (prevColor.r - currentColor.r) * blendFactor),
            g: Math.round(currentColor.g + (prevColor.g - currentColor.g) * blendFactor),
            b: Math.round(currentColor.b + (prevColor.b - currentColor.b) * blendFactor),
          };
        }

        return currentColor;
      }
      accumulatedWidth = zoneEnd;
    }

    return this.hexToRgb(zones[zones.length - 1].color);
  }

  private renderMap(): void {
    this.container.removeChildren();

    const baseOceanWidth = this.width * this.oceanWidthRatio;

    // Генерация растровой текстуры высокого качества
    const canvas = document.createElement('canvas');
    const scaleFactor = 0.15; // Масштабирование Canvas для высокой производительности при 24000px
    canvas.width = Math.round(this.width * scaleFactor);
    canvas.height = Math.round(this.height * scaleFactor);
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const renderWidth = canvas.width;
    const renderHeight = canvas.height;
    const imgData = ctx.createImageData(renderWidth, renderHeight);
    const data = imgData.data;

    const landRgb = this.hexToRgb(LAND_COLOR);

    // Отрисовка построчно с расчетом искривления изобат
    for (let py = 0; py < renderHeight; py++) {
      const worldY = py / scaleFactor;
      const coastX = this.getCoastlineX(worldY, baseOceanWidth);
      const coastRenderX = coastX * scaleFactor;

      for (let px = 0; px < renderWidth; px++) {
        const index = (py * renderWidth + px) * 4;

        if (px >= coastRenderX) {
          // Суша
          data[index] = landRgb.r;
          data[index + 1] = landRgb.g;
          data[index + 2] = landRgb.b;
          data[index + 3] = 255;
        } else {
          // Океан: рассчитываем относительное расстояние от левого края до изогнутого берега
          const distRatio = Math.min(Math.max(px / coastRenderX, 0), 1);
          const oceanRgb = this.getOceanColor(distRatio);

          data[index] = oceanRgb.r;
          data[index + 1] = oceanRgb.g;
          data[index + 2] = oceanRgb.b;
          data[index + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = PIXI.Texture.from(canvas);
    const sprite = new PIXI.Sprite(texture);
    sprite.width = this.width;
    sprite.height = this.height;

    this.container.addChild(sprite);
  }
}
