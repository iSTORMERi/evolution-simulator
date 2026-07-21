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

interface RiverSegment {
  p1: RiverPathPoint;
  p2: RiverPathPoint;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  avgWidth: number;
  maxWidth: number;
}

interface RiverBranch {
  points: RiverPathPoint[];
  segments: RiverSegment[];
  mouthX: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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
    const steps = 50;
    const safeBranchesCount = Math.max(2, numBranches);

    for (let i = 0; i < safeBranchesCount; i++) {
      const t = i / (safeBranchesCount - 1);
      const targetY = originY - spreadY / 2 + t * spreadY;
      const points: RiverPathPoint[] = [];

      const exactMouthX = getCoastlineX(targetY);
      const extendedMouthX = exactMouthX - 1200;

      for (let s = 0; s <= steps; s++) {
        const stepRatio = s / steps;
        
        const baseX = originX + (extendedMouthX - originX) * stepRatio;
        const baseY = originY + (targetY - originY) * stepRatio;

        const noiseFactor = Math.sin(stepRatio * Math.PI);
        const noiseX = this.noise2D(i * 10 + stepRatio * 3, 0) * 400 * noiseFactor;
        const noiseY = this.noise2D(0, i * 10 + stepRatio * 3) * 500 * noiseFactor;

        const baseWidth = 400 * (1 - stepRatio * 0.1); 
        const widthNoise = (this.noise2D(stepRatio * 5, i) + 1) * 50;

        points.push({
          x: baseX + noiseX,
          y: baseY + noiseY,
          width: Math.max(120, baseWidth + widthNoise),
        });
      }

      // Создаем сегменты и пространственные границы (AABB) для ускорения вычислений
      const segments: RiverSegment[] = [];
      let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;

      for (let s = 0; s < points.length - 1; s++) {
        const p1 = points[s];
        const p2 = points[s + 1];
        const avgWidth = (p1.width + p2.width) / 2;
        const maxWidth = Math.max(p1.width, p2.width);

        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        segments.push({ p1, p2, minX, maxX, minY, maxY, avgWidth, maxWidth });

        if (minX < bMinX) bMinX = minX;
        if (maxX > bMaxX) bMaxX = maxX;
        if (minY < bMinY) bMinY = minY;
        if (maxY > bMaxY) bMaxY = maxY;
      }

      this.branches.push({
        points,
        segments,
        mouthX: exactMouthX,
        minX: bMinX,
        maxX: bMaxX,
        minY: bMinY,
        maxY: bMaxY,
      });
    }
  }

  public evaluate(x: number, y: number, isOceanByDefault: boolean): DeltaPointInfo | null {
    const { originX, originY, spreadY, getCoastlineX } = this.config;

    // 1. Быстрый первичный отсев по Y без вычисления шума
    const distFromCenterY = Math.abs(y - originY);
    const maxRadiusY = spreadY * 0.85;
    if (distFromCenterY > maxRadiusY + 650) return null;

    // 2. Быстрый первичный отсев по X
    const currentCoastX = getCoastlineX(y);
    if (x > originX + 1000 || x < currentCoastX - 4500) return null;

    // 3. Вычисление точного радиуса дельты с шумом
    const edgeNoise = this.noise2D(x * 0.0008, y * 0.0008) * 600;
    const effectiveRadiusY = Math.max(1, maxRadiusY + edgeNoise);

    if (distFromCenterY > effectiveRadiusY) return null;

    const falloff = Math.cos((distFromCenterY / effectiveRadiusY) * (Math.PI / 2));

    // 4. Оптимизированный поиск ближайшего русла реки с пропуском далеких веток
    let minChannelDist = Infinity;
    let currentWidth = 400;

    for (const branch of this.branches) {
      // Отсекаем ветку целиком, если точка за пределами ее влияния
      if (
        x < branch.minX - 2500 || x > branch.maxX + 2500 ||
        y < branch.minY - 2500 || y > branch.maxY + 2500
      ) {
        continue;
      }

      for (const seg of branch.segments) {
        const checkDist = seg.maxWidth * 3.5;
        if (
          x < seg.minX - checkDist || x > seg.maxX + checkDist ||
          y < seg.minY - checkDist || y > seg.maxY + checkDist
        ) {
          continue;
        }

        const dist = this.distToSegment(x, y, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
        if (dist < minChannelDist) {
          minChannelDist = dist;
          currentWidth = seg.avgWidth;
        }
      }
    }

    const safeWidth = Math.max(100, currentWidth);

    // 5. Вычисление шумов детализации только для подходящих точек
    const detailNoise = this.noise2D(x * 0.0015, y * 0.0015);
    const macroNoise = this.noise2D(x * 0.0005, y * 0.0005);

    const isInWaterChannel = minChannelDist < safeWidth * 0.55;

    const deltaXRange = Math.max(1, originX - currentCoastX);
    const oceanProgress = Math.max(0, Math.min(1, (originX - x) / deltaXRange));

    // === РЕЧНЫЕ СТРУИ И ИХ ДИФФУЗНЫЙ ГРАДИЕНТ В ОКЕАН ===
    if (isInWaterChannel) {
      if (x < currentCoastX) {
        const distIntoOcean = currentCoastX - x;
        const maxDischargeDist = 2600;

        if (distIntoOcean > maxDischargeDist) return null;

        const lengthFade = Math.pow(1 - (distIntoOcean / maxDischargeDist), 1.5);
        const maxRadius = safeWidth * 0.55;
        const edgeFade = Math.pow(1 - Math.min(1, minChannelDist / maxRadius), 0.8);

        const streamAlpha = Math.max(0, Math.min(1, lengthFade * edgeFade));

        if (isNaN(streamAlpha) || streamAlpha < 0.02) return null;

        return { 
          isWater: true, 
          biomeName: 'River Discharge Stream', 
          color: 0x3B5E33, 
          salinity: 0.1 + (1 - streamAlpha) * 0.7, 
          wetness: 1.0, 
          blendAlpha: streamAlpha 
        };
      }

      return { 
        isWater: true, 
        biomeName: 'River Channel', 
        color: 0x3B5E33, 
        salinity: oceanProgress * 0.2, 
        wetness: 1.0, 
        blendAlpha: 1.0 
      };
    }

    // === МЯГКИЙ ЭСТУАРНЫЙ ОРЕОЛ ВОКРУГ СТРУЙ ===
    if (isOceanByDefault) {
      const oceanDepth = currentCoastX - x;
      const maxPlumeReach = 3400;

      if (oceanDepth > 0 && oceanDepth < maxPlumeReach) {
        const distanceFade = 1 - (oceanDepth / maxPlumeReach);
        const streamProximity = Math.max(0, 1 - (minChannelDist / (safeWidth * 3.2)));
        
        if (streamProximity > 0) {
          const noiseVariation = 0.8 + detailNoise * 0.4;
          const blendAlpha = Math.max(0, Math.min(1, Math.pow(streamProximity * distanceFade * noiseVariation, 2.0) * 0.65));

          if (!isNaN(blendAlpha) && blendAlpha > 0.03) {
            return { 
              isWater: true, 
              biomeName: 'Estuarine Plume', 
              color: 0x2D5A43, 
              salinity: 0.3 + (1 - blendAlpha) * 0.5, 
              wetness: 1.0,
              blendAlpha: blendAlpha
            };
          }
        }
      }
      return null;
    }

    // === СУША И ПЕСЧАНЫЕ БАРЫ ===
    const localWetness = Math.max(0, Math.min(1, (1 - minChannelDist / 2200) * falloff + detailNoise * 0.2));

    if (x < currentCoastX + 900 && minChannelDist > safeWidth * 0.55 && minChannelDist < safeWidth * 1.8 && detailNoise > 0.08) {
      return { isWater: false, biomeName: 'Barrier Island', color: 0xDFC184, salinity: 0.6, wetness: 0.2, blendAlpha: 1.0 };
    }

    if (oceanProgress > 0.65 && localWetness > 0.3) {
      return { isWater: false, biomeName: 'Salt Marsh', color: 0x3D5B43, salinity: 0.7, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (localWetness > 0.5) {
      return { isWater: false, biomeName: 'Lowland Marsh', color: 0x5C7A29, salinity: 0.1, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (localWetness > 0.3 && macroNoise > 0.2 && minChannelDist > safeWidth * 2) {
      return { isWater: false, biomeName: 'Bog / Sphagnum Moor', color: 0x7A4E29, salinity: 0.0, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (minChannelDist < safeWidth * 2.8 && localWetness > 0.2) {
      return { isWater: false, biomeName: 'Flooded Forest / Mangrove', color: 0x1B381E, salinity: 0.2, wetness: localWetness, blendAlpha: 1.0 };
    }

    if (localWetness > 0.08) {
      return { isWater: false, biomeName: 'Alluvial Valley', color: 0x336B48, salinity: 0.0, wetness: 0.4, blendAlpha: 1.0 };
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
