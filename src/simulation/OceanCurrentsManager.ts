import { WorldMap } from '../world/WorldMap';
import { ZoneConfig } from '../world/types';

export enum CurrentZoneType {
  WARM = 'WARM',
  MIXED = 'MIXED',
  COLD = 'COLD'
}

export interface CurrentData {
  vx: number;
  vy: number;
  zoneType: CurrentZoneType;
  zoneConfig?: ZoneConfig;
  isWater: boolean;
}

export class OceanCurrentsManager {
  private worldMap: WorldMap;
  public baseSpeed: number = 200;

  constructor(worldMap: WorldMap) {
    this.worldMap = worldMap;
  }

  /**
   * Безопасная проверка на воду с защитой от незагрузившейся маски
   */
  public isWater(x: number, y: number): boolean {
    try {
      const zone = this.worldMap.getZoneAt(x, y);
      return zone ? !zone.isLand : true;
    } catch {
      return true; // Если маска еще не готова -- считаем водой
    }
  }

  public getCurrentAt(x: number, y: number): CurrentData {
    let zone: ZoneConfig | null = null;
    let isWater = true;

    try {
      zone = this.worldMap.getZoneAt(x, y);
      if (zone) {
        isWater = !zone.isLand;
      }
    } catch {
      isWater = true;
    }

    // Базовое вращение океанического круговорота
    const nx = (x - 4000) / 4000;
    const ny = (y - 4000) / 4000;

    let vx = -ny * 1.1;
    let vy = nx * 0.9;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.baseSpeed;
    vy = (vy / len) * this.baseSpeed;

    let zoneType = CurrentZoneType.MIXED;
    if (zone) {
      if (zone.id.includes('shallow') || zone.id.includes('shelf')) {
        zoneType = CurrentZoneType.WARM;
      } else if (zone.id.includes('trench') || zone.id.includes('abyssal')) {
        zoneType = CurrentZoneType.COLD;
      }
    }

    return {
      vx,
      vy,
      zoneType,
      zoneConfig: zone || undefined,
      isWater
    };
  }
}
