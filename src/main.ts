import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';
import { LightingController } from './world/LightingController';
import { TimeDebugUI } from './ui/TimeDebugUI';

console.log('Evolution Simulator Initializing...');

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = '';

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const app = new PIXI.Application();

  try {
    if ('init' in app && typeof app.init === 'function') {
      await app.init({
        width: screenWidth,
        height: screenHeight,
        backgroundColor: 0x0d1117,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    } else {
      // @ts-ignore
      app.renderer = PIXI.autoDetectRenderer({
        width: screenWidth,
        height: screenHeight,
        backgroundColor: 0x0d1117,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    }

    const canvas = (app.canvas || app.view) as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    appContainer.appendChild(canvas);

    const WORLD_WIDTH = 24000;
    const WORLD_HEIGHT = 24000;
    const COASTAL_RATIO = 0.50;

    // 1. Карта мира (внутри уже инициализирован WaterManager)
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, COASTAL_RATIO);
    app.stage.addChild(worldMap.container);

    // 2. Камера
    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    camera.fillScreen(screenWidth, screenHeight);

    // 3. Освещение и UI отладки
    // Передаем worldMap.waterManager для управления освещением водных эффектов
    const lightingController = new LightingController(worldMap.container, worldMap.waterManager);
    new TimeDebugUI(lightingController);

    // 4. Игровой цикл
    app.ticker.add((ticker) => {
      const deltaSeconds = ticker.deltaTime / 60;
      // Обновляем всю динамику мира, включая воду
      worldMap.update(deltaSeconds);
    });

    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      app.renderer.resize(newWidth, newHeight);
      camera.fillScreen(newWidth, newHeight);
    });

  } catch (err) {
    appContainer.innerHTML = `
      <div style="color: #ff5555; padding: 20px; font-family: monospace;">
        <h3>Render Error:</h3>
        <p>${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
}

initApp();
