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
  // Базовые параметры освещенности и температуры
  baseLight: number;          // От 0.0 до 1.0 (прозрачность/освещенность в полдень)
  baseTemperature: number;    // Базовая эталонная температура (°C)
  tempSensitivity: number;    // Чувствительность к суточному прогреву от солнца (0.0 до 1.0)

  // Статические гидрофизические параметры
  pressure: number;           // Давление (атм)
  oxygen: number;             // Кислород (мл/л)
  salinity: number;           // Солёность (‰)
  acidity: number;            // Кислотность (pH)
  current: number;            // Сила течений
  viscosity: number;          // Вязкость среды
  turbidity: number;          // Мутность
  shelter: number;            // Наличие укрытий
}

export interface ZoneConfig {
  type: OceanZoneType;
  name: string;
  color: number;       // Числовой HEX (например, 0x010048) для рендера/Pixi.js
  hexColor: string;    // Строковый HEX (например, '#010048') для сверки пикселей маски
  params: EnvironmentalParameters;
}
