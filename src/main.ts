// --- Глобальный перехватчик ошибок для мобайла ---
function showGlobalErrorBanner(msg: string) {
  let div = document.getElementById('debug-error-banner');
  if (!div) {
    div = document.createElement('div');
    div.id = 'debug-error-banner';
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.maxHeight = '50vh';
    div.style.overflowY = 'auto';
    div.style.background = 'rgba(210, 0, 0, 0.95)';
    div.style.color = '#ffffff';
    div.style.zIndex = '999999';
    div.style.padding = '12px';
    div.style.fontSize = '11px';
    div.style.fontFamily = 'monospace';
    div.style.wordBreak = 'break-all';
    div.style.boxSizing = 'border-box';
    div.style.borderBottom = '2px solid #ffffff';
    document.body.appendChild(div);
  }
  div.innerText += `\n🚨 ${msg}`;
}

window.addEventListener('error', (event) => {
  showGlobalErrorBanner(`[Error] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
  showGlobalErrorBanner(`[Unhandled Rejection] ${msg}`);
});

// --- Импорты модулей ---
import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';
import { LightingController } from './world/LightingController';
import { TimeDebugUI } from './ui/TimeDebugUI';

console.log('Evolution Simulator Initializing...');

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    showGlobalErrorBanner('Element #app not found in DOM');
    return;
  }

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
        resizeTo: window,
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
    if (!canvas) {
      throw new Error('Failed to get Canvas element from Pixi Application');
    }

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
    
    const COASTAL_RATIO = 0.28;

    // 1. Карта мира
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, COASTAL_RATIO);
    app.stage.addChild(worldMap.container);

    // 2. Камера
    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    
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
    const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
    showGlobalErrorBanner(`[Init Error] ${errorMsg}`);
    appContainer.innerHTML = `
      <div style="color: #ff5555; padding: 20px; font-family: monospace;">
        <h3>Render Error:</h3>
        <p>${errorMsg}</p>
      </div>
    `;
  }
}

initApp();
