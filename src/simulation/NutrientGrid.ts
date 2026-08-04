// src/simulation/NutrientGrid.ts

import { OceanCurrentsManager } from './OceanCurrentsManager';
import type { UpwellingZoneType, DownwellingZoneType } from './OceanCurrentsManager';
import { WorldMap } from '../world/WorldMap';
import { ZoneConfig } from '../world/types';

export interface GridCell {
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;

  // Данные из 5 масок:
  isLand: boolean;                          // Суша/вода из WorldMap
  isWater: boolean;                         // Водный акваториум из OceanCurrentsManager
  zone: ZoneConfig | null;                  // Биом из ocean_zones_mask.png (WorldMap)
  streamColor: string | null;               // Цвет течения из ocean_surface_mask.png
  upwellingType: UpwellingZoneType | null;  // Зона апвеллинга из ocean_upwelling_mask.png
  downwellingType: DownwellingZoneType | null; // Зона даунвеллинга из ocean_downwelling_mask.png

  // 2-слойная химическая масса (в мг, ключ — символ элемента, напр. 'P', 'N')
  surfaceNutrients: Record<string, number>; // Взвесь в толще воды
  benthicNutrients: Record<string, number>; // Донный осадок
}

export class NutrientGrid {
  public readonly CELL_SIZE = 100;
  public readonly WORLD_SIZE = 8000;
  public readonly cols: number;
  public readonly rows: number;

  public cells: GridCell[] = [];
  public isPaused: boolean = false;

  private currentsManager: OceanCurrentsManager;
  private worldMap: WorldMap;

  // Уменьшенные коэффициенты для более медленной и плавной диффузии
  private readonly DIFFUSION_RATE = 0.02; // Медленное расплывание в секунду
  private readonly ADVECTION_SCALE = 0.08; // Плавное движение по вектору течения

  constructor(currentsManager: OceanCurrentsManager, worldMap: WorldMap) {
    this.currentsManager = currentsManager;
    this.worldMap = worldMap;

    this.cols = Math.ceil(this.WORLD_SIZE / this.CELL_SIZE);
    this.rows = Math.ceil(this.WORLD_SIZE / this.CELL_SIZE);

    this.initGrid();
  }

  /**
   * Инициализация сетки и заполнение каждой ячейки данными из всех 5 масок
   */
  public initGrid(): void {
    this.cells = new Array(this.cols * this.rows);

    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const index = cy * this.cols + cx;
        const worldX = cx * this.CELL_SIZE;
        const worldY = cy * this.CELL_SIZE;

        const centerX = worldX + this.CELL_SIZE * 0.5;
        const centerY = worldY + this.CELL_SIZE * 0.5;

        // 1. Биом и флаг суши из WorldMap (ocean_zones_mask.png)
        const zone = this.worldMap ? this.worldMap.getZoneAt(centerX, centerY) : null;
        const isLand = zone ? Boolean(zone.isLand) : false;

        // 2. Флаг воды из OceanCurrentsManager
        const isWater = this.currentsManager 
          ? this.currentsManager.isWater(centerX, centerY) 
          : !isLand;

        // 3. Цвет поверхностной струи (ocean_surface_mask.png)
        const streamColor = (this.currentsManager as any)?.getStreamColorAt 
          ? (this.currentsManager as any).getStreamColorAt(centerX, centerY) 
          : null;

        // 4. Апвеллинг (ocean_upwelling_mask.png)
        const upwellingType = this.currentsManager 
          ? this.currentsManager.getUpwellingZoneAt(centerX, centerY) 
          : null;

        // 5. Даунвеллинг (ocean_downwelling_mask.png)
        const downwellingType = this.currentsManager 
          ? this.currentsManager.getDownwellingZoneAt(centerX, centerY) 
          : null;

        this.cells[index] = {
          gridX: cx,
          gridY: cy,
          worldX,
          worldY,
          isLand,
          isWater,
          zone,
          streamColor,
          upwellingType,
          downwellingType,
          surfaceNutrients: {},
          benthicNutrients: {}
        };
      }
    }
  }

  /**
   * Получение ячейки по сеточным координатам (gx, gy)
   */
  public getCell(gridX: number, gridY: number): GridCell | null {
    if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
      return null;
    }
    return this.cells[gridY * this.cols + gridX];
  }

  /**
   * Получение ячейки по мировым координатам (worldX, worldY)
   */
  public getCellAtWorld(worldX: number, worldY: number): GridCell | null {
    const gx = Math.floor(worldX / this.CELL_SIZE);
    const gy = Math.floor(worldY / this.CELL_SIZE);
    return this.getCell(gx, gy);
  }

  /**
   * Распыление вещества Инжектором строго по водным ячейкам
   */
  public injectNutrient(
    worldX: number, 
    worldY: number, 
    elementKey: string, 
    amountMg: number, 
    brushSize: 1 | 3 | 5
  ): void {
    const centerGX = Math.floor(worldX / this.CELL_SIZE);
    const centerGY = Math.floor(worldY / this.CELL_SIZE);
    const radius = Math.floor(brushSize / 2);

    const targetCells: GridCell[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = this.getCell(centerGX + dx, centerGY + dy);
        // Инъекция разрешена строго на воде (не суша)
        if (cell && !cell.isLand && cell.isWater) {
          targetCells.push(cell);
        }
      }
    }

    if (targetCells.length === 0) return;

    const amountPerCell = amountMg / targetCells.length;
    for (const cell of targetCells) {
      cell.surfaceNutrients[elementKey] = (cell.surfaceNutrients[elementKey] || 0) + amountPerCell;
    }
  }

  /**
   * Очистить всю сетку от веществ
   */
  public clearAll(): void {
    for (const cell of this.cells) {
      cell.surfaceNutrients = {};
      cell.benthicNutrients = {};
    }
  }

  /**
   * Главный физический цикл переноса веществ
   */
  public update(deltaSeconds: number): void {
    if (this.isPaused || deltaSeconds <= 0) return;

    // Ограничиваем dt для сохранения стабильности симуляции
    const dt = Math.min(deltaSeconds, 0.1);

    // Временные буферы двойной буферизации
    const nextSurface: Record<string, number>[] = this.cells.map(c => ({ ...c.surfaceNutrients }));
    const nextBenthic: Record<string, number>[] = this.cells.map(c => ({ ...c.benthicNutrients }));

    const neighborsOffset = [
      { dx: 0, dy: -1 }, // North
      { dx: 1, dy: 0 },  // East
      { dx: 0, dy: 1 },  // South
      { dx: -1, dy: 0 }  // West
    ];

    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      // Пропуск суши
      if (cell.isLand || !cell.isWater) continue;

      const surfaceKeys = Object.keys(cell.surfaceNutrients);
      const benthicKeys = Object.keys(cell.benthicNutrients);

      // ==========================================
      // 1. ОГРАНИЧЕННАЯ МЕДЛЕННАЯ ДИФФУЗИЯ И АДВЕКЦИЯ
      // ==========================================
      for (const elem of surfaceKeys) {
        const mass = cell.surfaceNutrients[elem];
        if (!mass || mass <= 0.0001) continue;

        // --- Диффузия, ограниченная конкретной струей течения ---
        for (const offset of neighborsOffset) {
          const neighbor = this.getCell(cell.gridX + offset.dx, cell.gridY + offset.dy);
          
          // Жесткий фильтр: пропускаем сушу и сухие ячейки
          if (!neighbor || neighbor.isLand || !neighbor.isWater) continue;

          // Диффузия возможна, если ячейки принадлежат одной струе (цвету зоны)
          // Либо если обе ячейки находятся в фоновой воде без выделенных струй (streamColor === null)
          const isSameStreamZone = cell.streamColor === neighbor.streamColor;

          if (isSameStreamZone) {
            const neighborMass = neighbor.surfaceNutrients[elem] || 0;
            const massDifference = mass - neighborMass;

            if (massDifference > 0) {
              // Медленный плавный перенос доли массы
              const diffAmount = massDifference * this.DIFFUSION_RATE * dt * 0.1;

              if (diffAmount > 0) {
                nextSurface[i][elem] -= diffAmount;
                const neighborIdx = neighbor.gridY * this.cols + neighbor.gridX;
                nextSurface[neighborIdx][elem] = (nextSurface[neighborIdx][elem] || 0) + diffAmount;
              }
            }
          }
        }

        // --- Адвекция (Плавный снос по вектору течения) ---
        if (this.currentsManager) {
          const centerX = cell.worldX + this.CELL_SIZE * 0.5;
          const centerY = cell.worldY + this.CELL_SIZE * 0.5;
          const flow = (this.currentsManager as any).getVectorAt 
            ? (this.currentsManager as any).getVectorAt(centerX, centerY) 
            : null;

          if (flow && (flow.x !== 0 || flow.y !== 0)) {
            const targetGX = Math.round(cell.gridX + flow.x * this.ADVECTION_SCALE * dt);
            const targetGY = Math.round(cell.gridY + flow.y * this.ADVECTION_SCALE * dt);

            const targetCell = this.getCell(targetGX, targetGY);
            
            // Проверяем, что вектор не уносит массу на сушу
            if (targetCell && !targetCell.isLand && targetCell.isWater) {
              const shiftAmount = mass * 0.05 * dt;
              nextSurface[i][elem] -= shiftAmount;
              const targetIdx = targetCell.gridY * this.cols + targetCell.gridX;
              nextSurface[targetIdx][elem] = (nextSurface[targetIdx][elem] || 0) + shiftAmount;
            }
          }
        }
      }

      // ==========================================
      // 2. ОСЕДАНИЕ И ПОДЪЕМ ПО БИОМАМ
      // ==========================================
      const sinkRate = cell.zone?.sinkingRate ?? 0.02;      // Медленное оседание
      const riseRate = cell.zone?.resuspensionRate ?? 0.005; // Естественный подъем

      for (const elem of surfaceKeys) {
        const surfaceMass = cell.surfaceNutrients[elem] || 0;
        if (surfaceMass > 0) {
          const sinking = surfaceMass * sinkRate * dt;
          nextSurface[i][elem] -= sinking;
          nextBenthic[i][elem] = (nextBenthic[i][elem] || 0) + sinking;
        }
      }

      for (const elem of benthicKeys) {
        const benthicMass = cell.benthicNutrients[elem] || 0;
        if (benthicMass > 0) {
          const rising = benthicMass * riseRate * dt;
          nextBenthic[i][elem] -= rising;
          nextSurface[i][elem] = (nextSurface[i][elem] || 0) + rising;
        }
      }

      // ==========================================
      // 3. КОНВЕЙЕР ДАУНВЕЛЛИНГА И АПВЕЛЛИНГА
      // ==========================================
      if (cell.downwellingType && String(cell.downwellingType) === 'ENTRY') {
        for (const elem of surfaceKeys) {
          const amount = (cell.surfaceNutrients[elem] || 0) * 0.2 * dt;
          nextSurface[i][elem] -= amount;
          nextBenthic[i][elem] = (nextBenthic[i][elem] || 0) + amount;
        }
      }

      if (cell.upwellingType && String(cell.upwellingType) === 'ENTRY') {
        for (const elem of benthicKeys) {
          const amount = (cell.benthicNutrients[elem] || 0) * 0.25 * dt;
          nextBenthic[i][elem] -= amount;
          nextSurface[i][elem] = (nextSurface[i][elem] || 0) + amount;
        }
      }
    }

    // Применяем вычисленные состояния с зачисткой микроскопических остатков
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];

      for (const key in nextSurface[i]) {
        if (nextSurface[i][key] < 0.0001) delete nextSurface[i][key];
      }
      for (const key in nextBenthic[i]) {
        if (nextBenthic[i][key] < 0.0001) delete nextBenthic[i][key];
      }

      cell.surfaceNutrients = nextSurface[i];
      cell.benthicNutrients = nextBenthic[i];
    }
  }
}
