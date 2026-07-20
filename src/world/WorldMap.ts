// Функция получения цвета океана с полностью плавным градиентом по всему диапазону
private getOceanColor(distRatio: number): { r: number; g: number; b: number } {
  const zones = OCEAN_ZONES_CONFIG;

  // Если вышли за левую или правую границу
  if (distRatio <= 0) return this.hexToRgb(zones[0].color);
  if (distRatio >= 1) return this.hexToRgb(zones[zones.length - 1].color);

  // Находим ключевые точки (центры зон) для построения непрерывного градиента
  let accumulatedWidth = 0;
  const stops: { pos: number; color: { r: number; g: number; b: number } }[] = [];

  for (let i = 0; i < zones.length; i++) {
    const zoneCenter = accumulatedWidth + zones[i].widthRatio / 2;
    stops.push({
      pos: zoneCenter,
      color: this.hexToRgb(zones[i].color),
    });
    accumulatedWidth += zones[i].widthRatio;
  }

  // Крайние точки зажимаем к первому и последнему цвету
  if (distRatio <= stops[0].pos) {
    return stops[0].color;
  }
  if (distRatio >= stops[stops.length - 1].pos) {
    return stops[stops.length - 1].color;
  }

  // Находим, между какими двумя ключевыми точками цвета находится текущий пиксель
  for (let i = 0; i < stops.length - 1; i++) {
    const leftStop = stops[i];
    const rightStop = stops[i + 1];

    if (distRatio >= leftStop.pos && distRatio <= rightStop.pos) {
      // Фактор смешивания от 0.0 до 1.0 между двумя центрами
      const factor = (distRatio - leftStop.pos) / (rightStop.pos - leftStop.pos);

      // Сглаживаем переходы функции через s-образную кривую (Smoothstep), чтобы не было изломов
      const smoothFactor = factor * factor * (3 - 2 * factor);

      return {
        r: Math.round(leftStop.color.r + (rightStop.color.r - leftStop.color.r) * smoothFactor),
        g: Math.round(leftStop.color.g + (rightStop.color.g - leftStop.color.g) * smoothFactor),
        b: Math.round(leftStop.color.b + (rightStop.color.b - leftStop.color.b) * smoothFactor),
      };
    }
  }

  return stops[stops.length - 1].color;
}
