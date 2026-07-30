// src/main.ts

import * as PIXI from 'pixi.js';
import { WorldMap } from './world/WorldMap';
import { CameraController } from './world/CameraController';
import { LightingController } from './world/LightingController';
import { TimeDebugUI } from './ui/TimeDebugUI';
import { BiomeScanner } from './ui/BiomeScanner';

// 1. Импортируем менеджер течений, подложку, частицы и контроллер кнопки UI
import { OceanCurrentsManager } from './simulation/OceanCurrentsManager';
import { CurrentsBackgroundOverlay } from './visuals/CurrentsBackgroundOverlay';
import { CurrentParticlesDebug } from './visuals/CurrentParticlesDebug';
import { CurrentsToggleUI } from './ui/CurrentsToggleUI';

// 2. Импортируем подсистему сетки нутриентов
import { NutrientGrid } from './simulation/NutrientGrid';
import { NutrientGridDebug } from './visuals/NutrientGridDebug';
import { NutrientGridToggleUI } from './ui/NutrientGridToggleUI';

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
    
    // Включаем сортировку слоев внутри контейнера мира
    worldMap.container.sortableChildren = true;
    
    app.stage.addChild(worldMap.container);

    // 1.1. Инициализация течений, мягкой подложки и частиц
    const oceanCurrents = new OceanCurrentsManager(WORLD_WIDTH, WORLD_HEIGHT);

    // ВАЖНО: Дожидаемся асинхронной загрузки и сканирования маски береговой линии!
    await oceanCurrents.initScanner();

    const currentsOverlay = new CurrentsBackgroundOverlay(oceanCurrents, WORLD_WIDTH, WORLD_HEIGHT);
    const debugParticles = new CurrentParticlesDebug(oceanCurrents, 1800);

    // Порядок слоёв: подложка (99) под частицами (100)
    currentsOverlay.container.zIndex = 99;
    debugParticles.container.zIndex = 100;

    worldMap.container.addChild(currentsOverlay.container);
    worldMap.container.addChild(debugParticles.container);

    // 1.2. Синхронное управление видимостью подложки и частиц единой кнопкой
    const currentsUI = new CurrentsToggleUI('toggle-currents-btn');
    
    const initialVisibility = currentsUI.isVisible;
    currentsOverlay.container.visible = initialVisibility;
    debugParticles.container.visible = initialVisibility;

    // Реакция на переключение кнопки
    currentsUI.onToggle((visible) => {
      currentsOverlay.container.visible = visible;
      debugParticles.container.visible = visible;
    });

    // 1.3. Инициализация сетки нутриентов и её UI (передаём app в конструктор)
    const nutrientGrid = new NutrientGrid(oceanCurrents);
    const nutrientGridDebug = new NutrientGridDebug(nutrientGrid, app);
    
    // Сетка располагается под частицами течений (zIndex 98)
    nutrientGridDebug.container.zIndex = 98;
    worldMap.container.addChild(nutrientGridDebug.container);

    // Монтируем кнопку управления сеткой в UI
    new NutrientGridToggleUI(nutrientGridDebug);

    // 2. Инициализация камеры
    const camera = new CameraController(worldMap.container, canvas, WORLD_WIDTH, WORLD_HEIGHT);
    
    if (typeof camera.fillScreen === 'function') {
      camera.fillScreen(app.screen.width, app.screen.height);
    }

    // 3. Инициализация освещения и UI управления временем
    const lightingController = new LightingController(worldMap.container);
    new TimeDebugUI(lightingController);

    // 4. Инициализация сканера биомов
    const scanner = new BiomeScanner(worldMap, lightingController);

    // 5. Главный игровой цикл
    app.ticker.add((ticker) => {
      const deltaSeconds = ticker.deltaMS / 1000;
      
      // Обновляем физику и анимации воды
      worldMap.update(deltaSeconds);

      // Обновляем физику частиц (только когда слой видим)
      if (debugParticles.container.visible) {
        debugParticles.update(deltaSeconds);
      }

      // Синхронизируем состояние дня/ночи на карте
      if (typeof (lightingController as any).getCurrentHours === 'function') {
        worldMap.updateTimeState((lightingController as any).getCurrentHours());
      }

      // Обновление сканера биомов
      scanner.update();
    });

    // Обработка ресайза
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

// Запуск приложения
initApp();
