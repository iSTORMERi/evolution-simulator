import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';

console.log('Evolution Simulator Initializing...');

async function initApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = '';

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const app = new PIXI.Application();

  try {
    // Поддержка Pixi v8 (асинхронный старт)
    if ('init' in app && typeof app.init === 'function') {
      await app.init({
        width: screenWidth,
        height: screenHeight,
        backgroundColor: 0x0d1117,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    } else {
      // Поддержка Pixi v7 (синхронный старт)
      // @ts-ignore
      app.renderer = PIXI.autoDetectRenderer({
        width: screenWidth,
        height: screenHeight,
        backgroundColor: 0x0d1117,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    }

    // Получаем DOM-элемент холста
    const canvas = (app.canvas || app.view) as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    appContainer.appendChild(canvas);

    // Логический размер нашей карты
    const WORLD_WIDTH = 3000;
    const WORLD_HEIGHT = 1500;

    // Создаем карту мира
    const worldMap = new WorldMap(WORLD_WIDTH, WORLD_HEIGHT, 0.65);
    worldMap.fitToScreen(screenWidth, screenHeight);

    app.stage.addChild(worldMap.container);

    // Слушатель изменения размера экрана
    window.addEventListener('resize', () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      app.renderer.resize(newWidth, newHeight);
      worldMap.fitToScreen(newWidth, newHeight);
    });

  } catch (err) {
    // Выводим ошибку прямо на экран iPhone, если что-то сломалось
    appContainer.innerHTML = `
      <div style="color: #ff5555; padding: 20px; font-family: monospace;">
        <h3>Render Error:</h3>
        <p>${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
}

initApp();
