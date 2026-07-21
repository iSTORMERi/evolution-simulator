import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';
import { LightingController } from './world/LightingController';
import { TimeDebugUI } from './ui/TimeDebugUI';

// Храним инстанс, чтобы корректно его очищать при перезагрузке/HMR
let currentApp: PIXI.Application | null = null;

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Очищаем старое приложение и освобождаем WebGL-контекст
  if (currentApp) {
    try {
      currentApp.destroy(true, { children: true, texture: true });
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
    currentApp = null;
  }

  appContainer.innerHTML = '';

  const app = new PIXI.Application();
  currentApp = app;

  try {
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x0d1117,
      resolution: 1, // Ограничение Retina для экономии ОЗУ на мобайле
      autoDensity: false,
      preference: 'webgl',
    });

    const canvas = app.canvas;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';

    appContainer.appendChild(canvas);

    // Размеры мира для мобильных
    const WORLD_WIDTH = 4000;
    const WORLD_HEIGHT = 4000;
    const COASTAL_RATIO = 0.28;

    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, COASTAL_RATIO);
    app.stage.addChild(worldMap.container);

    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    if (typeof camera.fillScreen === 'function') {
      camera.fillScreen(window.innerWidth, window.innerHeight);
    }

    const lightingController = new LightingController(worldMap.container, worldMap.waterManager);
    new TimeDebugUI(lightingController);

    app.ticker.add((ticker) => {
      const deltaSeconds = ticker.deltaTime / 60;
      worldMap.update(deltaSeconds);
    });

  } catch (err) {
    console.error('Init error:', err);
  }
}

initApp();
