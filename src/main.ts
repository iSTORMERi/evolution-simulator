// src/main.ts

import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';
import { LightingController } from './world/LightingController';
import { TimeDebugUI } from './ui/TimeDebugUI';

let currentApp: PIXI.Application | null = null;
let resizeHandler: (() => void) | null = null;

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Очистка предыдущего слушателя событий ресайза
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  // Очистка предыдущего инстанса приложения PixiJS v8
  if (currentApp) {
    try {
      currentApp.destroy({ removeView: true });
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
    currentApp = null;
  }

  appContainer.innerHTML = '';

  const app = new PIXI.Application();
  currentApp = app;

  try {
    await app.init({
      resizeTo: window,
      backgroundColor: 0x0d1117,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
    });

    const canvas = app.canvas;
    
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';

    appContainer.appendChild(canvas);

    // Размеры игрового мира
    const WORLD_WIDTH = 8000;  
    const WORLD_HEIGHT = 8000;

    // 1. Создание карты мира
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT);
    app.stage.addChild(worldMap.container);

    // 2. Инициализация камеры
    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    
    if (typeof camera.fillScreen === 'function') {
      camera.fillScreen(app.screen.width, app.screen.height);
    }

    // 3. Инициализация освещения и UI управления временем
    const lightingController = new LightingController(worldMap.container);
    new TimeDebugUI(lightingController);

    // 4. Главный игровой цикл
    app.ticker.add((ticker) => {
      // Честное время кадра в секундах (работает корректно на 60Hz, 120Hz и 144Hz)
      const deltaSeconds = ticker.deltaMS / 1000;
      
      // Обновляем физику и анимации воды
      worldMap.update(deltaSeconds);

      // Синхронизируем состояние дня/ночи на карте, если у LightingController есть время
      if (typeof (lightingController as any).getCurrentHours === 'function') {
        worldMap.updateTimeState((lightingController as any).getCurrentHours());
      }
    });

    // Обработка изменения размера окна с безопасной очисткой
    resizeHandler = () => {
      if (typeof camera.fillScreen === 'function') {
        camera.fillScreen(app.screen.width, app.screen.height);
      }
    };
    window.addEventListener('resize', resizeHandler);

  } catch (err) {
    console.error('Initialization failed:', err);
  }
}

initApp();
