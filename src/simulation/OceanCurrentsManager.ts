// src/simulation/OceanCurrentsManager.ts

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

  // Центр и радиус вращения гира (круговорота)
  private readonly centerPoint = 4000;

  constructor(worldMap: WorldMap) {
    this.worldMap = worldMap;
  }

  /**
   * Безопасное получение зоны с защитой от ошибок загрузки/маски
   */
  public getZoneSafely(x: number, y: number): ZoneConfig | null {
    try {
      return this.worldMap.getZoneAt(x, y) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Безопасная проверка на воду с защитой от незагрузившейся маски
   */
  public isWater(x: number, y: number): boolean {
    const zone = this.getZoneSafely(x, y);
    // Если зона не определена/маска не готова -- по умолчанию считаем водой
    return zone ? !zone.isLand : true;
  }

  /**
   * Расчет вектора и типа течения в точке (x, y)
   */
  public getCurrentAt(x: number, y: number): CurrentData {
    const zone = this.getZoneSafely(x, y);
    const isWater = zone ? !zone.isLand : true;

    // 1. Расчет вектора базового океанического круговорота (Gyre)
    const nx = (x - this.centerPoint) / this.centerPoint;
    const ny = (y - this.centerPoint) / this.centerPoint;

    // Тангенциальный вектор вращения с легкой асимметрией
    let vx = -ny * 1.1;
    let vy = nx * 0.9;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.baseSpeed;
    vy = (vy / len) * this.baseSpeed;

    // 2. Определение температурного типа течения на основе зоны
    const zoneType = this.resolveZoneType(zone);

    return {
      vx,
      vy,
      zoneType,
      zoneConfig: zone ?? undefined,
      isWater
    };
  }

  /**
   * Вспомогательный метод определения типа течения по ID зоны
   */
  private resolveZoneType(zone: ZoneConfig | null): CurrentZoneType {
    if (!zone) return CurrentZoneType.MIXED;

    const zoneId = zone.id.toLowerCase();

    if (zoneId.includes('shallow') || zoneId.includes('shelf')) {
      return CurrentZoneType.WARM;
    }
    
    if (zoneId.includes('trench') || zoneId.includes('abyssal')) {
      return CurrentZoneType.COLD;
    }

    return CurrentZoneType.MIXED;
  }
}
