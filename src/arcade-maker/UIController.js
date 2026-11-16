// A2703c: tab order and the one-next-step copy used by the maker UI.
// Pure data and lookups; the classic script still performs the DOM switch.

export const TAB_ORDER = ['build', 'blueprints', 'assets', 'sounds', 'custom', 'code'];

export const ARC_NEXT = {
  build: { title: 'Next: choose how it plays', text: 'Pip says: pick a genre, then change one rule so the game feels like yours.', target: 'blueprints', label: 'Open Gameplay' },
  blueprints: { title: 'Next: give it your own look', text: 'Pip says: swap the hero, background or colours so nobody mistakes it for the starter.', target: 'assets', label: 'Open Art' },
  assets: { title: 'Next: add sound', text: 'Pip says: one jump or coin sound makes the game feel finished.', target: 'sounds', label: 'Open Audio' },
  sounds: { title: 'Next: add one extra', text: 'Pip says: a power-up, boss or particle burst gives players a reason to keep going.', target: 'custom', label: 'Open Extras' },
  custom: { title: 'Next: play it', text: 'Pip says: press Run, play one round, then change the one thing that felt wrong.', target: 'run', label: 'Run the game' },
  code: { title: 'Next: play it', text: 'Pip says: run it, then come back and change one line at a time.', target: 'run', label: 'Run the game' }
};

export function tabIndex(name) {
  return TAB_ORDER.indexOf(name);
}

export function nextStep(name) {
  return ARC_NEXT[name] || null;
}

export const UIController = { TAB_ORDER, ARC_NEXT, tabIndex, nextStep };
export default UIController;
