import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';

console.log('Evolution Simulator Initializing...');

const appContainer = document.getElementById('app');

if (appContainer) {
  appContainer.innerHTML = '';

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Создаем приложение Pixi
  const app = new PIXI.Application({
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  // Вставляем холст
  const canvas = app.view as HTMLCanvasElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  appContainer.appendChild(canvas);

  // Размеры логической карты
  const WORLD_WIDTH = 3000;
  const WORLD_HEIGHT = 1500;

  // Создаем карту мира
  const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, 0.65);
  
  // Вписываем карту в экран смартфона/экрана
  worldMap.fitToScreen(screenWidth, screenHeight);
  
  app.stage.addChild(worldMap.container);

  // Ресайз при повороте экрана или изменении размера окна
  window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    app.renderer.resize(newWidth, newHeight);
    worldMap.fitToScreen(newWidth, newHeight);
  });
}
