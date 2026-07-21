import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';
import { LightingController } from './world/LightingController';
import { TimeDebugUI } from './ui/TimeDebugUI';

let currentApp: PIXI.Application | null = null;

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Очистка предыдущего инстанса при перезагрузке
  if (currentApp) {
    try {
      currentApp.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
    currentApp = null;
  }

  appContainer.innerHTML = '';

  const app = new PIXI.Application();
  currentApp = app;

  try {
    // Используем реальные размеры окна браузера
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    await app.init({
      width: viewportWidth,
      height: viewportHeight,
      backgroundColor: 0x0d1117,
      resolution: Math.min(window.devicePixelRatio || 1, 2), // Безопасное ограничение DPR для iOS
      autoDensity: true,
      preference: 'webgl',
    });

    const canvas = app.canvas;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.touchAction = 'none';

    appContainer.appendChild(canvas);

    // Фиксированные параметры мира
    const WORLD_WIDTH = 8000;  // Оптимальный размер для мобильных GPU
    const WORLD_HEIGHT = 8000;
    const COASTAL_RATIO = 0.28;

    // 1. Создание мира
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, COASTAL_RATIO);
    app.stage.addChild(worldMap.container);

    // 2. Инициализация камеры с правильным центром
    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Центрируем камеру строго по середине генерации
    worldMap.container.position.set(viewportWidth / 2, viewportHeight / 2);
    worldMap.container.pivot.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    if (typeof camera.fillScreen === 'function') {
      camera.fillScreen(viewportWidth, viewportHeight);
    }

    // 3. Освещение и UI
    const lightingController = new LightingController(worldMap.container, worldMap.waterManager);
    new TimeDebugUI(lightingController);

    // 4. Главный игровой цикл
    app.ticker.add((ticker) => {
      const deltaSeconds = ticker.deltaTime / 60;
      worldMap.update(deltaSeconds);
    });

    // Обработка поворота экрана / ресайза
    window.addEventListener('resize', () => {
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      app.renderer.resize(newW, newH);
      
      worldMap.container.position.set(newW / 2, newH / 2);
      
      if (typeof camera.fillScreen === 'function') {
        camera.fillScreen(newW, newH);
      }
    });

  } catch (err) {
    console.error('Initialization failed:', err);
  }
}

initApp();
