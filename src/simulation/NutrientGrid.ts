// src/simulation/NutrientGrid.ts

import { 
  OceanCurrentsManager, 
  UpwellingZoneType, 
  DownwellingZoneType 
} from './OceanCurrentsManager';
import { WorldMap } from '../world/WorldMap';
import { ZoneConfig } from '../world/types';

export interface GridCell {
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;

  // Данные из масок:
  isLand: boolean;                          // Суша/вода из WorldMap
  isWater: boolean;                         // Водный акваториум из OceanCurrentsManager
  zone: ZoneConfig | null;                  // Биом из ocean_zones_mask.png (WorldMap)
  upwellingType: UpwellingZoneType | null;  // Зона апвеллинга (ENTRY/EXIT) из ocean_upwelling_mask.png
  downwellingType: DownwellingZoneType | null; // Зона даунвеллинга (ENTRY/EXIT) из ocean_downwelling_mask.png

  // Сюда в дальнейшем добавим массы веществ (N, P, C и т.д.)
}

export class NutrientGrid {
  public readonly CELL_SIZE = 100;
  public readonly WORLD_SIZE = 8000;
  public readonly cols: number;
  public readonly rows: number;

  public cells: GridCell[] = [];
  private currentsManager: OceanCurrentsManager;
  private worldMap: WorldMap;

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

        // Берем центр ячейки для точной проверки пикселей масок
        const centerX = worldX + this.CELL_SIZE * 0.5;
        const centerY = worldY + this.CELL_SIZE * 0.5;

        // 1. Биом и флаг суши из WorldMap (ocean_zones_mask.png)
        const zone = this.worldMap ? this.worldMap.getZoneAt(centerX, centerY) : null;
        const isLand = zone ? Boolean(zone.isLand) : false;

        // 2. Флаг воды из OceanCurrentsManager (ocean_surface_mask / ocean_binary_mask)
        const isWater = this.currentsManager 
          ? this.currentsManager.isWater(centerX, centerY) 
          : !isLand;

        // 3. Апвеллинг (ocean_upwelling_mask.png)
        const upwellingType = this.currentsManager 
          ? this.currentsManager.getUpwellingZoneAt(centerX, centerY) 
          : null;

        // 4. Даунвеллинг (ocean_downwelling_mask.png)
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
          upwellingType,
          downwellingType
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
   * Удобный метод получения ячейки по мировым координатам (worldX, worldY)
   */
  public getCellAtWorld(worldX: number, worldY: number): GridCell | null {
    const gx = Math.floor(worldX / this.CELL_SIZE);
    const gy = Math.floor(worldY / this.CELL_SIZE);
    return this.getCell(gx, gy);
  }
}
