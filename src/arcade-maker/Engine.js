// A2703d: boot configuration shared by the Arcade Game Maker.
// Pure data only, so it can be tested without Phaser or the DOM.

export const GENRE_DIMS = {
  FLAPPY: { w: 400, h: 640 },
  HOPPER: { w: 400, h: 640 },
  DODGE: { w: 400, h: 640 },
  RHYTHM: { w: 400, h: 640 },
  PINBALL: { w: 400, h: 640 },
  MEMORY: { w: 400, h: 640 },
  CLICKER: { w: 400, h: 640 },
  SNAKE: { w: 400, h: 640 },
  PAPERTOSS: { w: 400, h: 640 }
};

export function dimsFor(genre) {
  return GENRE_DIMS[genre] || { w: 640, h: 400 };
}

export const Engine = { GENRE_DIMS, dimsFor };
export default Engine;
