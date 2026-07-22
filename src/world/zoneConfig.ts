// src/world/zoneConfig.ts

import { OceanZoneType, ZoneConfig } from './types';

/**
 * Цветовые маркеры (HEX), используемые в маске ocean_zones_mask.png
 * Каждая зона имеет точный цвет для идентификации пикселей.
 */
export const ZONE_COLORS = {
  HADAL: '#010048',      // Самая глубокая синяя полоса (слева сверху)
  ABYSSAL: '#0008b8',    // Темно-синяя
  BATHYAL: '#0031f5',    // Синяя
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
    params: { light: 0.0, pressure: 400.0, temperature: 1.0, oxygen: 0.2, salinity: 36.0, acidity: 7.4, current: 0.0, viscosity: 2.0, turbidity: 0.1, shelter: 0.3 }
  },
  {
    type: OceanZoneType.ABYSSAL,
    name: 'Абиссаль',
    color: 0x0008b8,
    hexColor: ZONE_COLORS.ABYSSAL,
    params: { light: 0.0, pressure: 200.0, temperature: 2.0, oxygen: 0.3, salinity: 35.0, acidity: 7.6, current: 0.0, viscosity: 1.8, turbidity: 0.0, shelter: 0.1 }
  },
  {
    type: OceanZoneType.BATHYAL,
    name: 'Батипелагиаль',
    color: 0x0031f5,
    hexColor: ZONE_COLORS.BATHYAL,
    params: { light: 0.0, pressure: 50.0, temperature: 5.0, oxygen: 0.4, salinity: 35.0, acidity: 7.8, current: 0.1, viscosity: 1.5, turbidity: 0.0, shelter: 0.0 }
  },
  {
    type: OceanZoneType.MESOPELAGIC,
    name: 'Мезопелагиаль',
    color: 0x0072ff,
    hexColor: ZONE_COLORS.MESOPELAGIC,
    params: { light: 0.1, pressure: 15.0, temperature: 10.0, oxygen: 0.5, salinity: 35.0, acidity: 7.9, current: 0.2, viscosity: 1.3, turbidity: 0.1, shelter: 0.0 }
  },
  {
    type: OceanZoneType.EPIPELAGIC,
    name: 'Эпипелагиаль',
    color: 0x00a3ff,
    hexColor: ZONE_COLORS.EPIPELAGIC,
    params: { light: 0.7, pressure: 3.0, temperature: 18.0, oxygen: 0.8, salinity: 35.0, acidity: 8.1, current: 0.5, viscosity: 1.0, turbidity: 0.1, shelter: 0.0 }
  },
  {
    type: OceanZoneType.NERITIC,
    name: 'Неритическая зона (Шельф)',
    color: 0x00e5ff,
    hexColor: ZONE_COLORS.NERITIC,
    params: { light: 0.9, pressure: 1.5, temperature: 24.0, oxygen: 0.9, salinity: 35.0, acidity: 8.2, current: 0.4, viscosity: 1.0, turbidity: 0.2, shelter: 0.9 }
  },
  {
    type: OceanZoneType.LITTORAL,
    name: 'Литораль (Прибрежная)',
    color: 0x00ffc4,
    hexColor: ZONE_COLORS.LITTORAL,
    params: { light: 1.0, pressure: 1.0, temperature: 25.0, oxygen: 1.0, salinity: 30.0, acidity: 8.0, current: 0.8, viscosity: 1.0, turbidity: 0.6, shelter: 0.4 }
  }
];

export const LAND_ZONE_CONFIG: ZoneConfig = {
  type: OceanZoneType.LAND, // Если в типе OceanZoneType нет LAND, можно объявить отдельно
  name: 'Суша (Пляж)',
  color: 0xf6be76,
  hexColor: ZONE_COLORS.LAND,
  params: { light: 1.0, pressure: 1.0, temperature: 28.0, oxygen: 1.0, salinity: 0.0, acidity: 7.0, current: 0.0, viscosity: 1.0, turbidity: 0.0, shelter: 1.0 }
};

export const LAND_COLOR = 0xf6be76;
