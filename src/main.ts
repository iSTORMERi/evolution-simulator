import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';
import { LightingController } from './world/LightingController';
import { TimeDebugUI } from './ui/TimeDebugUI';

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const app = new PIXI.Application();

  try {
    // 1. Инициализируем Pixi с безопасным масштабом для мобильных
    await app.init({
      resizeTo: window,
      backgroundColor: 0x0d1117,
      resolution: 1, // На мобильных зажимаем разрешение до 1, чтобы не перегружать GPU
      autoDensity: true,
      preference: 'webgl',
    });

    appContainer.appendChild(app.canvas);

    // 2. Временно уменьшаем размер мира до 4000x4000 для теста GPU
    const WORLD_WIDTH = 4000;
    const WORLD_HEIGHT = 4000;
    const COASTAL_RATIO = 0.28;

    // 3. Карта мира
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, COASTAL_RATIO);
    app.stage.addChild(worldMap.container);

    // 4. Камера
    const camera = new CameraController(worldMap.container, app.canvas, WORLD_WIDTH, WORLD_HEIGHT);
    if (typeof camera.fillScreen === 'function') {
      camera.fillScreen(window.innerWidth, window.innerHeight);
    }

    // 5. Освещение и UI
    const lightingController = new LightingController(worldMap.container, worldMap.waterManager);
    new TimeDebugUI(lightingController);

    // 6. Игровой цикл
    app.ticker.add((ticker) => {
      const deltaSeconds = ticker.deltaTime / 60;
      worldMap.update(deltaSeconds);
    });

  } catch (err) {
    appContainer.innerHTML = `
      <div style="color: red; padding: 20px; font-family: monospace;">
        Failed to start WebGL: ${err}
      </div>
    `;
  }
}

initApp();
