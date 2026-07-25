export enum CurrentZoneType {
  WARM = 'WARM',   // 🟧 Прибрежное теплое течение
  MIXED = 'MIXED', // 🟩 Зона смешивания / Апвеллинг
  COLD = 'COLD'    // 🟦 Глубинное холодное течение
}

export interface CurrentData {
  vx: number;        // Скорость по X (пиксели/сек)
  vy: number;        // Скорость по Y (пиксели/сек)
  zoneType: CurrentZoneType;
  intensity: number;
}

export class OceanCurrentsManager {
  public mapWidth: number;
  public mapHeight: number;
  public baseSpeed: number = 220; // Скорость течения в пикселях в секунду

  constructor(mapWidth: number = 8000, mapHeight: number = 8000) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  public getCurrentAt(x: number, y: number): CurrentData {
    // Приводим координаты от (0..8000) к диапазону от -1 до 1 относительно центра карты
    const nx = (x - this.mapWidth / 2) / (this.mapWidth / 2);
    const ny = (y - this.mapHeight / 2) / (this.mapHeight / 2);

    // Замкнутый круговорот по схеме:
    // Вверху (ny < 0) -- влево, Внизу (ny > 0) -- вправо
    // Справа у берега (nx > 0) -- вверх, Слева в глубине (nx < 0) -- вниз
    let vx = -ny * 0.8;
    let vy = nx * 1.2;

    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0.001) {
      vx = (vx / len) * this.baseSpeed;
      vy = (vy / len) * this.baseSpeed;
    } else {
      vx = 0;
      vy = -this.baseSpeed * 0.3;
    }

    // Определяем зону (Берег справа nx > 0, Глубина слева nx < 0)
    let zoneType = CurrentZoneType.MIXED;
    if (nx > 0.2) {
      zoneType = CurrentZoneType.WARM;
    } else if (nx < -0.2) {
      zoneType = CurrentZoneType.COLD;
    }

    return {
      vx,
      vy,
      zoneType,
      intensity: Math.min(1.0, len)
    };
  }
}
