/* ═══════════════════════════════════════════════════════════
   Cosmetics System, Game unlockables (skins, outfits, accessories)
   ═══════════════════════════════════════════════════════════ */

const COSMETICS = {
  'echo-fruit-catch': {
    'special-basket': {
      id: 'special-basket',
      name: '✨ Special Basket',
      description: 'A magical golden basket that shimmers as Echo moves.',
      rarity: 'rare',
      unlockedBy: 'quest-1-scratch-catch'
    },
    'rainbow-echo': {
      id: 'rainbow-echo',
      name: '🌈 Rainbow Echo',
      description: 'Echo takes on vibrant rainbow colors.',
      rarity: 'epic',
      unlockedBy: 'quest-3-scratch-series'
    }
  },

  'sky-high-squirt': {
    'godot-skin': {
      id: 'godot-skin',
      name: '⭐ Godot Coder Outfit',
      description: 'Squirt wears developer gear from the Godot engine.',
      rarity: 'rare',
      unlockedBy: 'quest-2-jump-jump-master'
    },
    'cloud-surfer': {
      id: 'cloud-surfer',
      name: '☁️ Cloud Surfer',
      description: 'Ride on fluffy clouds instead of jumping.',
      rarity: 'epic',
      unlockedBy: 'quest-7-sky-high'
    }
  },

  'pips-bakery-empire': {
    'golden-apron': {
      id: 'golden-apron',
      name: '👑 Golden Apron',
      description: 'A royal golden apron for the baker empire master.',
      rarity: 'rare',
      unlockedBy: 'quest-6-pip-baker'
    },
    'chef-hat': {
      id: 'chef-hat',
      name: '🎩 Master Chef Hat',
      description: 'The hat of a legendary pastry chef.',
      rarity: 'epic',
      unlockedBy: null // Available later
    }
  },

  'pastry-match': {
    'sparkle-effect': {
      id: 'sparkle-effect',
      name: '✨ Sparkle Effect',
      description: 'Matches create a shower of sparkles.',
      rarity: 'uncommon',
      unlockedBy: null
    }
  },

  'bread-blocks': {
    'glow-blocks': {
      id: 'glow-blocks',
      name: '💡 Glow Blocks',
      description: 'Blocks glow softly as they fall.',
      rarity: 'uncommon',
      unlockedBy: null
    }
  }
};

class CosmeticsManager {
  constructor() {
    this.storageKey = 'jvds_cosmetics';
    this.unlockedCosmetics = this.loadUnlocked();
  }

  loadUnlocked() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Failed to load cosmetics:', e);
      return {};
    }
  }

  saveUnlocked() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.unlockedCosmetics));
    } catch (e) {
      console.error('Failed to save cosmetics:', e);
    }
  }

  unlockCosmetic(gameId, cosmeticId) {
    if (!this.unlockedCosmetics[gameId]) {
      this.unlockedCosmetics[gameId] = [];
    }

    if (!this.unlockedCosmetics[gameId].includes(cosmeticId)) {
      this.unlockedCosmetics[gameId].push(cosmeticId);
      this.saveUnlocked();
      return true;
    }
    return false;
  }

  isUnlocked(gameId, cosmeticId) {
    return this.unlockedCosmetics[gameId] && this.unlockedCosmetics[gameId].includes(cosmeticId);
  }

  getGameCosmetics(gameId) {
    return COSMETICS[gameId] || {};
  }

  getUnlockedForGame(gameId) {
    const allCosmetics = this.getGameCosmetics(gameId);
    const unlocked = {};
    for (const [id, cosmetic] of Object.entries(allCosmetics)) {
      if (this.isUnlocked(gameId, id)) {
        unlocked[id] = cosmetic;
      }
    }
    return unlocked;
  }

  getLockedForGame(gameId) {
    const allCosmetics = this.getGameCosmetics(gameId);
    const locked = {};
    for (const [id, cosmetic] of Object.entries(allCosmetics)) {
      if (!this.isUnlocked(gameId, id)) {
        locked[id] = cosmetic;
      }
    }
    return locked;
  }

  getTotalUnlockedCount() {
    let count = 0;
    for (const gameId of Object.keys(this.unlockedCosmetics)) {
      count += this.unlockedCosmetics[gameId].length;
    }
    return count;
  }

  getTotalCosmeticCount() {
    let count = 0;
    for (const gameId of Object.keys(COSMETICS)) {
      count += Object.keys(COSMETICS[gameId]).length;
    }
    return count;
  }
}

const cosmeticsManager = new CosmeticsManager();
