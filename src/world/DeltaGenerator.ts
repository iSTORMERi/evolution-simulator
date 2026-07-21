import { createNoise2D } from 'simplex-noise';

export interface DeltaPointInfo {
  isWater: boolean;
  biomeName: string;
  color: number;
  salinity: number; // 0.0 (пресная) - 1.0 (морская)
  wetness: number;  // 0.0 - 1.0
}

export interface DeltaConfig {
  originX: number;     // Точка схождения реки на континенте
  originY: number;     // Высота истока дельты по Y
  mouthX: number;      // X-координата выхода в океан
  spreadY: number;     // Размах веера дельты по Y
  numBranches: number; // Количество основных рукавов
}

interface RiverPathPoint {
  x: number;
  y: number;
  width: number;
}

interface RiverBranch {
  points: RiverPathPoint[];
}

export class DeltaGenerator {
  private config: DeltaConfig;
  private branches: RiverBranch[] = [];
  private noise2D = createNoise2D();

  constructor(config: DeltaConfig) {
    this.config = config;
    this.generateOrganicBranches();
  }

  /**
   * Генерация извилистых, петляющих рукавов с утончением к устью
   */
  private generateOrganicBranches() {
    const { originX, originY, mouthX, spreadY, numBranches } = this.config;
    const steps = 40; // Количество точек аппроксимации каждого рукава

    for (let i = 0; i < numBranches; i++) {
      const t = i / (numBranches - 1); // От 0 до 1 по вееру
      const targetY = originY - spreadY / 2 + t * spreadY;
      const points: RiverPathPoint[] = [];

      for (let s = 0; s <= steps; s++) {
        const stepRatio = s / steps; // 0 = исток (континент), 1 = устье (океан)
        
        // Линейная траектория
        const baseX = originX + (mouthX - originX) * stepRatio;
        const baseY = originY + (targetY - originY) * stepRatio;

        // Накладываем извилистость через шумы
        const noiseX = this.noise2D(i * 10 + stepRatio * 3, 0) * 350;
        const noiseY = this.noise2D(0, i * 10 + stepRatio * 3) * 450;

        // Постепенное изменение ширины рукавов
        const baseWidth = 220 * (1 - stepRatio * 0.4);
        const widthNoise = (this.noise2D(stepRatio * 5, i) + 1) * 30;

        points.push({
          x: baseX + noiseX,
          y: baseY + noiseY,
          width: Math.max(40, baseWidth + widthNoise),
        });
      }

      this.branches.push({ points });
    }
  }

  /**
   * Расчет параметров точки (x, y) в районе дельты
   */
  public evaluate(x: number, y: number, isOceanByDefault: boolean): DeltaPointInfo | null {
    const { originX, mouthX, originY, spreadY } = this.config;

    // 1. Плавный затухающий фактор (Falloff Mask) -- предотвращает прямоугольные границы
    const distFromCenterY = Math.abs(y - originY);
    const maxRadiusY = spreadY * 0.65;
    
    // Органический разрыв краев через шум
    const edgeNoise = this.noise2D(x * 0.0008, y * 0.0008) * 400;
    const effectiveRadiusY = maxRadiusY + edgeNoise;

    if (distFromCenterY > effectiveRadiusY) return null;

    // Фактор затухания от 1.0 (в центре дельты) до 0.0 (к краям)
    const falloff = Math.cos((distFromCenterY / effectiveRadiusY) * (Math.PI / 2));

    // Проверка границ по X
    if (x > originX + 800 || x < mouthX - 2500) return null;

    // 2. Поиск наименьшего расстояния до извилистых рукавов
    let minChannelDist = Infinity;
    let currentWidth = 0;

    for (const branch of this.branches) {
      for (let i = 0; i < branch.points.length - 1; i++) {
        const p1 = branch.points[i];
        const p2 = branch.points[i + 1];
        const dist = this.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
        
        if (dist < minChannelDist) {
          minChannelDist = dist;
          currentWidth = (p1.width + p2.width) / 2;
        }
      }
    }

    // 3. Генерация органического шума влажности и рельефа
    const detailNoise = this.noise2D(x * 0.002, y * 0.002);
    const macroNoise = this.noise2D(x * 0.0005, y * 0.0005);

    const isInWaterChannel = minChannelDist < currentWidth * 0.5;
    const oceanProgress = Math.max(0, Math.min(1, (originX - x) / (originX - mouthX)));

    // 4. Определение водной глади дельты
    if (isInWaterChannel) {
      if (x < mouthX) {
        // Зона 9: Эстуарный шлейф (Plume Zone)
        return { isWater: true, biomeName: 'Plume Zone', color: 0x40E0D0, salinity: 0.6, wetness: 1.0 };
      }
      // Зона 7: Мутные речные протоки
      return { isWater: true, biomeName: 'River Channel', color: 0x5C6B47, salinity: oceanProgress * 0.2, wetness: 1.0 };
    }

    // Водная зона эстуария/лагуны на стыке с морем
    if (isOceanByDefault) {
      if (x > mouthX - 1000 && (detailNoise > -0.2 || minChannelDist < currentWidth * 2)) {
        // Зона 8: Солоноватые эстуарные лагуны
        return { isWater: true, biomeName: 'Estuarine Lagoon', color: 0x2E8B57, salinity: 0.5, wetness: 1.0 };
      }
      return null;
    }

    // 5. Распределение суши и болот с затуханием (Falloff)
    const localWetness = Math.max(0, (1 - minChannelDist / 1800) * falloff + detailNoise * 0.2);

    // Зона 6: Песчаные косы и островки
    if (x < mouthX + 800 && minChannelDist > currentWidth * 0.6 && minChannelDist < currentWidth * 1.8 && detailNoise > 0.1) {
      return { isWater: false, biomeName: 'Barrier Island / Sandbar', color: 0xE6C280, salinity: 0.6, wetness: 0.2 };
    }

    // Зона 5: Солончаковые марши
    if (oceanProgress > 0.7 && localWetness > 0.35) {
      return { isWater: false, biomeName: 'Salt Marsh', color: 0x4A6B5D, salinity: 0.7, wetness: localWetness };
    }

    // Зона 3: Низинные топкие болота
    if (localWetness > 0.55) {
      return { isWater: false, biomeName: 'Lowland Marsh', color: 0x6B8E23, salinity: 0.1, wetness: localWetness };
    }

    // Зона 4: Верховые кислые болота (торфяники)
    if (localWetness > 0.35 && macroNoise > 0.25 && minChannelDist > currentWidth * 2) {
      return { isWater: false, biomeName: 'Bog / Sphagnum Moor', color: 0x8B5A2B, salinity: 0.0, wetness: localWetness };
    }

    // Зона 2: Затопляемый / Мангровый лес
    if (minChannelDist < currentWidth * 2.5 && localWetness > 0.25) {
      return { isWater: false, biomeName: 'Flooded Forest / Mangrove', color: 0x1E3F20, salinity: 0.2, wetness: localWetness };
    }

    // Зона 1: Аллювиальная долина
    if (localWetness > 0.1) {
      return { isWater: false, biomeName: 'Alluvial Valley', color: 0x3B7A57, salinity: 0.0, wetness: 0.4 };
    }

    return null; // Стандартная суша вне влияния дельты
  }

  // Вспомогательная геометрия: расстояние от точки до отрезка
  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }
}
