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

export interface PlanktonColonyConfig {
  x: number;
  y: number;
  type: PlanktonType;
  radius?: number;   // Радиус зоны покрытия (в пикселях/метрах)
  density?: number;  // Плотность биомассы (от 0.0 до 1.0)
  rotation?: number; // Ориентация колонии по течению (в радианах)
  seed?: number;     // Семечко генератора случайных форм
}

/**
 * Конфигурация начального экологического распределения видов (Всего 200 колоний)
 */
export interface SpeciesEcologyConfig {
  type: PlanktonType;
  totalCount: number;
  optimumZones: CurrentZoneType[];
  normalZones: CurrentZoneType[];
  optimumRatio: number; // 0.70 = 70% в идеальных зонах
}

export const PLANKTON_ECOLOGY_CONFIG: SpeciesEcologyConfig[] = [
  {
    type: PlanktonType.DIATOMS,
    totalCount: 60, // 30% от 200
    optimumZones: [CurrentZoneType.COLD],
    normalZones: [CurrentZoneType.CONNECTING, CurrentZoneType.TRANSIT],
    optimumRatio: 0.70
  },
  {
    type: PlanktonType.DINOFLAGELLATES,
    totalCount: 46, // ~23% от 200
    optimumZones: [CurrentZoneType.WARM],
    normalZones: [CurrentZoneType.DRIFT, CurrentZoneType.TRANSIT],
    optimumRatio: 0.70
  },
  {
    type: PlanktonType.COCCOLITHOPHORES,
    totalCount: 44, // ~22% от 200
    optimumZones: [CurrentZoneType.TRANSIT],
    normalZones: [CurrentZoneType.CONNECTING, CurrentZoneType.WARM],
    optimumRatio: 0.70
  },
  {
    type: PlanktonType.CYANOBACTERIA,
    totalCount: 50, // 25% от 200
    optimumZones: [CurrentZoneType.DRIFT],
    normalZones: [CurrentZoneType.WARM, CurrentZoneType.TRANSIT],
    optimumRatio: 0.70
  }
];

/**
 * Класс, представляющий отдельную колонию (поле плотности) фитопланктона
 */
export class SurfacePlankton {
  public x: number;
  public y: number;
  public type: PlanktonType;
  public radius: number;
  public density: number;
  public rotation: number;
  public seed: number;

  constructor(config: PlanktonColonyConfig) {
    this.x = config.x;
    this.y = config.y;
    this.type = config.type;
    // Радиус увеличен в 3 раза: (120..180) * 3 = 360..540
    this.radius = config.radius ?? (360 + Math.random() * 180);
    this.density = config.density ?? (0.7 + Math.random() * 0.3);
    this.rotation = config.rotation ?? (Math.random() * Math.PI * 2);
    this.seed = config.seed ?? (Math.random() * 1000);
  }

  /**
   * Обновление состояния и позиции колонии: движение по течению + скольжение вдоль берега
   */
  public update(dt: number, currentsManager: OceanCurrentsManager): void {
    if (!currentsManager) return;

    // 1. Получаем скорость и направление течения в текущей точке
    const velocity = currentsManager.getVelocityAt(this.x, this.y);
    if (!velocity) return;

    const dx = velocity.vx * dt;
    const dy = velocity.vy * dt;

    // Плавно разворачиваем колонию по направлению течения, если есть движение
    if (dx !== 0 || dy !== 0) {
      this.rotation = Math.atan2(dy, dx);
    }

    const nextX = this.x + dx;
    const nextY = this.y + dy;

    // 2. Вариант А: Плывём свободно (впереди чистая вода)
    if (currentsManager.isWater(nextX, nextY)) {
      this.x = nextX;
      this.y = nextY;
    } 
    // 3. Вариант Б: Впереди берег! Пробуем скользить по горизонтали (по X)
    else if (currentsManager.isWater(nextX, this.y)) {
      this.x = nextX;
    } 
    // 4. Вариант В: Пробуем скользить по вертикали (по Y)
    else if (currentsManager.isWater(this.x, nextY)) {
      this.y = nextY;
    }
    // 5. Вариант Г: Тупик / Угол суши -- прижимаемся и стоим на месте (this.x, this.y не меняются)
  }

  /**
   * Метод поиска точки в воде, принадлежащей конкретным типам зон течений
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

    // Резервный фолбэк (любая случайная точка воды), если за maxAttempts зона не найдена
    return currentsManager.getRandomWaterPosition();
  }

  /**
   * Генерация сбалансированной экосистемы из 200 увеличенных колоний по целевым биомам
   */
  public static createEcologicalInitialColonies(
    worldWidth: number,
    worldHeight: number,
    currentsManager: OceanCurrentsManager
  ): SurfacePlankton[] {
    const colonies: SurfacePlankton[] = [];

    for (const config of PLANKTON_ECOLOGY_CONFIG) {
      const optimumCount = Math.round(config.totalCount * config.optimumRatio);
      const normalCount = config.totalCount - optimumCount;

      // 1. Спавн 70% колоний в зонах Оптимума (Радиус x3)
      for (let i = 0; i < optimumCount; i++) {
        const pos = this.findWaterPositionInZones(currentsManager, config.optimumZones);
        colonies.push(
          new SurfacePlankton({
            x: pos.x,
            y: pos.y,
            type: config.type,
            radius: 360 + Math.random() * 180, // x3 от исходного значения
            density: 0.75 + Math.random() * 0.25,
            rotation: Math.random() * Math.PI * 2,
            seed: Math.random() * 1000,
          })
        );
      }

      // 2. Спавн 30% колоний в зонах Нормы (Радиус x3)
      for (let i = 0; i < normalCount; i++) {
        const pos = this.findWaterPositionInZones(currentsManager, config.normalZones);
        colonies.push(
          new SurfacePlankton({
            x: pos.x,
            y: pos.y,
            type: config.type,
            radius: 330 + Math.random() * 150, // x3 от исходного значения
            density: 0.65 + Math.random() * 0.25,
            rotation: Math.random() * Math.PI * 2,
            seed: Math.random() * 1000,
          })
        );
      }
    }

    return colonies;
  }

  /**
   * Генератор стартового набора: если передан currentsManager -- создаёт полную 
   * экосистему из 200 колоний по их естественным биомам.
   */
  public static createDefaultTestColonies(
    worldWidth: number,
    worldHeight: number,
    currentsManager?: OceanCurrentsManager
  ): SurfacePlankton[] {
    if (currentsManager) {
      return this.createEcologicalInitialColonies(worldWidth, worldHeight, currentsManager);
    }

    // Резервный базовый спавн (для изолированных тестов без карты течений)
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
        const x = margin + Math.random() * (worldWidth - margin * 2);
        const y = margin + Math.random() * (worldHeight - margin * 2);

        colonies.push(
          new SurfacePlankton({
            x,
            y,
            type,
            radius: 390 + Math.random() * 150, // x3 от исходного значения
            density: 0.85,
            rotation: Math.random() * Math.PI * 2,
            seed: typeIdx * 100 + i * 17 + Math.random() * 5,
          })
        );
      }
    });

    return colonies;
  }
}
