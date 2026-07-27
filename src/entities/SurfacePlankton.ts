// src/entities/SurfacePlankton.ts

import { OceanCurrentsManager, CurrentZoneType } from '../simulation/OceanCurrentsManager';

/**
 * Четыре основных биологических типа фитопланктона
 */
export enum PlanktonType {
  DIATOMS = 'DIATOMS',                 // Диатомовые (Оливково-золотые струи)
  DINOFLAGELLATES = 'DINOFLAGELLATES', // Динофлагеллаты (Багрово-красные жилы)
  COCCOLITHOPHORES = 'COCCOLITHOPHORES',// Кокколитофориды (Молочно-бирюзовые вихри)
  CYANOBACTERIA = 'CYANOBACTERIA'      // Цианобактерии (Кислотно-салатовая паутина)
}

/**
 * Стадии жизненного цикла колонии
 */
export enum PlanktonLifeStage {
  GROWING = 'GROWING', // Активный рост
  MATURE = 'MATURE',   // Зрелость и возможность деления
  DYING = 'DYING',     // Увядание и отмирание
  DEAD = 'DEAD'        // Готова к удалению
}

export interface PlanktonColonyConfig {
  x: number;
  y: number;
  type: PlanktonType;
  radius?: number;   // Текущий радиус зоны покрытия
  density?: number;  // Плотность биомассы (прозрачность, от 0.0 до 1.0)
  rotation?: number; // Ориентация колонии по течению (в радианах)
  seed?: number;     // Семечко генератора случайных форм
  age?: number;      // Начальный возраст
}

/**
 * Конфигурация экологического распределения видов и лимитов размеров
 */
export interface SpeciesEcologyConfig {
  type: PlanktonType;
  totalCount: number;
  optimumZones: CurrentZoneType[];
  normalZones: CurrentZoneType[];
  optimumRatio: number; // 0.70 = 70% в идеальных зонах
  minRadius: number;    // Минимальный стартовый радиус при рождении
  maxRadius: number;    // Максимальный радиус зрелой колонии
}

export const PLANKTON_ECOLOGY_CONFIG: SpeciesEcologyConfig[] = [
  {
    type: PlanktonType.DIATOMS,
    totalCount: 60,
    optimumZones: [CurrentZoneType.COLD],
    normalZones: [CurrentZoneType.CONNECTING, CurrentZoneType.TRANSIT],
    optimumRatio: 0.70,
    minRadius: 150,
    maxRadius: 550
  },
  {
    type: PlanktonType.DINOFLAGELLATES,
    totalCount: 46,
    optimumZones: [CurrentZoneType.WARM],
    normalZones: [CurrentZoneType.DRIFT, CurrentZoneType.TRANSIT],
    optimumRatio: 0.70,
    minRadius: 120,
    maxRadius: 480
  },
  {
    type: PlanktonType.COCCOLITHOPHORES,
    totalCount: 44,
    optimumZones: [CurrentZoneType.TRANSIT],
    normalZones: [CurrentZoneType.CONNECTING, CurrentZoneType.WARM],
    optimumRatio: 0.70,
    minRadius: 130,
    maxRadius: 520
  },
  {
    type: PlanktonType.CYANOBACTERIA,
    totalCount: 50,
    optimumZones: [CurrentZoneType.DRIFT],
    normalZones: [CurrentZoneType.WARM, CurrentZoneType.TRANSIT],
    optimumRatio: 0.70,
    minRadius: 160,
    maxRadius: 620
  }
];

/**
 * Класс, представляющий отдельную живую колонию фитопланктона
 */
export class SurfacePlankton {
  public x: number;
  public y: number;
  public type: PlanktonType;
  public radius: number;
  public density: number;
  public rotation: number;
  public seed: number;

  // Биологическое состояние
  public lifeStage: PlanktonLifeStage = PlanktonLifeStage.GROWING;
  public age: number;
  public maxAge: number;
  public minRadius: number;
  public maxRadius: number;

  // Вектор текущей физической скорости (для плавного вязкого дрейфа)
  private vx: number = 0;
  private vy: number = 0;

  constructor(config: PlanktonColonyConfig) {
    this.x = config.x;
    this.y = config.y;
    this.type = config.type;

    // Находим видовую конфигурацию
    const speciesConfig = PLANKTON_ECOLOGY_CONFIG.find(c => c.type === this.type)!;
    this.minRadius = speciesConfig.minRadius;
    this.maxRadius = speciesConfig.maxRadius;

    this.radius = config.radius ?? this.minRadius;
    this.density = config.density ?? 0.6;
    this.rotation = config.rotation ?? (Math.random() * Math.PI * 2);
    this.seed = config.seed ?? (Math.random() * 1000);

    // Продолжительность жизни (120 - 180 секунд игрового времени)
    this.maxAge = 120 + Math.random() * 60;
    this.age = config.age ?? 0;
  }

  /**
   * 🌊 Неторопливое движение по течению с инерцией и микротурбулентностью
   */
  public update(dt: number, currentsManager: OceanCurrentsManager): void {
    if (!currentsManager) return;

    // 1. Получаем целевой вектор течения
    const targetVelocity = currentsManager.getVelocityAt(this.x, this.y);
    if (!targetVelocity) return;

    // 2. Инерция: плавно подстраиваем текущую скорость под течение (вязкая среда)
    const inertiaFactor = 1.8;
    this.vx += (targetVelocity.vx - this.vx) * Math.min(dt * inertiaFactor, 1.0);
    this.vy += (targetVelocity.vy - this.vy) * Math.min(dt * inertiaFactor, 1.0);

    // 3. Слабая микротурбулентность (броуновский хаотичный дрейф)
    const turbulence = 1.2;
    const noiseX = (Math.random() - 0.5) * turbulence;
    const noiseY = (Math.random() - 0.5) * turbulence;

    const moveX = (this.vx + noiseX) * dt;
    const moveY = (this.vy + noiseY) * dt;

    // Поворот колонии по направлению движения
    if (Math.hypot(moveX, moveY) > 0.05) {
      this.rotation = Math.atan2(moveY, moveX);
    }

    const nextX = this.x + moveX;
    const nextY = this.y + moveY;

    // 4. Физика скольжения вдоль суши
    if (currentsManager.isWater(nextX, nextY)) {
      this.x = nextX;
      this.y = nextY;
    } else if (currentsManager.isWater(nextX, this.y)) {
      this.x = nextX;
    } else if (currentsManager.isWater(this.x, nextY)) {
      this.y = nextY;
    }
  }

  /**
   * 🧬 Обновление жизненного цикла: рост, старение, размножение и отмирание
   * @param canSplit Флаг разрешения деления (если не достигнут лимит 250 колоний)
   */
  public updateLifecycle(
    dt: number, 
    currentsManager: OceanCurrentsManager, 
    canSplit: boolean
  ): SurfacePlankton | null {
    if (this.lifeStage === PlanktonLifeStage.DEAD) return null;

    // Определяем комфортность текущей зоны течения
    const currentData = currentsManager.getCurrentAt(this.x, this.y);
    let zoneMultiplier = 0.3; // Враждебная зона / чужой биом по умолчанию

    if (currentData) {
      const config = PLANKTON_ECOLOGY_CONFIG.find(c => c.type === this.type);
      if (config?.optimumZones.includes(currentData.zoneType)) {
        zoneMultiplier = 1.5; // Идеальная зона
      } else if (config?.normalZones.includes(currentData.zoneType)) {
        zoneMultiplier = 1.0; // Нормальная зона
      }
    }

    // В неблагоприятной зоне колония стареет быстрей
    const agingRate = zoneMultiplier < 1.0 ? 1.8 : 1.0;
    this.age += dt * agingRate;

    // --- Фаза 1: РОСТ ---
    if (this.age < this.maxAge * 0.35) {
      this.lifeStage = PlanktonLifeStage.GROWING;
      const progress = this.age / (this.maxAge * 0.35);
      
      this.radius = this.minRadius + (this.maxRadius - this.minRadius) * Math.min(progress * zoneMultiplier, 1.0);
      this.density = Math.min(1.0, 0.4 + progress * 0.6);
    } 
    // --- Фаза 2: ЗРЕЛОСТЬ И ДЕЛЕНИЕ ---
    else if (this.age < this.maxAge * 0.75) {
      this.lifeStage = PlanktonLifeStage.MATURE;
      this.radius = this.maxRadius;
      this.density = 1.0;

      // Почкование происходит только в идеальных зонах при наличии свободных слотов
      if (zoneMultiplier > 1.0 && canSplit && Math.random() < 0.006 * dt) {
        return this.split();
      }
    } 
    // --- Фаза 3: УВЯДАНИЕ ---
    else if (this.age < this.maxAge) {
      this.lifeStage = PlanktonLifeStage.DYING;
      const decayProgress = (this.age - this.maxAge * 0.75) / (this.maxAge * 0.25);
      this.density = Math.max(0.0, 1.0 - decayProgress);
    } 
    // --- Фаза 4: СМЕРТЬ ---
    else {
      this.lifeStage = PlanktonLifeStage.DEAD;
      this.density = 0;
    }

    return null;
  }

  /**
   * Деление колонии пополам (митоз)
   */
  private split(): SurfacePlankton {
    // Материнская колония делится частью ресурсов
    this.radius *= 0.75;
    this.age += 10; // Ускоряем старение матери

    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDist = this.radius * 0.8;

    return new SurfacePlankton({
      x: this.x + Math.cos(offsetAngle) * offsetDist,
      y: this.y + Math.sin(offsetAngle) * offsetDist,
      type: this.type,
      radius: this.minRadius,
      density: 0.5,
      rotation: Math.random() * Math.PI * 2,
      seed: Math.random() * 1000,
      age: 0
    });
  }

  /**
   * Вспомогательный метод поиска спавна в воде
   */
  private static findWaterPositionInZones(
    currentsManager: OceanCurrentsManager,
    targetZones: CurrentZoneType[],
    maxAttempts: number = 400
  ): { x: number; y: number } {
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = currentsManager.getRandomWaterPosition();
      const currentData = currentsManager.getCurrentAt(candidate.x, candidate.y);

      if (currentData && currentData.isWater && targetZones.includes(currentData.zoneType)) {
        return candidate;
      }
    }
    return currentsManager.getRandomWaterPosition();
  }

  /**
   * Генерация стартового набора с распределением возрастов для естественного вида
   */
  public static createEcologicalInitialColonies(
    _worldWidth: number,
    _worldHeight: number,
    currentsManager: OceanCurrentsManager
  ): SurfacePlankton[] {
    const colonies: SurfacePlankton[] = [];

    for (const config of PLANKTON_ECOLOGY_CONFIG) {
      const optimumCount = Math.round(config.totalCount * config.optimumRatio);
      const normalCount = config.totalCount - optimumCount;

      // 1. Зоны Оптимума
      for (let i = 0; i < optimumCount; i++) {
        const pos = this.findWaterPositionInZones(currentsManager, config.optimumZones);
        const randomAge = Math.random() * 70; // Разный начальный возраст
        colonies.push(
          new SurfacePlankton({
            x: pos.x,
            y: pos.y,
            type: config.type,
            density: 0.75 + Math.random() * 0.25,
            rotation: Math.random() * Math.PI * 2,
            seed: Math.random() * 1000,
            age: randomAge
          })
        );
      }

      // 2. Зоны Нормы
      for (let i = 0; i < normalCount; i++) {
        const pos = this.findWaterPositionInZones(currentsManager, config.normalZones);
        const randomAge = Math.random() * 70;
        colonies.push(
          new SurfacePlankton({
            x: pos.x,
            y: pos.y,
            type: config.type,
            density: 0.65 + Math.random() * 0.25,
            rotation: Math.random() * Math.PI * 2,
            seed: Math.random() * 1000,
            age: randomAge
          })
        );
      }
    }

    return colonies;
  }

  public static createDefaultTestColonies(
    worldWidth: number,
    worldHeight: number,
    currentsManager?: OceanCurrentsManager
  ): SurfacePlankton[] {
    if (currentsManager) {
      return this.createEcologicalInitialColonies(worldWidth, worldHeight, currentsManager);
    }

    const types = [
      PlanktonType.DIATOMS,
      PlanktonType.DINOFLAGELLATES,
      PlanktonType.COCCOLITHOPHORES,
      PlanktonType.CYANOBACTERIA,
    ];

    const colonies: SurfacePlankton[] = [];
    types.forEach((type, typeIdx) => {
      for (let i = 0; i < 2; i++) {
        const margin = 150;
        colonies.push(
          new SurfacePlankton({
            x: margin + Math.random() * (worldWidth - margin * 2),
            y: margin + Math.random() * (worldHeight - margin * 2),
            type,
            density: 0.85,
            seed: typeIdx * 100 + i * 17 + Math.random() * 5,
          })
        );
      }
    });

    return colonies;
  }
}
