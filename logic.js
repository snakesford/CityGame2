// logic.js
// Core, DOM-free game logic so we can unit test with Node (see test.js)

// -----------------------------
// Utility
// -----------------------------
function formatNumber(num, decimals = 1) {
  if (num < 1000) return num.toFixed(decimals).replace(/\.0+$/, '');
  const units = [
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'k' }
  ];
  for (const u of units) {
    if (num >= u.v) {
      return (num / u.v).toFixed(decimals) + u.s;
    }
  }
  return num.toFixed(decimals);
}

// -----------------------------
// Data definitions
// -----------------------------

// Building definitions are intentionally minimal — just enough for tests.
// You can expand them later to match your full browser game.
const buildingTypes = {
  lumberMill: {
    key: 'lumberMill',
    category: 'wood',
    baseCost: {
      wood: 10
    },
    costGrowthFactor: 1.25,
    baseProduction: {
      wood: 0.6
    },
    productionGrowthFactor: 1.1
  },
  quarry: {
    key: 'quarry',
    category: 'stone',
    baseCost: {
      wood: 15,
      stone: 0
    },
    costGrowthFactor: 1.25,
    baseProduction: {
      stone: 0.3
    },
    productionGrowthFactor: 1.1
  },
  tepee: {
    key: 'tepee',
    category: 'housing',
    baseCost: {
      wood: 20,
      stone: 5
    },
    costGrowthFactor: 1.25,
    baseProduction: {
      capacity: 3
    },
    productionGrowthFactor: 1.15
  },
  farm: {
    key: 'farm',
    category: 'farming',
    baseCost: {
      wood: 30,
      stone: 10
    },
    costGrowthFactor: 1.25,
    baseProduction: {
      food: 0.5
    },
    productionGrowthFactor: 1.12
  },
  advancedFarm: {
    key: 'advancedFarm',
    category: 'farming',
    baseCost: {
      wood: 80,
      stone: 40
    },
    costGrowthFactor: 1.25,
    baseProduction: {
      food: 1.0
    },
    productionGrowthFactor: 1.12
  }
};

// Character types with the multipliers used by the tests.
const characterTypes = {
  miner: {
    id: 'miner',
    miningProductionMultiplier: 1.5,
    upgradeDiscount: 0.8
  },
  farmer: {
    id: 'farmer',
    farmingProductionMultiplier: 1.5,
    populationMultiplier: 1.3,
    buildDiscount: 0.8
  }
};

// -----------------------------
// Building math
// -----------------------------

/**
 * Compute building production given type + level + context.
 * context: { character?: 'miner' | 'farmer' | null }
 */
function getBuildingProduction(type, level = 1, context = {}) {
  const def = buildingTypes[type];
  if (!def) {
    return {
      wood: 0,
      stone: 0,
      clay: 0,
      iron: 0,
      bricks: 0,
      population: 0,
      food: 0,
      capacity: 0
    };
  }

  const factor = Math.pow(def.productionGrowthFactor || 1, Math.max(0, level - 1));
  const result = {
    wood: 0,
    stone: 0,
    clay: 0,
    iron: 0,
    bricks: 0,
    population: 0,
    food: 0,
    capacity: 0
  };

  // base production
  for (const [key, value] of Object.entries(def.baseProduction || {})) {
    result[key] = (value || 0) * factor;
  }

  const { character } = context;

  // Character-specific bonuses
  if (character === 'miner') {
    const miner = characterTypes.miner;
    if (def.category === 'stone') {
      if (result.stone) result.stone *= miner.miningProductionMultiplier;
      if (result.iron) result.iron *= miner.miningProductionMultiplier;
    }
  }

  if (character === 'farmer') {
    const farmer = characterTypes.farmer;
    if (def.category === 'farming') {
      // Farming production multiplier
      if (result.food) {
        result.food *= farmer.farmingProductionMultiplier;
      }
      if (result.population) {
        result.population *= farmer.farmingProductionMultiplier;
      }
      // Overall pop/capacity multiplier
      if (result.population) {
        result.population *= farmer.populationMultiplier;
      }
      if (result.capacity) {
        result.capacity *= farmer.populationMultiplier;
      }
    }
  }

  return result;
}

/**
 * Compute building cost given type + level + context.
 * context: { character?: 'miner' | 'farmer' | null }
 */
function getBuildingCost(type, level = 1, context = {}) {
  const def = buildingTypes[type];
  if (!def) return {};

  const { character } = context;
  const factor = Math.pow(def.costGrowthFactor || 1, Math.max(0, level - 1));
  const cost = {};

  for (const [res, v] of Object.entries(def.baseCost || {})) {
    cost[res] = Math.floor(v * factor);
  }

  // Farmer gets discount on farming buildings (level 1 only)
  if (character === 'farmer') {
    const farmer = characterTypes.farmer;
    if (def.category === 'farming' && level === 1) {
      for (const res of Object.keys(cost)) {
        cost[res] = Math.floor(cost[res] * farmer.buildDiscount);
      }
    }
  }

  // Miner gets discount on stone-category buildings (all levels)
  if (character === 'miner') {
    const miner = characterTypes.miner;
    if (def.category === 'stone') {
      for (const res of Object.keys(cost)) {
        cost[res] = Math.floor(cost[res] * miner.upgradeDiscount);
      }
    }
  }

  return cost;
}

// -----------------------------
// Game state + quests
// -----------------------------

const MAP_WIDTH = 5;
const MAP_HEIGHT = 5;

const questDefinitions = [
  {
    id: 'first_shelter',
    description: 'Build your first Tepee.',
    reward: {
      wood: 50
    },
    checkCompleted(state) {
      // Completed if any tile on the map is a tepee
      for (let y = 0; y < state.map.length; y++) {
        for (let x = 0; x < state.map[y].length; x++) {
          const tile = state.map[y][x];
          if (tile && tile.type === 'tepee') {
            return true;
          }
        }
      }
      return false;
    }
  }
];

// Create a fresh blank map
function createEmptyMap() {
  const map = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      row.push(null);
    }
    map.push(row);
  }
  return map;
}

function createInitialGameState() {
  const state = {
    character: null,
    resources: {
      wood: 50,
      stone: 0,
      clay: 0,
      iron: 0,
      gold: 0,
      bricks: 0,
      ironBars: 0,
      coal: 0
    },
    population: {
      current: 0,
      capacity: 0
    },
    upgrades: {
      woodProduction: false,
      stoneProduction: false,
      clayProduction: false,
      housingCapacity: false,
      smeltingSpeed: false
    },
    rates: {
      wps: 1, // base wood per second
      sps: 0  // base stone per second
    },
    map: createEmptyMap(),
    quests: questDefinitions.map(q => ({
      id: q.id,
      completed: false,
      claimed: false
    }))
  };

  return state;
}

// Evaluate quest completion flags based on current state
function checkQuests(state) {
  for (const qState of state.quests) {
    if (qState.completed) continue;
    const def = questDefinitions.find(q => q.id === qState.id);
    if (!def || typeof def.checkCompleted !== 'function') continue;
    if (def.checkCompleted(state)) {
      qState.completed = true;
    }
  }
}

// Claim a quest reward and mark quest as claimed
function claimQuestReward(state, questId) {
  const qState = state.quests.find(q => q.id === questId);
  if (!qState || !qState.completed || qState.claimed) return false;

  const def = questDefinitions.find(q => q.id === questId);
  if (!def) return false;

  const reward = def.reward || {};
  for (const [res, amount] of Object.entries(reward)) {
    if (!state.resources.hasOwnProperty(res)) {
      state.resources[res] = 0;
    }
    state.resources[res] += amount;
  }

  qState.claimed = true;
  return true;
}

// -----------------------------
// Shop / upgrades
// -----------------------------

function purchaseUpgrade(state, upgradeKey, cost) {
  if (!state.upgrades.hasOwnProperty(upgradeKey)) return false;
  if (state.resources.gold < cost) return false;
  if (state.upgrades[upgradeKey]) return false; // already purchased

  state.resources.gold -= cost;
  state.upgrades[upgradeKey] = true;
  return true;
}

// -----------------------------
// Production aggregation
// -----------------------------

function calculateProduction(state) {
  // Reset to base
  let woodRate = 1; // base wps
  let stoneRate = 0;
  let foodRate = 0;
  let capacity = 0;

  const ctx = { character: state.character };

  for (let y = 0; y < state.map.length; y++) {
    for (let x = 0; x < state.map[y].length; x++) {
      const tile = state.map[y][x];
      if (!tile || !tile.type) continue;

      const prod = getBuildingProduction(tile.type, tile.level || 1, ctx);

      if (prod.wood) woodRate += prod.wood;
      if (prod.stone) stoneRate += prod.stone;
      if (prod.food) foodRate += prod.food;
      if (prod.capacity) capacity += prod.capacity;
      if (prod.population) {
        // in this core logic we don't advance population per second,
        // but you could accumulate it elsewhere if desired
      }
    }
  }

  state.rates.wps = woodRate;
  state.rates.sps = stoneRate;
  state.rates.fps = foodRate;
  state.population.capacity = capacity;
}

// -----------------------------
// Exports
// -----------------------------

module.exports = {
  formatNumber,
  buildingTypes,
  characterTypes,
  getBuildingProduction,
  getBuildingCost,
  createInitialGameState,
  questDefinitions,
  checkQuests,
  claimQuestReward,
  purchaseUpgrade,
  calculateProduction,

  // For tests or potential future use:
  MAP_WIDTH,
  MAP_HEIGHT
};
