export interface DeltaPointInfo {
  isWater: boolean;
  biomeName: string;
  color: number;
  salinity: number;
  wetness: number;
  blendAlpha?: number; // 1.0 = 100% цвет дельты, 0.0 = 100% фоновый океан
}

export interface DeltaConfig {
  originX: number;     
  originY: number;     
  spreadY: number;     
  numBranches: number; 
  getCoastlineX: (y: number) => number; 
}

interface RiverPathPoint {
  x: number;
  y: number;
  width: number;
}

interface RiverBranch {
  points: RiverPathPoint[];
  mouthX: number;
}

class FastNoise2D {
  private perm: number[] = [];

  constructor(seed = 42) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    this.perm = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private dot(g: number[], x: number, y: number) {
    return g[0] * x + g[1] * y;
  }

  public noise(xin: number, yin: number): number {
    const grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    
    const X = Math.floor(xin) & 255;
    const Y = Math.floor(yin) & 255;
    
    const x = xin - Math.floor(xin);
    const y = yin - Math.floor(yin);

    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);

    const gi00 = this.perm[X + this.perm[Y]] % 8;
    const gi01 = this.perm[X + this.perm[Y + 1]] % 8;
    const gi10 = this.perm[X + 1 + this.perm[Y]] % 8;
    const gi11 = this.perm[X + 1 + this.perm[Y + 1]] % 8;

    const n00 = this.dot(grad2[gi00], x, y);
    const n10 = this.dot(grad2[gi10], x - 1, y);
    const n01 = this.dot(grad2[gi01], x, y - 1);
    const n11 = this.dot(grad2[gi11], x - 1, y - 1);

    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);

    return nx0 + v * (nx1 - nx0);
  }
}

export class DeltaGenerator {
  private config: DeltaConfig;
  private branches: RiverBranch[] = [];
  private noiseGenerator = new FastNoise2D(1337);

  constructor(config: DeltaConfig) {
    this.config = config;
    this.generateOrganicBranches();
  }

  private noise2D(x: number, y: number): number {
    return this.noiseGenerator.noise(x, y);
  }

  private generateOrganicBranches() {
    const { originX, originY, spreadY, numBranches, getCoastlineX } = this.config;
    const steps = 45;

    for (let i = 0; i < numBranches; i++) {
      const t = i / (numBranches - 1);
      const targetY = originY - spreadY / 2 + t * spreadY;
      const points: RiverPathPoint[] = [];

      const exactMouthX = getCoastlineX(targetY);

      for (let s = 0; s <= steps; s++) {
        const stepRatio = s / steps;
        
        const baseX = originX + (exactMouthX - originX) * stepRatio;
        const baseY = originY + (targetY - originY) * stepRatio;

        const noiseFactor = Math.sin(stepRatio * Math.PI);
        const noiseX = this.noise2D(i * 10 + stepRatio * 3, 0) * 400 * noiseFactor;
        const noiseY = this.noise2D(0, i * 10 + stepRatio * 3) * 500 * noiseFactor;

        // УВЕЛИЧЕНО: Стартовая ширина 360, расширяется или сохраняется к устью
        const baseWidth = 360 * (1 - stepRatio * 0.15); 
        const widthNoise = (this.noise2D(stepRatio * 5, i) + 1) * 45;

        points.push({
          x: baseX + noiseX,
          y: baseY + noiseY,
          width: Math.max(90, baseWidth + widthNoise),
        });
      }

      this.branches.push({ points, mouthX: exactMouthX });
    }
  }

  public evaluate(x: number, y: number, isOceanByDefault: boolean): DeltaPointInfo | null {
    const { originX, originY, spreadY, getCoastlineX } = this.config;
    const currentCoastX = getCoastlineX(y);

    // Увеличенный вертикальный охват дельты
    const distFromCenterY = Math.abs(y - originY);
    const maxRadiusY = spreadY * 0.75; 
    
    const edgeNoise = this.noise2D(x * 0.0008, y * 0.0008) * 500;
    const effectiveRadiusY = maxRadiusY + edgeNoise;

    if (distFromCenterY > effectiveRadiusY) return null;

    const falloff = Math.cos((distFromCenterY / effectiveRadiusY) * (Math.PI / 2));

    if (x > originX + 1000 || x < currentCoastX - 3500) return null;

    let minChannelDist = Infinity;
    let currentWidth = 0;

    for (const branch of this.branches) {
      for (let i = 0; i < branch.points.length - 1; i++) {
        const p1 = branch.points[i];
        const p2 = branch.points[i + 1];
        const dist = this.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
        
        if (dist < minChannelDist) {
          minChannelDist = dist;
          currentWidth = (p1.width + p2.width) / 2;
        }
      }
    }

    const detailNoise = this.noise2D(x * 0.0015, y * 0.0015);
    const macroNoise = this.noise2D(x * 0.0005, y * 0.0005);

    const isInWaterChannel = minChannelDist < currentWidth * 0.55;
    const oceanProgress = Math.max(0, Math.min(1, (originX - x) / (originX - currentCoastX)));

    // Основные русла рек
    if (isInWaterChannel) {
      if (x < currentCoastX) {
        return { isWater: true, biomeName: 'Plume Zone', color: 0x36D7B7, salinity: 0.5, wetness: 1.0, blendAlpha: 0.95 };
      }
      return { isWater: true, biomeName: 'River Channel', color: 0x4B6B40, salinity: oceanProgress * 0.2, wetness: 1.0, blendAlpha: 1.0 };
    }

    // ОКЕАН: Плавный выплеск пресной воды и взвеси
    if (isOceanByDefault) {
      const oceanDepth = currentCoastX - x;
      const maxPlumeReach = 3200; // Увеличен вылет в океан

      if (oceanDepth > 0 && oceanDepth < maxPlumeReach) {
        const distanceFade = 1 - (oceanDepth / maxPlumeReach);
        
        // Порог расширения струи от рукавов
        const channelInfluence = Math.max(0, 1 - (minChannelDist / (currentWidth * 4.5)));
        
        if (channelInfluence > 0) {
          // Градиентная альфа: зависит от расстояния до берега и до центра струи
          const rawAlpha = channelInfluence * distanceFade * (0.75 + detailNoise * 0.25);
          const blendAlpha = Math.pow(Math.max(0, Math.min(1, rawAlpha)), 1.4); // Мягкий спад

          if (blendAlpha > 0.02) {
            return { 
              isWater: true, 
              biomeName: 'Estuarine Lagoon', 
              color: 0x2E8B57, 
              salinity: 0.4 + (1 - blendAlpha) * 0.4, 
              wetness: 1.0,
              blendAlpha: blendAlpha // Градиент смешивания!
            };
          }
        }
      }
      return null;
    }

    // СУША: Биомы дельты
    const localWetness = Math.max(0, (1 - minChannelDist / 2200) * falloff + detailNoise * 0.2);

    if (x < currentCoastX + 900 && minChannelDist > currentWidth * 0.6 && minChannelDist < currentWidth * 2.2 && detailNoise > 0.05) {
      return { isWater: false, biomeName: 'Barrier Island / Sandbar', color: 0xE6C280, salinity: 0.6, wetness: 0.2, blendAlpha: 1.0 };
    }

    if (oceanProgress > 0.65 && localWetness > 0.3) {
      return { isWater: false, biomeName: 'Salt Marsh', color: 0x4A6B5D, salinity: 0.7, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (localWetness > 0.5) {
      return { isWater: false, biomeName: 'Lowland Marsh', color: 0x6B8E23, salinity: 0.1, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (localWetness > 0.3 && macroNoise > 0.2 && minChannelDist > currentWidth * 2) {
      return { isWater: false, biomeName: 'Bog / Sphagnum Moor', color: 0x8B5A2B, salinity: 0.0, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (minChannelDist < currentWidth * 2.8 && localWetness > 0.2) {
      return { isWater: false, biomeName: 'Flooded Forest / Mangrove', color: 0x1E3F20, salinity: 0.2, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (localWetness > 0.08) {
      return { isWater: false, biomeName: 'Alluvial Valley', color: 0x3B7A57, salinity: 0.0, wetness: 0.4, blendAlpha: 1.0 };
    }

    return null;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }
}
