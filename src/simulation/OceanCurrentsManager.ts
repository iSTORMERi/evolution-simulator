import { WorldMap } from '../world/WorldMap';
import { ZoneConfig } from '../world/types';

export enum CurrentZoneType {
  WARM = 'WARM',   // 🟧 Прибрежное теплое течение / Шельф
  MIXED = 'MIXED', // 🟩 Зона смешивания
  COLD = 'COLD'    // 🟦 Глубинное холодное течение
}

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType;
  zoneConfig: ZoneConfig;
  isWater: boolean;
}

export class OceanCurrentsManager {
  private worldMap: WorldMap;
  public baseSpeed: number = 200;

  constructor(worldMap: WorldMap) {
    this.worldMap = worldMap;
  }

  /**
   * Проверка: является ли точка водой (считывается из точной маски PNG)
   */
  public isWater(x: number, y: number): boolean {
    const zone = this.worldMap.getZoneAt(x, y);
    return !zone.isLand;
  }

  public getCurrentAt(x: number, y: number): CurrentData {
    const zone = this.worldMap.getZoneAt(x, y);
    const isWater = !zone.isLand;

    // Центрированные координаты для создания базового круговорота в океане
    const nx = (x - 4000) / 4000;
    const ny = (y - 4000) / 4000;

    // Вектор циркуляции
    let vx = -ny * 1.1;
    let vy = nx * 0.9;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.baseSpeed;
    vy = (vy / len) * this.baseSpeed;

    // Определяем визуальный тип течения на основе биома из WorldMap
    let zoneType = CurrentZoneType.MIXED;
    if (zone.id.includes('shallow') || zone.id.includes('shelf')) {
      zoneType = CurrentZoneType.WARM;
    } else if (zone.id.includes('trench') || zone.id.includes('abyssal')) {
      zoneType = CurrentZoneType.COLD;
    }

    return {
      vx,
      vy,
      zoneType,
      zoneConfig: zone,
      isWater
    };
  }
}
