// src/world/types.ts

export enum OceanZoneType {
  HADAL = 'HADAL',
  ABYSSAL = 'ABYSSAL',
  BATHYAL = 'BATHYAL',
  MESOPELAGIC = 'MESOPELAGIC',
  EPIPELAGIC = 'EPIPELAGIC',
  NERITIC = 'NERITIC',
  LITTORAL = 'LITTORAL',
  LAND = 'LAND'
}

export interface EnvironmentalParameters {
  light: number;
  pressure: number;
  temperature: number;
  oxygen: number;
  salinity: number;
  acidity: number;
  current: number;
  viscosity: number;
  turbidity: number;
  shelter: number;
}

export interface ZoneConfig {
  type: OceanZoneType;
  name: string;
  color: number;
  widthRatio: number;
  params: EnvironmentalParameters;
}
