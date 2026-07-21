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
        resizeTo: window, // 💡 Автоматически растягивает рендерер под размеры окна браузера/смартфона
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
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    appContainer.appendChild(canvas);

    const WORLD_WIDTH = 24000;
    const WORLD_HEIGHT = 24000;
    
    // 💡 Делаем океан 28% от ширины мира -- береговая линия уйдет левее, а суши справа станет гораздо больше!
    const COASTAL_RATIO = 0.28;

    // 1. Карта мира
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, COASTAL_RATIO);
    app.stage.addChild(worldMap.container);

    // 2. Камера
    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Подгоняем камеру под текущий экран смартфона без черных рамок
    if (typeof camera.fillScreen === 'function') {
      camera.fillScreen(window.innerWidth, window.innerHeight);
    }

    // 3. Освещение и UI отладки
    const lightingController = new LightingController(worldMap.container, worldMap.waterManager);
    new TimeDebugUI(lightingController);

    // 4. Игровой цикл
    app.ticker.add((ticker) => {
      const deltaSeconds = ticker.deltaTime / 60;
      worldMap.update(deltaSeconds);
    });

    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      app.renderer.resize(newWidth, newHeight);
      if (typeof camera.fillScreen === 'function') {
        camera.fillScreen(newWidth, newHeight);
      }
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
