import * as PIXI from 'pixi.js';
import { OCEAN_ZONES_CONFIG, LAND_COLOR } from './zoneConfig';

export class WorldMap {
  public container: PIXI.Container;
  private width: number;
  private height: number;
  private oceanWidthRatio: number;

  constructor(width: number, height: number, oceanWidthRatio: number = 0.35) {
    this.container = new PIXI.Container();
    this.width = width;
    this.height = height;
    this.oceanWidthRatio = oceanWidthRatio;

    this.renderMap();
  }

  // Функция для расчета плавного изгиба береговой линии в любой точке Y
  private getCoastlineX(y: number, baseOceanWidth: number): number {
    // Несколько синусоид с разной частотой дают реалистичный естественный рельеф
    const wave1 = Math.sin(y * 0.0003) * 350;
    const wave2 = Math.cos(y * 0.0008) * 180;
    const wave3 = Math.sin(y * 0.002) * 60;

    return baseOceanWidth + wave1 + wave2 + wave3;
  }

  private renderMap(): void {
    this.container.removeChildren();

    const baseOceanWidth = this.width * this.oceanWidthRatio;

    // Исполнение через Canvas API для создания идеального градиента и сглаживания
    const canvas = document.createElement('canvas');
    // Используем оптимальное разрешение для генерации текстуры
    const scaleFactor = 0.25; 
    canvas.width = this.width * scaleFactor;
    canvas.height = this.height * scaleFactor;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const renderWidth = canvas.width;
    const renderHeight = canvas.height;

    // 1. Создаем плавный океанический градиент слева направо
    const oceanGradient = ctx.createLinearGradient(0, 0, baseOceanWidth * scaleFactor, 0);

    // Добавляем цвета зон с плавным переходом
    let currentPos = 0;
    OCEAN_ZONES_CONFIG.forEach((zone, index) => {
      const hexColor = '#' + zone.color.toString(16).padStart(6, '0');
      oceanGradient.addColorStop(Math.min(currentPos, 1), hexColor);
      currentPos += zone.widthRatio;
    });

    // 2. Заливаем океан градиентом
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    // 3. Рисуем сушу с изогнутым берегом
    const landColorHex = '#' + LAND_COLOR.toString(16).padStart(6, '0');
    ctx.fillStyle = landColorHex;

    ctx.beginPath();
    // Стартуем с верхнего правого угла суши
    ctx.moveTo(renderWidth, 0);

    // Проходим по всей высоте с шагом и строим кривую берега
    const step = 2; // Шаг сэмплинга по Y
    for (let y = 0; y <= renderHeight; y += step) {
      const worldY = y / scaleFactor;
      const coastX = this.getCoastlineX(worldY, baseOceanWidth);
      ctx.lineTo(coastX * scaleFactor, y);
    }

    // Замыкаем контур по правому и нижнему краю
    ctx.lineTo(renderWidth, renderHeight);
    ctx.closePath();
    ctx.fill();

    // 4. Переносим готовый рисунок в PixiJS Текстуру
    const texture = PIXI.Texture.from(canvas);
    const sprite = new PIXI.Sprite(texture);
    sprite.width = this.width;
    sprite.height = this.height;

    this.container.addChild(sprite);
  }
}
