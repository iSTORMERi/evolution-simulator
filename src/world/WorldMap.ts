import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_COLOR } from './zoneConfig';
import { WaterManager } from './water/WaterManager';
import { DeltaGenerator } from './DeltaGenerator';

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface ColorStop {
  pos: number;
  color: RGBColor;
}

export class WorldMap {
  public container: PIXI.Container;
  public waterManager: WaterManager;
  public deltaGenerator: DeltaGenerator;

  private width: number;
  private height: number;
  private oceanWidthRatio: number;

  constructor(width: number, height: number, oceanWidthRatio: number = 0.28) {
    this.container = new PIXI.Container();
    this.width = width;
    this.height = height;
    this.oceanWidthRatio = oceanWidthRatio;

    const baseOceanWidth = this.width * this.oceanWidthRatio;

    // Увеличены пропорции размаха веера (spreadY: 6800) и глубины истока
    this.deltaGenerator = new DeltaGenerator({
      originX: baseOceanWidth + 5500, 
      originY: this.height * 0.65, 
      spreadY: 6800,              
      numBranches: 6,             // 6 рукавов для пышности
      getCoastlineX: (y: number) => this.getCoastlineX(y, baseOceanWidth),
    });

    this.renderMap();

    this.waterManager = new WaterManager(this.width, this.height, this.oceanWidthRatio);
    this.container.addChild(this.waterManager.container);
  }

  private getCoastlineX(y: number, baseOceanWidth: number): number {
    const wave1 = Math.sin(y * 0.0002) * 600;
    const wave2 = Math.cos(y * 0.0006) * 300;
    const wave3 = Math.sin(y * 0.0015) * 120;

    return baseOceanWidth + wave1 + wave2 + wave3;
  }

  private hexToRgb(hex: number): RGBColor {
    return {
      r: (hex >> 16) & 255,
      g: (hex >> 8) & 255,
      b: hex & 255,
    };
  }

  private getOceanColor(distRatio: number): RGBColor {
    const zones = OCEAN_ZONES_CONFIG;

    if (isNaN(distRatio) || distRatio <= 0) return this.hexToRgb(zones[0].color);
    if (distRatio >= 1) return this.hexToRgb(zones[zones.length - 1].color);

    let accumulatedWidth = 0;
    const stops: ColorStop[] = [];

    for (let i = 0; i < zones.length; i++) {
      const zoneCenter = accumulatedWidth + zones[i].widthRatio / 2;
      stops.push({
        pos: zoneCenter,
        color: this.hexToRgb(zones[i].color),
      });
      accumulatedWidth += zones[i].widthRatio;
    }

    if (distRatio <= stops[0].pos) return stops[0].color;
    if (distRatio >= stops[stops.length - 1].pos) return stops[stops.length - 1].color;

    for (let i = 0; i < stops.length - 1; i++) {
      const leftStop = stops[i];
      const rightStop = stops[i + 1];

      if (distRatio >= leftStop.pos && distRatio <= rightStop.pos) {
        const factor = (distRatio - leftStop.pos) / (rightStop.pos - leftStop.pos);
        const smoothFactor = factor * factor * (3 - 2 * factor);

        return {
          r: Math.round(leftStop.color.r + (rightStop.color.r - leftStop.color.r) * smoothFactor),
          g: Math.round(leftStop.color.g + (rightStop.color.g - leftStop.color.g) * smoothFactor),
          b: Math.round(leftStop.color.b + (rightStop.color.b - leftStop.color.b) * smoothFactor),
        };
      }
    }

    return stops[stops.length - 1].color;
  }

  private renderMap(): void {
    const baseOceanWidth = this.width * this.oceanWidthRatio;

    const canvas = document.createElement('canvas');
    const scaleFactor = 0.15;
    canvas.width = Math.round(this.width * scaleFactor);
    canvas.height = Math.round(this.height * scaleFactor);
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const renderWidth = canvas.width;
    const renderHeight = canvas.height;
    const imgData = ctx.createImageData(renderWidth, renderHeight);
    const data = imgData.data;

    const landRgb = this.hexToRgb(LAND_COLOR);

    for (let py = 0; py < renderHeight; py++) {
      const worldY = py / scaleFactor;
      const coastX = this.getCoastlineX(worldY, baseOceanWidth);
      const coastRenderX = Math.max(1, coastX * scaleFactor); // Защита от <= 0

      for (let px = 0; px < renderWidth; px++) {
        const worldX = px / scaleFactor;
        const isDefaultOcean = px < coastRenderX;

        const deltaInfo = this.deltaGenerator.evaluate(worldX, worldY, isDefaultOcean);
        const index = (py * renderWidth + px) * 4;

        // Рассчитываем цвет океана для текущего X с безопасным делением
        const distRatio = Math.min(Math.max(px / coastRenderX, 0), 1);
        const oceanRgb = this.getOceanColor(distRatio);

        if (deltaInfo) {
          const deltaRgb = this.hexToRgb(deltaInfo.color);
          const alpha = Math.max(0, Math.min(1, deltaInfo.blendAlpha ?? 1.0));

          if (alpha >= 0.99 || !isDefaultOcean) {
            // Плотная суша или центр реки
            data[index] = deltaRgb.r;
            data[index + 1] = deltaRgb.g;
            data[index + 2] = deltaRgb.b;
          } else {
            // ГРАДИЕНТНОЕ СМЕШИВАНИЕ: Речная вода/взвесь + цвет океана
            data[index]     = Math.round(deltaRgb.r * alpha + oceanRgb.r * (1 - alpha));
            data[index + 1] = Math.round(deltaRgb.g * alpha + oceanRgb.g * (1 - alpha));
            data[index + 2] = Math.round(deltaRgb.b * alpha + oceanRgb.b * (1 - alpha));
          }
          data[index + 3] = 255;

        } else if (!isDefaultOcean) {
          // Обычная суша
          data[index] = landRgb.r;
          data[index + 1] = landRgb.g;
          data[index + 2] = landRgb.b;
          data[index + 3] = 255;

        } else {
          // Чистый океан
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

  public update(deltaSeconds: number): void {
    if (this.waterManager) {
      this.waterManager.update(deltaSeconds);
    }
  }

  public updateTimeState(hours: number): void {
    if (this.waterManager) {
      this.waterManager.updateTimeState(hours);
    }
  }
}
