// A2703b: pure grid and layer helpers for the Arcade Game Maker.
// The custom sandbox and the level importer both store a flat row-major map.

export function index(x, y, width) {
  return y * width + x;
}

export function blankMap(width, height) {
  return new Array(Math.max(0, width) * Math.max(0, height)).fill(0);
}

export function normaliseMap(map, max = 2) {
  return Array.from(map || []).map(v => Math.min(max, Math.max(0, v | 0)));
}

export function toRows(map, width) {
  const rows = [];
  const w = Math.max(1, width | 0);
  for (let i = 0; i < map.length; i += w) rows.push(map.slice(i, i + w));
  return rows;
}

export function cellAt(map, x, y, width) {
  return map[index(x, y, width)] || 0;
}

export const LevelData = { index, blankMap, normaliseMap, toRows, cellAt };
export default LevelData;
