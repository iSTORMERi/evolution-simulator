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

export class DeltaGenerator {
  private config: DeltaConfig;
  private branches: { startX: number; startY: number; endX: number; endY: number; width: number }[] = [];

  constructor(config: DeltaConfig) {
    this.config = config;
    this.generateBranchStructure();
  }

  // Генерация векторных рукавов дельты (веер)
  private generateBranchStructure() {
    const { originX, originY, mouthX, spreadY, numBranches } = this.config;
    
    for (let i = 0; i < numBranches; i++) {
      const t = i / (numBranches - 1);
      const targetY = originY - spreadY / 2 + t * spreadY;
      
      // Главный рукав
      this.branches.push({
        startX: originX,
        startY: originY,
        endX: mouthX,
        endY: targetY,
        width: 180 + Math.random() * 100,
      });

      // Второстепенное ответвление
      if (Math.random() > 0.3) {
        const midX = originX + (mouthX - originX) * (0.4 + Math.random() * 0.3);
        const midY = originY + (targetY - originY) * 0.5;
        this.branches.push({
          startX: midX,
          startY: midY,
          endX: mouthX,
          endY: targetY + (Math.random() - 0.5) * 800,
          width: 80 + Math.random() * 60,
        });
      }
    }
  }

  // Расчет параметров точки (x, y) в районе дельты
  public evaluate(x: number, y: number, isOceanByDefault: boolean): DeltaPointInfo | null {
    const { originX, mouthX, originY, spreadY } = this.config;

    // Проверяем, находится ли точка в зоне влияния дельты
    const marginY = spreadY * 0.8;
    if (x < mouthX - 2000 || x > originX + 1000 || y < originY - marginY || y > originY + marginY) {
      return null; // Вне дельты
    }

    // 1. Дистанция до ближайшего речного рукава
    let minChannelDist = Infinity;
    let activeWidth = 0;

    for (const b of this.branches) {
      const dist = this.distToSegment(x, y, b.startX, b.startY, b.endX, b.endY);
      if (dist < minChannelDist) {
        minChannelDist = dist;
        activeWidth = b.width;
      }
    }

    const inChannel = minChannelDist < activeWidth;

    // 2. Расчет солёности и влажности
    const oceanProgress = Math.max(0, Math.min(1, (originX - x) / (originX - mouthX))); // 0 (континент) -> 1 (океан)
    const salinity = isOceanByDefault ? 0.8 + oceanProgress * 0.2 : oceanProgress * 0.7;
    const wetness = Math.max(0, 1 - minChannelDist / 2500);

    // 3. Классификация 9 зон и цветовая кодировка
    if (inChannel) {
      if (x < mouthX) {
        // Зона 9: Эстуарный шлейф (Plume Zone)
        return { isWater: true, biomeName: 'Plume Zone', color: 0x40E0D0, salinity: 0.6, wetness: 1.0 };
      }
      // Зона 7: Речные рукава и протоки
      return { isWater: true, biomeName: 'River Channel', color: 0x5C6B47, salinity: salinity * 0.3, wetness: 1.0 };
    }

    if (isOceanByDefault) {
      if (x > mouthX - 800 && oceanProgress < 1.1) {
        // Зона 8: Эстуарные лагуны
        return { isWater: true, biomeName: 'Estuarine Lagoon', color: 0x2E8B57, salinity: 0.5, wetness: 1.0 };
      }
      return null; // Обычный океан
    }

    // Зоны суши и болот
    if (salinity > 0.4 && minChannelDist < 600) {
      // Зона 5: Солончаковые марши
      return { isWater: false, biomeName: 'Salt Marsh', color: 0x4A6B5D, salinity, wetness };
    }
    if (x < mouthX + 600 && minChannelDist > activeWidth * 1.5 && minChannelDist < activeWidth * 3.5) {
      // Зона 6: Песчаные косы и барьерные острова
      return { isWater: false, biomeName: 'Barrier Island / Sandbar', color: 0xE6C280, salinity, wetness: 0.2 };
    }
    if (wetness > 0.75) {
      // Зона 3: Низинные болота
      return { isWater: false, biomeName: 'Lowland Marsh', color: 0x6B8E23, salinity: 0.1, wetness };
    }
    if (wetness > 0.5 && minChannelDist > 1200) {
      // Зона 4: Верховые кислые болота
      return { isWater: false, biomeName: 'Bog / Sphagnum Moor', color: 0x8B5A2B, salinity: 0.0, wetness };
    }
    if (minChannelDist < 900) {
      // Зона 2: Затопляемый / Мангровый лес
      return { isWater: false, biomeName: 'Flooded Forest / Mangrove', color: 0x1E3F20, salinity: salinity * 0.5, wetness };
    }

    // Зона 1: Аллювиальная долина
    return { isWater: false, biomeName: 'Alluvial Valley', color: 0x3B7A57, salinity: 0.0, wetness: 0.4 };
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
