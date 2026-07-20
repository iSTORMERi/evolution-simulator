import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';

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
    canvas.style.touchAction = 'none'; // Отключаем стандартные жесты браузера Safari
    appContainer.appendChild(canvas);

    const WORLD_WIDTH = 3000;
    const WORLD_HEIGHT = 1500;

    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, 0.65);
    app.stage.addChild(worldMap.container);

    // Подключаем управление камерой
    const camera = new CameraController(worldMap.container, canvas);
    
    // Заполняем экран картой, чтобы не было мелкой полоски
    camera.fitToView(screenWidth, screenHeight, WORLD_WIDTH, WORLD_HEIGHT);

    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      app.renderer.resize(newWidth, newHeight);
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
