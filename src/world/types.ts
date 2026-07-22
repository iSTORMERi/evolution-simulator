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
  color: number;       // Числовой HEX (например, 0x010048) для рендера/Pixi.js
  hexColor: string;    // Строковый HEX (например, '#010048') для сверки пикселей маски
  params: EnvironmentalParameters;
}
