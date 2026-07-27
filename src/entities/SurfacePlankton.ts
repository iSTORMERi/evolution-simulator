// src/entities/SurfacePlankton.ts

import { OceanCurrentsManager } from '../simulation/OceanCurrentsManager';

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
    this.radius = config.radius ?? (120 + Math.random() * 60); // Средний размер колонии
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
   * Вспомогательный генератор тестового набора средних колоний всех 4 типов
   */
  public static createDefaultTestColonies(
    worldWidth: number,
    worldHeight: number,
    currentsManager?: OceanCurrentsManager
  ): SurfacePlankton[] {
    const types = [
      PlanktonType.DIATOMS,
      PlanktonType.DINOFLAGELLATES,
      PlanktonType.COCCOLITHOPHORES,
      PlanktonType.CYANOBACTERIA,
    ];

    const colonies: SurfacePlankton[] = [];

    // Создаем по 2 средние колонии каждого типа
    types.forEach((type, typeIdx) => {
      for (let i = 0; i < 2; i++) {
        let x: number;
        let y: number;

        // Если сканер передан -- выбираем гарантированные точки воды
        if (currentsManager) {
          const waterPos = currentsManager.getRandomWaterPosition();
          x = waterPos.x;
          y = waterPos.y;
        } else {
          const margin = 150;
          x = margin + Math.random() * (worldWidth - margin * 2);
          y = margin + Math.random() * (worldHeight - margin * 2);
        }

        colonies.push(
          new SurfacePlankton({
            x,
            y,
            type,
            radius: 130 + Math.random() * 50,
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
