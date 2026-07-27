// src/entities/SurfacePlankton.ts

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
   * Обновление состояния колонии (задел на будущее движение/деление/рост)
   */
  public update(_dt: number, _worldWidth: number, _worldHeight: number): void {
    // На текущем этапе колонии статично располагаются на карте
  }

  /**
   * Вспомогательный генератор тестового набора средних колоний всех 4 типов
   */
  public static createDefaultTestColonies(worldWidth: number, worldHeight: number): SurfacePlankton[] {
    const types = [
      PlanktonType.DIATOMS,
      PlanktonType.DINOFLAGELLATES,
      PlanktonType.COCCOLITHOPHORES,
      PlanktonType.CYANOBACTERIA,
    ];

    const colonies: SurfacePlankton[] = [];

    // Создаем по 2 средние колонии каждого типа для первичного визуального теста
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
