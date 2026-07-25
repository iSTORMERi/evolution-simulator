import { OCEAN_ZONES_CONFIG, LAND_ZONE_CONFIG } from '../world/zoneConfig';
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
  private worldWidth: number;
  private worldHeight: number;
  public baseSpeed: number = 200;

  private readonly centerPoint = 4000;

  // Автономный холст для чтения маски
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D | null;
  private maskData?: ImageData;
  private isLoaded: boolean = false;

  constructor(worldWidth: number = 8000, worldHeight: number = 8000) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });

    this.loadMask();
  }

  /**
   * Безопасная фоновая загрузка маски суши
   */
  private async loadMask(): Promise<void> {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = 'assets/ocean_zones_mask.png';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Currents mask load failed'));
      });

      this.maskCanvas.width = img.width;
      this.maskCanvas.height = img.height;

      if (this.maskCtx) {
        this.maskCtx.drawImage(img, 0, 0);
        this.maskData = this.maskCtx.getImageData(0, 0, img.width, img.height);
        this.isLoaded = true;
      }
    } catch (e) {
      console.warn('OceanCurrentsManager: Маска суши недоступна, используем фоллбэк', e);
      this.isLoaded = false;
    }
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => (c || 0).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private colorDistance(hex1: string, hex2: string): number {
    if (!hex1 || !hex2) return Infinity;
    const r1 = parseInt(hex1.substring(1, 3), 16) || 0;
    const g1 = parseInt(hex1.substring(3, 5), 16) || 0;
    const b1 = parseInt(hex1.substring(5, 7), 16) || 0;

    const r2 = parseInt(hex2.substring(1, 3), 16) || 0;
    const g2 = parseInt(hex2.substring(3, 5), 16) || 0;
    const b2 = parseInt(hex2.substring(5, 7), 16) || 0;

    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  private getZoneAt(x: number, y: number): ZoneConfig | null {
    if (!this.isLoaded || !this.maskData) return null;

    const normalizedX = Math.max(0, Math.min(1, x / this.worldWidth));
    const normalizedY = Math.max(0, Math.min(1, y / this.worldHeight));

    const pixelX = Math.floor(normalizedX * (this.maskData.width - 1));
    const pixelY = Math.floor(normalizedY * (this.maskData.height - 1));

    const index = (pixelY * this.maskData.width + pixelX) * 4;
    const r = this.maskData.data[index];
    const g = this.maskData.data[index + 1];
    const b = this.maskData.data[index + 2];

    const sampledHex = this.rgbToHex(r, g, b);

    if (this.colorDistance(sampledHex, LAND_ZONE_CONFIG.hexColor) < 80) {
      return LAND_ZONE_CONFIG;
    }

    let closestZone = OCEAN_ZONES_CONFIG[0];
    let minDistance = Infinity;

    for (const zone of OCEAN_ZONES_CONFIG) {
      const dist = this.colorDistance(sampledHex, zone.hexColor);
      if (dist < minDistance) {
        minDistance = dist;
        closestZone = zone;
      }
    }

    return closestZone;
  }

  /**
   * Проверка на воду с круговым фоллбэком на случай, если маска еще не загрузилась
   */
  public isWater(x: number, y: number): boolean {
    if (!this.isLoaded) {
      const dist = Math.hypot(x - this.centerPoint, y - this.centerPoint);
      return dist > 400 && dist < 3800;
    }

    const zone = this.getZoneAt(x, y);
    return zone ? !zone.isLand : true;
  }

  public getCurrentAt(x: number, y: number): CurrentData {
    const isWater = this.isWater(x, y);

    const nx = (x - this.centerPoint) / this.centerPoint;
    const ny = (y - this.centerPoint) / this.centerPoint;

    let vx = -ny * 1.1;
    let vy = nx * 0.9;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.baseSpeed;
    vy = (vy / len) * this.baseSpeed;

    const zone = this.getZoneAt(x, y);
    const zoneType = this.resolveZoneType(zone);

    return { vx, vy, zoneType, isWater };
  }

  private resolveZoneType(zone: ZoneConfig | null): CurrentZoneType {
    if (!zone || zone.id.toLowerCase() === 'land') return CurrentZoneType.MIXED;

    const zoneId = zone.id.toLowerCase();
    if (zoneId.includes('shallow') || zoneId.includes('shelf')) return CurrentZoneType.WARM;
    if (zoneId.includes('trench') || zoneId.includes('abyssal')) return CurrentZoneType.COLD;

    return CurrentZoneType.MIXED;
  }
}
