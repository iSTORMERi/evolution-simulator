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
  isWater: boolean;
}

export class OceanCurrentsManager {
  public baseSpeed: number = 200;

  constructor(..._args: any[]) {}

  public isWater(_x: number, _y: number): boolean {
    return true;
  }

  public getCurrentAt(_x: number, _y: number): CurrentData {
    return {
      vx: 0,
      vy: 0,
      zoneType: CurrentZoneType.MIXED,
      isWater: true
    };
  }
}
