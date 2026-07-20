import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';

console.log('Evolution Simulator Initialized');

// Получаем существующий контейнер из HTML
const appContainer = document.getElementById('app');

if (appContainer) {
  // Очищаем приветственный текст
  appContainer.innerHTML = '';

  // Инициализируем приложение Pixi.js
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  // Вставляем canvas Pixi.js в наш appContainer
  appContainer.appendChild(app.view as HTMLCanvasElement);

  // Задаём базовые размеры виртуального мира
  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 3000;

  // Создаём карту (65% океан слева, 35% суша справа)
  const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, 0.65);
  app.stage.addChild(worldMap.container);

  // Обработка изменения размера окна
  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });
}
