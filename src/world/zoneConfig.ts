// src/world/zoneConfig.ts

import { OceanZoneType, ZoneConfig } from './types';

/**
 * Цветовые маркеры (HEX), используемые в маске ocean_zones_mask.png
 * Каждая зона имеет точный цвет для идентификации пикселей.
 */
export const ZONE_COLORS = {
  HADAL: '#010048',      // Самая глубокая синяя полоса (слева сверху)
  ABYSSAL: '#0008b8',    // Темно-синяя
  BATHYAL: '#0000ff',    // Чистый синий (#0000FF) -- точно совпадает с маской!
  MESOPELAGIC: '#0072ff',// Ярко-синяя
  EPIPELAGIC: '#00a3ff', // Лазурная
  NERITIC: '#00e5ff',    // Бирюзовая / Шельф
  LITTORAL: '#00ffc4',   // Самая светлая прибрежная
  LAND: '#f6be76',       // Песочный берег (Суша)
};

export const OCEAN_ZONES_CONFIG: ZoneConfig[] = [
  {
    type: OceanZoneType.HADAL,
    name: 'Хадаль (Желоб)',
    color: 0x010048,
    hexColor: ZONE_COLORS.HADAL,
    params: {
      baseLight: 0.0,
      baseTemperature: 2.3,
      tempSensitivity: 0.0,
      pressure: 400.0,
      oxygen: 0.2,
      salinity: 36.0,
      acidity: 7.4,
      current: 0.0,
      viscosity: 2.0,
      turbidity: 0.1,
      shelter: 0.3
    }
  },
  {
    type: OceanZoneType.ABYSSAL,
    name: 'Абиссаль',
    color: 0x0008b8,
    hexColor: ZONE_COLORS.ABYSSAL,
    params: {
      baseLight: 0.0,
      baseTemperature: 2.0,
      tempSensitivity: 0.0,
      pressure: 200.0,
      oxygen: 0.3,
      salinity: 35.0,
      acidity: 7.6,
      current: 0.0,
      viscosity: 1.8,
      turbidity: 0.0,
      shelter: 0.1
    }
  },
  {
    type: OceanZoneType.BATHYAL,
    name: 'Батипелагиаль',
    color: 0x0000ff,
    hexColor: ZONE_COLORS.BATHYAL,
    params: {
      baseLight: 0.0,
      baseTemperature: 4.0,
      tempSensitivity: 0.0,
      pressure: 50.0,
      oxygen: 0.4,
      salinity: 35.0,
      acidity: 7.8,
      current: 0.1,
      viscosity: 1.5,
      turbidity: 0.0,
      shelter: 0.0
    }
  },
  {
    type: OceanZoneType.MESOPELAGIC,
    name: 'Мезопелагиаль',
    color: 0x0072ff,
    hexColor: ZONE_COLORS.MESOPELAGIC,
    params: {
      baseLight: 0.1,
      baseTemperature: 8.0,
      tempSensitivity: 0.0,
      pressure: 15.0,
      oxygen: 0.5,
      salinity: 35.0,
      acidity: 7.9,
      current: 0.2,
      viscosity: 1.3,
      turbidity: 0.1,
      shelter: 0.0
    }
  },
  {
    type: OceanZoneType.EPIPELAGIC,
    name: 'Эпипелагиаль',
    color: 0x00a3ff,
    hexColor: ZONE_COLORS.EPIPELAGIC,
    params: {
      baseLight: 0.7,
      baseTemperature: 14.0,
      tempSensitivity: 0.0,
      pressure: 3.0,
      oxygen: 0.8,
      salinity: 35.0,
      acidity: 8.1,
      current: 0.5,
      viscosity: 1.0,
      turbidity: 0.1,
      shelter: 0.0
    }
  },
  {
    type: OceanZoneType.NERITIC,
    name: 'Неритическая зона (Шельф)',
    color: 0x00e5ff,
    hexColor: ZONE_COLORS.NERITIC,
    params: {
      baseLight: 0.9,
      baseTemperature: 16.0,
      tempSensitivity: 0.30,
      pressure: 1.5,
      oxygen: 0.9,
      salinity: 35.0,
      acidity: 8.2,
      current: 0.4,
      viscosity: 1.0,
      turbidity: 0.2,
      shelter: 0.9
    }
  },
  {
    type: OceanZoneType.LITTORAL,
    name: 'Литораль (Прибрежная)',
    color: 0x00ffc4,
    hexColor: ZONE_COLORS.LITTORAL,
    params: {
      baseLight: 1.0,
      baseTemperature: 18.0,
      tempSensitivity: 0.80,
      pressure: 1.0,
      oxygen: 1.0,
      salinity: 30.0,
      acidity: 8.0,
      current: 0.8,
      viscosity: 1.0,
      turbidity: 0.6,
      shelter: 0.4
    }
  }
];

export const LAND_ZONE_CONFIG: ZoneConfig = {
  type: OceanZoneType.LAND,
  name: 'Суша (Пляж)',
  color: 0xf6be76,
  hexColor: ZONE_COLORS.LAND,
  params: {
    baseLight: 1.0,
    baseTemperature: 20.0,
    tempSensitivity: 1.00,
    pressure: 1.0,
    oxygen: 1.0,
    salinity: 0.0,
    acidity: 7.0,
    current: 0.0,
    viscosity: 1.0,
    turbidity: 0.0,
    shelter: 1.0
  }
};

export const LAND_COLOR = 0xf6be76;
