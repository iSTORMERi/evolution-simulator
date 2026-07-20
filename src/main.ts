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
    canvas.style.touchAction = 'none';
    appContainer.appendChild(canvas);

    // === НОВЫЕ ГИГАНТСКИЕ РАЗМЕРЫ (24000x24000) ===
    const WORLD_WIDTH = 24000;
    const WORLD_HEIGHT = 24000;

    // Океан 50%, Суша 50%
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, 0.50);
    app.stage.addChild(worldMap.container);

    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    camera.fillScreen(screenWidth, screenHeight);

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
