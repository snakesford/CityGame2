// Grid size
const BASE_GRID_SIZE = 15;
let GRID_SIZE = BASE_GRID_SIZE;

// Game state
let gameState = {
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
  rates: {
    wps: 1, // Base 1 wps
    sps: 0, // Stone per second
    cps: 0, // Clay per second
    ips: 0, // Iron per second
    gps: 0, // Gold per second
    bps: 0 // Bricks per second
  },
  smelters: {}, // Store smelter data: {row_col: {mineralType: 'clay'|'iron'|null, smeltingStartTime: timestamp, readyOutput: {bricks: 0, ironBars: 0}}}
  population: {
    current: 0,
    capacity: 0
  },
  map: [],
  zoomLevel: 1.0, // Zoom level for the grid (1.0 = 100%)
  character: null, // "miner" | "farmer" | null
  playerColor: null, // Player's chosen color
  playerName: null, // Player's name
  timestamp: Date.now(),
  upgrades: {
    woodProduction: false, // +20% wood production
    stoneProduction: false, // +20% stone production
    clayProduction: false, // +20% clay production
    housingCapacity: false, // +20% housing capacity
    smeltingSpeed: false // +20% smelting speed
  },
  quests: [], // Array of quest progress: [{id, completed, claimed}]
  towns: {}, // {townId: {level, questsCompleted, linkedPositions: [{row, col}], merchantUnlocks: []}}
  globalBuildingCap: 20, // Starting cap
  nextTownId: 1, // Auto-incrementing town ID
  merchantCooldowns: {
    // Track cooldowns for each resource: {resource: {totalTraded: number, cooldownStart: timestamp}}
    wood: { totalTraded: 0, cooldownStart: null },
    stone: { totalTraded: 0, cooldownStart: null },
    clay: { totalTraded: 0, cooldownStart: null }
  },
  randomEvents: {}, // Track active random events: {row_col: {type: 'wanderingTrader', spawnTime: timestamp, expiresAt: timestamp}}
  temporaryBoosts: {} // Track temporary boosts: {boostType: {multiplier: number, expiresAt: timestamp}}
};

// Player color definitions
const playerColors = {
  red: '#FF0000',
  darkblue: '#00008B',
  cyan: '#00FFFF',
  yellow: '#FFFF00',
  purple: '#800080',
  green: '#008000',
  orange: '#FFA500',
  pink: '#FFC0CB'
};

// Selected color for character selection
let selectedColor = null;

// Character types with bonuses
const characterTypes = {
  miner: {
    name: "Miner",
    icon: "⛏",
    upgradeDiscount: 0.8, // 20% discount on stone building upgrades
    miningProductionMultiplier: 1.5, // 50% bonus to stone production
    uniqueBuildings: ["deepMine", "oreRefinery"]
  },
  farmer: {
    name: "Farmer",
    icon: "🌾",
    buildDiscount: 0.8, // 20% discount on farm building placement
    farmingProductionMultiplier: 1.5, // 50% bonus to farming production
    populationMultiplier: 1.3, // 30% faster population growth
    uniqueBuildings: ["advancedFarm", "orchard"]
  }
};

// Selected building type for placement
let selectedBuildingType = null;

// Selected tile for info panel
let selectedTile = null;

// Building combos data structure
const buildingCombos = {
  townCenter: {
    id: 'townCenter',
    name: 'Town Center',
    description: 'Form a town by placing buildings in a specific 3×3 pattern with a Cabin at the center.',
    pattern: {
      center: 'Cabin',
      size: '3×3',
      buildings: [
        { position: 'Top-left', building: 'Mineral (Quarry, Iron Mine, Coal Mine, or Deep Mine)' },
        { position: 'Top', building: 'Tepee' },
        { position: 'Top-right', building: 'Farm' },
        { position: 'Right', building: 'Tepee' },
        { position: 'Bottom-right', building: 'Mineral (Quarry, Iron Mine, Coal Mine, or Deep Mine)' },
        { position: 'Bottom', building: 'Tepee' },
        { position: 'Bottom-left', building: 'Farm' },
        { position: 'Left', building: 'Tepee' }
      ],
      note: 'This pattern can be rotated in any of the 4 cardinal directions. When the pattern is detected, the center Cabin will be converted into a Town Center (Level 1).'
    },
    reward: 'Creates a Town Center that unlocks quests, merchants, and increases your building cap by 5 per town level.'
  }
};

// Edit mode state
let editMode = false;

// Format number with shorthand (k/M/B) and optional decimal places
function formatNumber(num, decimals = 2) {
  const multiplier = Math.pow(10, decimals);
  num = Math.round(num * multiplier) / multiplier;
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'k';
  return num.toFixed(decimals);
}

// Alias for backward compatibility
const formatNumberWithDecimals = formatNumber;

let tileBeingMoved = null; // {row, col, type, level}

// Shift key state for multiple building placement
let shiftHeld = false;

// ============================================
// HELPER FUNCTIONS
// ============================================

// Current grid size based on actual map dimensions
function getTargetGridSize() {
  if (!gameState.map || gameState.map.length === 0) {
    return BASE_GRID_SIZE;
  }
  // Find the maximum dimension (rows or columns) in the current map
  let maxRow = gameState.map.length;
  let maxCol = 0;
  for (let row = 0; row < gameState.map.length; row++) {
    if (gameState.map[row] && gameState.map[row].length > maxCol) {
      maxCol = gameState.map[row].length;
    }
  }
  return Math.max(maxRow, maxCol, BASE_GRID_SIZE);
}

// Grow the grid to a new size while keeping existing tiles
// NOTE: This function forces square grids. For non-square maps, use getMapBounds() instead.
// Kept for backward compatibility and initial grid setup only.
function expandMapToSize(targetSize) {
  GRID_SIZE = targetSize;
  if (!gameState.map) gameState.map = [];
  for (let row = 0; row < targetSize; row++) {
    if (!gameState.map[row]) gameState.map[row] = [];
    for (let col = 0; col < targetSize; col++) {
      if (!gameState.map[row][col]) {
        gameState.map[row][col] = {
          type: "empty",
          level: 0,
          owned: false
        };
      }
    }
  }
}

// Ensure the grid matches expansion count (used on load and reset)
// Updated to not force square expansion - just update GRID_SIZE based on actual bounds
function syncGridSizeWithState() {
  if (!gameState.map || gameState.map.length === 0) {
    // Only force square grid on initial setup
    expandMapToSize(BASE_GRID_SIZE);
    return;
  }
  
  // Update GRID_SIZE to max dimension for backward compatibility, but don't force square grid
  const bounds = getMapBounds();
  const maxDimension = Math.max(
    bounds.maxRow - bounds.minRow + 1,
    bounds.maxCol - bounds.minCol + 1,
    BASE_GRID_SIZE
  );
  GRID_SIZE = maxDimension;
}

// Get bounding box of all tiles in the map
function getMapBounds() {
  if (!gameState.map || gameState.map.length === 0) {
    return { minRow: 0, maxRow: BASE_GRID_SIZE - 1, minCol: 0, maxCol: BASE_GRID_SIZE - 1 };
  }
  
  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;
  
  // Iterate over all rows
  for (let row = 0; row < gameState.map.length; row++) {
    if (!gameState.map[row]) continue;
    // Iterate over all columns in this row (including sparse columns)
    for (let col = 0; col < gameState.map[row].length; col++) {
      if (gameState.map[row][col]) {
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
      }
    }
    // Also check for sparse columns beyond the length
    if (typeof gameState.map[row] === 'object') {
      for (let colKey in gameState.map[row]) {
        const col = parseInt(colKey);
        if (!isNaN(col) && col >= gameState.map[row].length && gameState.map[row][col]) {
          minRow = Math.min(minRow, row);
          maxRow = Math.max(maxRow, row);
          minCol = Math.min(minCol, col);
          maxCol = Math.max(maxCol, col);
        }
      }
    }
  }
  
  // If no tiles found, return default bounds
  if (minRow === Infinity) {
    return { minRow: 0, maxRow: BASE_GRID_SIZE - 1, minCol: 0, maxCol: BASE_GRID_SIZE - 1 };
  }
  
  return { minRow, maxRow, minCol, maxCol };
}

// Get or create a tile at the specified coordinates (supports sparse arrays)
function getOrCreateTile(row, col) {
  if (!gameState.map) gameState.map = [];
  
  // Ensure row exists
  if (!gameState.map[row]) {
    gameState.map[row] = [];
  }
  
  // Ensure column exists and initialize if needed
  if (!gameState.map[row][col]) {
    gameState.map[row][col] = {
      type: "empty",
      level: 0,
      owned: false
    };
  }
  
  return gameState.map[row][col];
}

// Iterate over all tiles with a callback: callback(tile, row, col)
function forEachTile(callback) {
  const bounds = getMapBounds();
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    if (!gameState.map[row]) continue;
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      if (gameState.map[row][col]) {
        callback(gameState.map[row][col], row, col);
      }
    }
  }
}

// Count buildings of a given type
function countBuildings(buildingType) {
  let count = 0;
  forEachTile(tile => {
    if (tile.type === buildingType) count++;
  });
  return count;
}

// Check if at least one building of a type exists
function hasBuilding(buildingType) {
  const bounds = getMapBounds();
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    if (!gameState.map[row]) continue;
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      if (gameState.map[row][col] && gameState.map[row][col].type === buildingType) {
        return true;
      }
    }
  }
  return false;
}

// Find any building matching a predicate: predicate(tile) => boolean
function findBuilding(predicate) {
  const bounds = getMapBounds();
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    if (!gameState.map[row]) continue;
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      if (gameState.map[row][col] && predicate(gameState.map[row][col])) {
        return { tile: gameState.map[row][col], row, col };
      }
    }
  }
  return null;
}

// Check if player can afford a cost object
function canAfford(cost) {
  return gameState.resources.wood >= (cost.wood || 0) &&
         gameState.resources.stone >= (cost.stone || 0) &&
         gameState.resources.clay >= (cost.clay || 0) &&
         gameState.resources.iron >= (cost.iron || 0) &&
         gameState.resources.bricks >= (cost.bricks || 0) &&
         gameState.resources.gold >= (cost.gold || 0) &&
         gameState.resources.ironBars >= (cost.ironBars || 0);
}

// Deduct cost from player resources
function deductCost(cost) {
  gameState.resources.wood -= cost.wood || 0;
  gameState.resources.stone -= cost.stone || 0;
  gameState.resources.clay -= cost.clay || 0;
  gameState.resources.iron -= cost.iron || 0;
  gameState.resources.bricks -= cost.bricks || 0;
  gameState.resources.gold -= cost.gold || 0;
  gameState.resources.ironBars -= cost.ironBars || 0;
}

// Generate smelter key from row/col
function smelterKey(row, col) {
  return `${row}_${col}`;
}

// Migrate old save data to new format (backward compatibility)
function migrateSaveData() {
  // Ensure character field exists
  if (!gameState.character) gameState.character = null;
  
  // Ensure playerColor field exists
  if (!gameState.playerColor) gameState.playerColor = null;
  
  // Ensure playerName field exists
  if (!gameState.playerName) gameState.playerName = null;
  
  // Ensure resource fields exist
  if (!gameState.resources.ironBars) gameState.resources.ironBars = 0;
  if (!gameState.resources.coal) gameState.resources.coal = 0;
  
  // Ensure merchant cooldowns exist
  if (!gameState.merchantCooldowns) {
    gameState.merchantCooldowns = {
      wood: { totalTraded: 0, cooldownStart: null },
      stone: { totalTraded: 0, cooldownStart: null },
      clay: { totalTraded: 0, cooldownStart: null }
    };
  } else {
    // Ensure each resource has cooldown tracking
    ['wood', 'stone', 'clay'].forEach(resource => {
      if (!gameState.merchantCooldowns[resource]) {
        gameState.merchantCooldowns[resource] = { totalTraded: 0, cooldownStart: null };
      }
      // Ensure both properties exist
      if (gameState.merchantCooldowns[resource].totalTraded === undefined) {
        gameState.merchantCooldowns[resource].totalTraded = 0;
      }
      if (gameState.merchantCooldowns[resource].cooldownStart === undefined) {
        gameState.merchantCooldowns[resource].cooldownStart = null;
      }
    });
  }
  
  // Migrate old "kilns" to "smelters"
  if (gameState.kilns && !gameState.smelters) {
    gameState.smelters = gameState.kilns;
    delete gameState.kilns;
  }
  if (!gameState.smelters) gameState.smelters = {};
  
  // Migrate old smelter data to new format
  for (const key in gameState.smelters) {
    const smelter = gameState.smelters[key];
    if (!smelter) continue;
    
    if (smelter.hasOwnProperty('clay') || smelter.hasOwnProperty('iron')) {
      // Convert old format to new queue format
      gameState.smelters[key] = {
        queue: [],
        fuel: 0,
        coal: 0,
        clayBatchesWithCoal: 0,
        smeltingStartTime: smelter.smeltingStartTime || null,
        readyOutput: { bricks: smelter.bricks || 0, ironBars: smelter.ironBars || 0 }
      };
      if (smelter.smeltingType && smelter.amount > 0) {
        for (let i = 0; i < smelter.amount; i++) {
          gameState.smelters[key].queue.push({ type: smelter.smeltingType });
        }
      }
    } else {
      ensureSmelterFields(smelter);
    }
  }
  
  // Ensure map is initialized
  if (!gameState.map || gameState.map.length === 0) {
    initializeGrid();
  }
  
  // Remove old expansionsPurchased field if it exists (legacy cleanup)
  if (gameState.expansionsPurchased !== undefined) {
    delete gameState.expansionsPurchased;
  }
  
  // Update GRID_SIZE based on actual map dimensions (don't force square grid)
  if (gameState.map && gameState.map.length > 0) {
    syncGridSizeWithState();
  }
  
  // Ensure town system fields exist
  if (!gameState.towns) gameState.towns = {};
  if (typeof gameState.globalBuildingCap !== 'number') gameState.globalBuildingCap = 20;
  if (typeof gameState.nextTownId !== 'number') gameState.nextTownId = 1;
  
  // Recalculate building cap from existing towns (safety check)
  if (Object.keys(gameState.towns).length > 0) {
    updateBuildingCap();
  }
  
  // Migrate old building types and ensure owned property exists
  if (gameState.map && gameState.map.length > 0) {
    for (let row = 0; row < gameState.map.length; row++) {
      for (let col = 0; col < gameState.map[row].length; col++) {
        const tile = gameState.map[row][col];
        if (!tile) continue;
        
        if (tile.type === "house") {
          tile.type = "tepee";
        }
        if (tile.type === "brickKiln") {
          tile.type = "smelter";
        }
        
        // Ensure owned property exists (for old saves)
        if (tile.owned === undefined) {
          tile.owned = false;
        }
      }
    }
  }
  
  // Ensure upgrades field exists
  if (!gameState.upgrades) {
    gameState.upgrades = {
      woodProduction: false,
      stoneProduction: false,
      clayProduction: false,
      housingCapacity: false,
      smeltingSpeed: false
    };
  }
  
  // Ensure quests field exists
  if (!gameState.quests || !Array.isArray(gameState.quests)) {
    gameState.quests = [];
  }
  
  // Ensure randomEvents field exists
  if (!gameState.randomEvents) {
    gameState.randomEvents = {};
  }
  
  // Ensure temporaryBoosts field exists
  if (!gameState.temporaryBoosts) {
    gameState.temporaryBoosts = {};
  }
  
  // Ensure traderUpgrades field exists
  if (!gameState.traderUpgrades) {
    gameState.traderUpgrades = {};
  }
  
  // Restore building unlock states
  if (gameState.buildingUnlocks) {
    for (const [key, unlocked] of Object.entries(gameState.buildingUnlocks)) {
      if (buildingTypes[key]) {
        buildingTypes[key].unlocked = unlocked;
      }
    }
  }
}

// Toggle modal visibility with optional onShow callback
function toggleModal(modalId, onShow) {
  const modal = document.getElementById(modalId);
  if (!modal) return false;
  const isHidden = modal.style.display === 'none' || modal.style.display === '';
  modal.style.display = isHidden ? 'flex' : 'none';
  if (isHidden && onShow) onShow();
  return isHidden;
}

// Get or initialize smelter data for a given position
function getSmelter(row, col, createIfMissing = true) {
  if (!gameState.smelters) gameState.smelters = {};
  const key = smelterKey(row, col);
  if (!gameState.smelters[key] && createIfMissing) {
    gameState.smelters[key] = {
      queue: [],
      fuel: 0,
      coal: 0,
      clayBatchesWithCoal: 0,
      smeltingStartTime: null,
      readyOutput: { bricks: 0, ironBars: 0 }
    };
  }
  return gameState.smelters[key] || null;
}

// Ensure smelter data has all required fields (for old saves)
function ensureSmelterFields(smelter) {
  if (!smelter) return smelter;
  if (!smelter.queue) {
    smelter.queue = [];
    if (smelter.mineralType && smelter.amount > 0) {
      for (let i = 0; i < smelter.amount; i++) {
        smelter.queue.push({ type: smelter.mineralType });
      }
    }
  }
  if (smelter.fuel === undefined) smelter.fuel = 0;
  if (smelter.coal === undefined) smelter.coal = 0;
  if (smelter.clayBatchesWithCoal === undefined) smelter.clayBatchesWithCoal = 0;
  if (smelter.smeltingStartTime === undefined) smelter.smeltingStartTime = null;
  if (!smelter.readyOutput) smelter.readyOutput = { bricks: 0, ironBars: 0 };
  if (smelter.readyOutput.bricks === undefined) smelter.readyOutput.bricks = 0;
  if (smelter.readyOutput.ironBars === undefined) smelter.readyOutput.ironBars = 0;
  return smelter;
}

// Quest definitions are now loaded dynamically from quests.json via loadQuestsFromJson()
// The questDefinitions and townQuestDefinitions arrays are populated by the loader
// See questRegistry below for quest logic (checkCondition functions, etc.)

// Quest registry: maps quest IDs to their checkCondition functions and special effects
// This keeps all quest logic in JavaScript while data lives in JSON
const questRegistry = {
  // Global quests
  'first_shelter': {
    checkCondition: () => hasBuilding('tepee')
  },
  'basic_sustenance': {
    checkCondition: () => hasBuilding('farm')
  },
  'timber': {
    checkCondition: () => gameState.rates.wps >= 5
  },
  'growing_community': {
    checkCondition: () => gameState.population.current >= 10
  },
  'stone_age': {
    checkCondition: () => hasBuilding('quarry')
  },
  'expansion': {
    checkCondition: () => findBuilding(tile => tile.level >= 2) !== null
  },
  'clay_industry': {
    checkCondition: () => hasBuilding('clayPool') && gameState.resources.clay >= 100
  },
  'firing_up': {
    checkCondition: () => hasBuilding('smelter')
  },
  'master_smelter': {
    checkCondition: () => gameState.resources.bricks >= 20
  },
  'urban_living': {
    checkCondition: () => hasBuilding('brickHouse')
  },
  // Milestone quests
  'milestone_cabin': {
    checkCondition: () => countBuildings('tepee') >= 3,
    unlocksBuilding: 'cabin'
  },
  'milestone_advancedFarm': {
    checkCondition: () => countBuildings('farm') >= 2 && gameState.population.current >= 10,
    unlocksBuilding: 'advancedFarm'
  },
  'milestone_advancedLumberMill': {
    checkCondition: () => hasBuilding('lumberMill') && gameState.resources.wood >= 50,
    unlocksBuilding: 'advancedLumberMill'
  },
  'milestone_clayPool': {
    checkCondition: () => hasBuilding('quarry') && gameState.resources.stone >= 30,
    unlocksBuilding: 'clayPool'
  },
  'milestone_smelter': {
    checkCondition: () => gameState.resources.clay >= 10 && gameState.resources.stone >= 40 && hasBuilding('lumberMill'),
    unlocksBuilding: 'smelter'
  },
  'milestone_brickHouse': {
    checkCondition: () => hasBuilding('smelter') && gameState.resources.bricks >= 20,
    unlocksBuilding: 'brickHouse'
  },
  'milestone_deepMine': {
    checkCondition: () => gameState.resources.stone >= 50 && hasBuilding('ironMine'),
    unlocksBuilding: 'deepMine'
  },
  'milestone_oreRefinery': {
    checkCondition: () => hasBuilding('deepMine') && gameState.resources.stone >= 100,
    unlocksBuilding: 'oreRefinery'
  },
  'milestone_orchard': {
    checkCondition: () => hasBuilding('advancedFarm') && gameState.population.current >= 20,
    unlocksBuilding: 'orchard'
  },
  // Town quests
  'town_quest_L1': {
    checkCondition: () => getBuildingCount() >= 5,
    buildingCapReward: 5,
    merchantUnlock: 'merchant_tier1'
  },
  'town_quest_L2': {
    checkCondition: () => gameState.resources.wood >= 100,
    buildingCapReward: 5,
    merchantUnlock: null
  },
  'town_quest_L3': {
    checkCondition: () => countBuildings('farm') >= 3,
    buildingCapReward: 5,
    merchantUnlock: 'merchant_tier2'
  },
  'town_quest_L4': {
    checkCondition: () => gameState.population.current >= 20,
    buildingCapReward: 5,
    merchantUnlock: null
  },
  'town_quest_L5': {
    checkCondition: () => gameState.resources.gold >= 50,
    buildingCapReward: 5,
    merchantUnlock: null
  },
  'town_quest_L6': {
    checkCondition: () => countBuildings('quarry') >= 2,
    buildingCapReward: 5,
    merchantUnlock: 'merchant_tier3'
  },
  'town_quest_L7': {
    checkCondition: () => gameState.resources.bricks >= 30,
    buildingCapReward: 5,
    merchantUnlock: null
  },
  'town_quest_L8': {
    checkCondition: () => getBuildingCount() >= 10,
    buildingCapReward: 5,
    merchantUnlock: null
  },
  'town_quest_L9': {
    checkCondition: () => gameState.population.current >= 50,
    buildingCapReward: 5,
    merchantUnlock: null
  },
  'town_quest_L10': {
    checkCondition: () => gameState.resources.gold >= 200,
    buildingCapReward: 5,
    merchantUnlock: 'merchant_tier4'
  }
};

// Data storage: maps quest IDs to their JSON data
let questDataById = {};
let townQuestDataById = {};

// Quest definitions arrays (populated by loader)
let questDefinitions = [];
let townQuestDefinitions = [];

// Helper function to process quest data and combine with registry logic
function processQuestData(data) {
  // Populate data maps
  questDataById = {};
  townQuestDataById = {};
  
  if (data.globalQuests) {
    data.globalQuests.forEach(quest => {
      questDataById[quest.id] = quest;
    });
  }
  
  if (data.townQuests) {
    data.townQuests.forEach(quest => {
      townQuestDataById[quest.id] = quest;
    });
  }
  
  // Create questDefinitions array by combining JSON data with registry logic
  questDefinitions = [];
  if (data.globalQuests) {
    data.globalQuests.forEach(questData => {
      const registryEntry = questRegistry[questData.id];
      if (!registryEntry) {
        console.warn(`No registry entry found for quest: ${questData.id}`);
        return;
      }
      
      const questDef = {
        id: questData.id,
        title: questData.title,
        description: questData.description,
        reward: questData.reward || {},
        checkCondition: registryEntry.checkCondition
      };
      
      // Add optional fields from JSON
      if (questData.unlocksBuilding) {
        questDef.unlocksBuilding = questData.unlocksBuilding;
      }
      if (questData.requirements) {
        questDef.requirements = questData.requirements;
      }
      
      questDefinitions.push(questDef);
    });
  }
  
  // Create townQuestDefinitions array by combining JSON data with registry logic
  townQuestDefinitions = [];
  if (data.townQuests) {
    data.townQuests.forEach(questData => {
      const registryEntry = questRegistry[questData.id];
      if (!registryEntry) {
        console.warn(`No registry entry found for town quest: ${questData.id}`);
        return;
      }
      
      const questDef = {
        id: questData.id,
        level: questData.level,
        description: questData.description,
        checkCondition: registryEntry.checkCondition,
        buildingCapReward: questData.buildingCapReward,
        merchantUnlock: questData.merchantUnlock
      };
      
      townQuestDefinitions.push(questDef);
    });
  }
}

// Load quests from JSON file and combine with registry logic
async function loadQuestsFromJson() {
  // Check if we're running from file:// protocol (local file system)
  // In this case, fetch() won't work due to CORS restrictions
  if (window.location.protocol === 'file:') {
    console.warn('Cannot load quests.json from file:// protocol due to browser security restrictions.');
    console.warn('Please use a local web server (e.g., python -m http.server or npx http-server).');
    console.warn('The game will run but quests will not be available.');
    // Initialize empty arrays - game will run but without quests
    questDefinitions = [];
    townQuestDefinitions = [];
    questDataById = {};
    townQuestDataById = {};
    return false;
  }
  
  try {
    const response = await fetch('quests.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Process the quest data
    processQuestData(data);
    console.log('Quests loaded successfully from quests.json');
    return true;
  } catch (error) {
    console.error('ERROR: Failed to load quests.json:', error.message);
    console.error('The game will run but quests will not be available.');
    // Initialize empty arrays - game will run but without quests
    questDefinitions = [];
    townQuestDefinitions = [];
    questDataById = {};
    townQuestDataById = {};
    return false;
  }
}

// Merchant definitions
const merchantDefinitions = {
  merchant_tier1: {
    id: 'merchant_tier1',
    name: 'Basic Trader',
    unlockLevel: 1,
    trades: [
      {
        id: 'sell_wood',
        name: 'Sell Wood',
        description: 'Sell 10 wood for 1 gold',
        cost: { wood: 10 },
        reward: { gold: 1 },
        type: 'resource_trade',
        resource: 'wood',
        exchangeRate: 10
      },
      {
        id: 'sell_stone',
        name: 'Sell Stone',
        description: 'Sell 10 stone for 1 gold',
        cost: { stone: 10 },
        reward: { gold: 1 },
        type: 'resource_trade',
        resource: 'stone',
        exchangeRate: 10
      },
      {
        id: 'sell_clay',
        name: 'Sell Clay',
        description: 'Sell 10 clay for 1 gold',
        cost: { clay: 10 },
        reward: { gold: 1 },
        type: 'resource_trade',
        resource: 'clay',
        exchangeRate: 10
      }
    ]
  },
  merchant_tier2: {
    id: 'merchant_tier2',
    name: 'Rare Goods Trader',
    unlockLevel: 3,
    trades: [
      {
        id: 'sell_iron',
        name: 'Sell Iron',
        description: 'Sell 5 iron for 2 gold',
        cost: { iron: 5 },
        reward: { gold: 2 },
        type: 'resource_trade'
      },
      {
        id: 'sell_coal',
        name: 'Sell Coal',
        description: 'Sell 5 coal for 2 gold',
        cost: { coal: 5 },
        reward: { gold: 2 },
        type: 'resource_trade'
      },
      {
        id: 'buy_wood',
        name: 'Buy Wood',
        description: 'Buy 8 wood for 1 gold',
        cost: { gold: 1 },
        reward: { wood: 8 },
        type: 'resource_trade'
      }
    ]
  },
  merchant_tier3: {
    id: 'merchant_tier3',
    name: 'Boost Merchant',
    unlockLevel: 6,
    trades: [
      {
        id: 'production_boost_wood',
        name: 'Wood Production Boost',
        description: '+50% wood production for 5 minutes (50 gold)',
        cost: { gold: 50 },
        reward: { boost: 'woodProduction', duration: 300000 }, // 5 minutes in ms
        type: 'boost'
      },
      {
        id: 'production_boost_stone',
        name: 'Stone Production Boost',
        description: '+50% stone production for 5 minutes (50 gold)',
        cost: { gold: 50 },
        reward: { boost: 'stoneProduction', duration: 300000 },
        type: 'boost'
      },
      {
        id: 'building_discount',
        name: 'Building Discount',
        description: '20% discount on next 3 buildings (75 gold)',
        cost: { gold: 75 },
        reward: { discount: 0.8, uses: 3 },
        type: 'upgrade'
      }
    ]
  },
  merchant_tier4: {
    id: 'merchant_tier4',
    name: 'Master Merchant',
    unlockLevel: 10,
    trades: [
      {
        id: 'permanent_wood_boost',
        name: 'Permanent Wood Boost',
        description: 'Permanent +10% wood production (200 gold)',
        cost: { gold: 200 },
        reward: { permanentUpgrade: 'woodProduction' },
        type: 'permanent_upgrade'
      },
      {
        id: 'permanent_stone_boost',
        name: 'Permanent Stone Boost',
        description: 'Permanent +10% stone production (200 gold)',
        cost: { gold: 200 },
        reward: { permanentUpgrade: 'stoneProduction' },
        type: 'permanent_upgrade'
      },
      {
        id: 'extra_building_cap',
        name: 'Extra Building Capacity',
        description: '+10 permanent building capacity (300 gold)',
        cost: { gold: 300 },
        reward: { extraBuildingCap: 10 },
        type: 'permanent_upgrade'
      }
    ]
  }
};

// Wandering Trader trade definitions
const wanderingTraderTrades = {
  // Rare Resources
  buyIron: {
    id: 'buyIron',
    name: 'Buy Iron',
    description: 'Purchase 10 iron for 15 gold',
    cost: { gold: 15 },
    reward: { iron: 10 },
    type: 'resource_purchase'
  },
  buyCoal: {
    id: 'buyCoal',
    name: 'Buy Coal',
    description: 'Purchase 10 coal for 15 gold',
    cost: { gold: 15 },
    reward: { coal: 10 },
    type: 'resource_purchase'
  },
  buyIronBars: {
    id: 'buyIronBars',
    name: 'Buy Iron Bars',
    description: 'Purchase 5 iron bars for 25 gold',
    cost: { gold: 25 },
    reward: { ironBars: 5 },
    type: 'resource_purchase'
  },
  
  // Temporary Boosts (5 minutes)
  boostWood: {
    id: 'boostWood',
    name: 'Wood Production Boost',
    description: '+50% wood production for 5 minutes',
    cost: { gold: 40 },
    reward: { boost: 'woodProduction', multiplier: 1.5, duration: 300000 },
    type: 'temporary_boost'
  },
  boostStone: {
    id: 'boostStone',
    name: 'Stone Production Boost',
    description: '+50% stone production for 5 minutes',
    cost: { gold: 40 },
    reward: { boost: 'stoneProduction', multiplier: 1.5, duration: 300000 },
    type: 'temporary_boost'
  },
  boostClay: {
    id: 'boostClay',
    name: 'Clay Production Boost',
    description: '+50% clay production for 5 minutes',
    cost: { gold: 40 },
    reward: { boost: 'clayProduction', multiplier: 1.5, duration: 300000 },
    type: 'temporary_boost'
  },
  boostIron: {
    id: 'boostIron',
    name: 'Iron Production Boost',
    description: '+50% iron production for 5 minutes',
    cost: { gold: 50 },
    reward: { boost: 'ironProduction', multiplier: 1.5, duration: 300000 },
    type: 'temporary_boost'
  },
  
  // Permanent Upgrades
  permanentWoodBoost: {
    id: 'permanentWoodBoost',
    name: 'Permanent Wood Boost',
    description: 'Permanent +15% wood production',
    cost: { gold: 150 },
    reward: { permanentUpgrade: 'woodProduction' },
    type: 'permanent_upgrade'
  },
  permanentStoneBoost: {
    id: 'permanentStoneBoost',
    name: 'Permanent Stone Boost',
    description: 'Permanent +15% stone production',
    cost: { gold: 150 },
    reward: { permanentUpgrade: 'stoneProduction' },
    type: 'permanent_upgrade'
  },
  
  // Bargain Trades (better rates)
  bargainWood: {
    id: 'bargainWood',
    name: 'Bargain: Sell Wood',
    description: 'Sell 8 wood for 1 gold (better rate!)',
    cost: { wood: 8 },
    reward: { gold: 1 },
    type: 'bargain_trade',
    resource: 'wood'
  },
  bargainStone: {
    id: 'bargainStone',
    name: 'Bargain: Sell Stone',
    description: 'Sell 8 stone for 1 gold (better rate!)',
    cost: { stone: 8 },
    reward: { gold: 1 },
    type: 'bargain_trade',
    resource: 'stone'
  },
  bargainClay: {
    id: 'bargainClay',
    name: 'Bargain: Sell Clay',
    description: 'Sell 8 clay for 1 gold (better rate!)',
    cost: { clay: 8 },
    reward: { gold: 1 },
    type: 'bargain_trade',
    resource: 'clay'
  }
};

// Building type definitions
const buildingTypes = {
  tepee: {
    displayName: "Tepee",
    category: "housing",
    baseCost: { wood: 20, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, population: 0, capacity: 3 },
    productionGrowthFactor: 1.2,
    maxLevel: null, // Infinite
    unlocked: true
  },
  farm: {
    displayName: "Farm",
    category: "farming",
    baseCost: { wood: 20, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, population: 0.4, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: true
  },
  lumberMill: {
    displayName: "Lumber Mill",
    category: "wood",
    baseCost: { wood: 35, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0.6, stone: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: true
  },
  quarry: {
    displayName: "Quarry",
    category: "stone",
    baseCost: { wood: 40, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0.3, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: true
  },
  clayPool: {
    displayName: "Clay Pool",
    category: "stone",
    baseCost: { wood: 30, stone: 15 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, clay: 0.4, iron: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false
  },
  ironMine: {
    displayName: "Iron Mine",
    category: "stone",
    baseCost: { wood: 50, stone: 30 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0.5, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: true
  },
  coalMine: {
    displayName: "Coal Mine",
    category: "stone",
    baseCost: { wood: 60, stone: 40 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, coal: 0.3, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: true
  },
  cabin: {
    displayName: "Cabin",
    category: "housing",
    baseCost: { wood: 50, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, population: 0, capacity: 8 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false
  },
  advancedFarm: {
    displayName: "Advanced Farm",
    category: "farming",
    baseCost: { wood: 60, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, population: 1.0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false,
    requiredCharacter: "farmer" // Farmer-only building
  },
  advancedLumberMill: {
    displayName: "Advanced Lumber Mill",
    category: "wood",
    baseCost: { wood: 80, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 1.8, stone: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false
  },
  deepMine: {
    displayName: "Deep Mine",
    category: "stone",
    baseCost: { wood: 100, stone: 20 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0.8, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false,
    requiredCharacter: "miner" // Miner-only building
  },
  oreRefinery: {
    displayName: "Ore Refinery",
    category: "stone",
    baseCost: { wood: 150, stone: 50 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 1.5, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false,
    requiredCharacter: "miner" // Miner-only building
  },
  orchard: {
    displayName: "Orchard",
    category: "farming",
    baseCost: { wood: 120, stone: 0 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, population: 2.0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false,
    requiredCharacter: "farmer" // Farmer-only building
  },
  smelter: {
    displayName: "Smelter",
    category: "production",
    baseCost: { wood: 60, stone: 20 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false,
    smeltClayTime: 5000, // 5 seconds in milliseconds
    smeltIronTime: 10000, // 10 seconds in milliseconds
    smeltClayAmount: 2, // Amount of clay per smelt batch
    smeltIronAmount: 10, // Amount of iron per smelt batch
    smeltClayWoodAmount: 1, // Amount of wood fuel per clay batch
    smeltIronWoodAmount: 15, // Amount of wood fuel per iron batch
    smeltClayCoalAmount: 1, // Amount of coal fuel per 3 clay batches (1 coal = 3 batches)
    smeltIronCoalAmount: 5, // Amount of coal fuel per iron batch
    smeltBrickOutput: 1, // Bricks produced per batch
    smeltIronBarOutput: 1, // Iron bars produced per batch
    baseFuelCapacity: 100 // Base fuel storage capacity
  },
  brickHouse: {
    displayName: "Brick House",
    category: "housing",
    baseCost: { wood: 30, bricks: 40 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 12 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: false
  },
  baseMarker: {
    displayName: "Base Marker",
    category: "special",
    baseCost: { wood: 150, gold: 400, iron: 20 },
    costGrowthFactor: 1.3,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.2,
    maxLevel: null,
    unlocked: true
  },
  townCenter_L1: {
    displayName: "Town Center (Level 1)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false // Cannot be built directly
  },
  townCenter_L2: {
    displayName: "Town Center (Level 2)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L3: {
    displayName: "Town Center (Level 3)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L4: {
    displayName: "Town Center (Level 4)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L5: {
    displayName: "Town Center (Level 5)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L6: {
    displayName: "Town Center (Level 6)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L7: {
    displayName: "Town Center (Level 7)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L8: {
    displayName: "Town Center (Level 8)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L9: {
    displayName: "Town Center (Level 9)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  },
  townCenter_L10: {
    displayName: "Town Center (Level 10)",
    category: "special",
    baseCost: {},
    costGrowthFactor: 1.0,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.0,
    maxLevel: null,
    unlocked: false
  }
};

// Building icon mapping
const buildingIcons = {
  tepee: 'images/tepee.png',
  cabin: 'images/cabin.png',
  brickHouse: 'images/brickHouse.png',
  farm: 'images/Farm.png',
  advancedFarm: 'images/AdvancedFarm.png',
  orchard: 'images/orchard.png',
  lumberMill: 'images/wood-log.png',
  advancedLumberMill: 'images/wood-log.png',
  quarry: 'images/rock.png',
  clayPool: 'images/clay.png',
  ironMine: 'images/iron.png',
  deepMine: 'images/pickaxe.png',
  oreRefinery: 'images/gold.png',
  smelter: 'images/kiln.png',
  baseMarker: 'images/baseMarker.png',
  townCenter_L1: 'images/cabin.png',
  townCenter_L2: 'images/cabin.png',
  townCenter_L3: 'images/cabin.png',
  townCenter_L4: 'images/cabin.png',
  townCenter_L5: 'images/cabin.png',
  townCenter_L6: 'images/cabin.png',
  townCenter_L7: 'images/cabin.png',
  townCenter_L8: 'images/cabin.png',
  townCenter_L9: 'images/cabin.png',
  townCenter_L10: 'images/cabin.png'
};

// Resource icons for requirements
const resourceIcons = {
  wood: 'images/wood-log.png',
  stone: 'images/rock.png',
  clay: 'images/clay.png',
  iron: 'images/iron.png',
  bricks: 'images/claybricks.png',
  population: 'images/population.png'
};

// Building category colors - matches cell tile colors exactly
function getCategoryColors(category, buildingType) {
  // Match specific building types to their exact cell tile colors
  switch (buildingType) {
    case 'tepee':
      return {
        gradient: 'linear-gradient(135deg, #EF6C00 0%, #FB8C00 100%)',
        border: '#FF9800'
      };
    case 'cabin':
      return {
        gradient: 'linear-gradient(135deg, #FF9800 0%, #FFB74D 100%)',
        border: '#FFB74D'
      };
    case 'brickHouse':
      return {
        gradient: 'linear-gradient(135deg, #BF360C 0%, #8E2E00 100%)',
        border: '#D84315'
      };
    case 'farm':
      return {
        gradient: 'linear-gradient(135deg, #2d5016 0%, #3d6b1f 100%)',
        border: '#4a7c2a'
      };
    case 'advancedFarm':
      return {
        gradient: 'linear-gradient(135deg, #4a7c2a 0%, #6b9e3d 100%)',
        border: '#6b9e3d'
      };
    case 'orchard':
      return {
        gradient: 'linear-gradient(135deg, #6b9e3d 0%, #8BC34A 100%)',
        border: '#9CCC65'
      };
    case 'lumberMill':
      return {
        gradient: 'linear-gradient(135deg, #5D4037 0%, #6D4C41 100%)',
        border: '#8D6E63'
      };
    case 'advancedLumberMill':
      return {
        gradient: 'linear-gradient(135deg, #6D4C41 0%, #8D6E63 100%)',
        border: '#A1887F'
      };
    case 'quarry':
      return {
        gradient: 'linear-gradient(135deg, #616161 0%, #757575 100%)',
        border: '#9E9E9E'
      };
    case 'clayPool':
      return {
        gradient: 'linear-gradient(135deg, #8D6E63 0%, #A1887F 100%)',
        border: '#BCAAA4'
      };
    case 'ironMine':
      return {
        gradient: 'linear-gradient(135deg, #424242 0%, #616161 100%)',
        border: '#757575'
      };
    case 'coalMine':
      return {
        gradient: 'linear-gradient(135deg, #212121 0%, #424242 100%)',
        border: '#616161'
      };
    case 'deepMine':
      return {
        gradient: 'linear-gradient(135deg, #424242 0%, #616161 100%)',
        border: '#757575'
      };
    case 'oreRefinery':
      return {
        gradient: 'linear-gradient(135deg, #616161 0%, #757575 100%)',
        border: '#9E9E9E'
      };
        case 'smelter':
      return {
        gradient: 'linear-gradient(135deg, #8D6E63 0%, #A1887F 100%)',
        border: '#BCAAA4'
      };
    case 'baseMarker':
      return {
        gradient: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
        border: '#AB47BC'
      };
    default:
      // Fallback to category-based colors for any new buildings
      switch (category) {
        case 'housing':
          return {
            gradient: 'linear-gradient(135deg, #EF6C00 0%, #FB8C00 100%)',
            border: '#FF9800'
          };
        case 'farming':
          return {
            gradient: 'linear-gradient(135deg, #2d5016 0%, #3d6b1f 100%)',
            border: '#4a7c2a'
          };
        case 'wood':
          return {
            gradient: 'linear-gradient(135deg, #5D4037 0%, #6D4C41 100%)',
            border: '#8D6E63'
          };
        case 'stone':
          return {
            gradient: 'linear-gradient(135deg, #616161 0%, #757575 100%)',
            border: '#9E9E9E'
          };
        case 'production':
          return {
            gradient: 'linear-gradient(135deg, #8D6E63 0%, #A1887F 100%)',
            border: '#BCAAA4'
          };
        case 'special':
          return {
            gradient: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
            border: '#AB47BC'
          };
        default:
          return {
            gradient: 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)',
            border: 'rgba(255,255,255,0.2)'
          };
      }
  }
}

// Initialize empty grid
function initializeGrid() {
  GRID_SIZE = BASE_GRID_SIZE;
  gameState.map = [];
  expandMapToSize(GRID_SIZE);
}

// Calculate production for a building at a given level
function getBuildingProduction(buildingType, level) {
  const building = buildingTypes[buildingType];
  if (!building || level < 1) return { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, gold: 0, coal: 0, population: 0, capacity: 0 };
  
  const factor = Math.pow(building.productionGrowthFactor, level - 1);
  let production = {
    wood: (building.baseProduction.wood || 0) * factor,
    stone: (building.baseProduction.stone || 0) * factor,
    clay: (building.baseProduction.clay || 0) * factor,
    iron: (building.baseProduction.iron || 0) * factor,
    bricks: (building.baseProduction.bricks || 0) * factor,
    gold: (building.baseProduction.gold || 0) * factor,
    coal: (building.baseProduction.coal || 0) * factor,
    population: (building.baseProduction.population || 0) * factor,
    capacity: (building.baseProduction.capacity || 0) * factor
  };
  
  // Apply character bonuses
  if (gameState.character) {
    const character = characterTypes[gameState.character];
    
    // Miner: 50% bonus to stone production
    if (gameState.character === 'miner' && building.category === 'stone') {
      production.stone *= character.miningProductionMultiplier;
    }
    
    // Farmer: 50% bonus to farming production, 30% bonus to population growth
    if (gameState.character === 'farmer') {
      if (building.category === 'farming') {
        production.population *= character.farmingProductionMultiplier;
      }
      // Apply population multiplier to all population production
      if (production.population > 0) {
        production.population *= character.populationMultiplier;
      }
    }
  }
  
  // Apply shop upgrades
  if (gameState.upgrades.woodProduction && production.wood > 0) {
    production.wood *= 1.2;
  }
  if (gameState.upgrades.stoneProduction && production.stone > 0) {
    production.stone *= 1.2;
  }
  if (gameState.upgrades.clayProduction && production.clay > 0) {
    production.clay *= 1.2;
  }
  
  // Apply trader permanent upgrades (applied per building)
  if (gameState.traderUpgrades) {
    if (gameState.traderUpgrades.woodProduction && production.wood > 0) {
      production.wood *= 1.15; // +15% from trader
    }
    if (gameState.traderUpgrades.stoneProduction && production.stone > 0) {
      production.stone *= 1.15; // +15% from trader
    }
  }
  
  return production;
}

async function loadExternalQuests() {
  const res = await fetch("quests.json");
  const data = await res.json();
  return data.quests;
}

// Calculate cost for a building at a given level
function getBuildingCost(buildingType, level) {
  const building = buildingTypes[buildingType];
  if (!building) return { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0 };
  
  let cost;
  if (level === 1) {
    cost = { ...building.baseCost };
    // Ensure all resource fields exist
    if (!cost.clay) cost.clay = 0;
    if (!cost.iron) cost.iron = 0;
    if (!cost.bricks) cost.bricks = 0;
  } else {
    const factor = Math.pow(building.costGrowthFactor, level - 1);
    cost = {
      wood: Math.floor((building.baseCost.wood || 0) * factor),
      stone: Math.floor((building.baseCost.stone || 0) * factor),
      clay: Math.floor((building.baseCost.clay || 0) * factor),
      iron: Math.floor((building.baseCost.iron || 0) * factor),
      bricks: Math.floor((building.baseCost.bricks || 0) * factor)
    };
  }
  
  // Apply character bonuses
  if (gameState.character) {
    const character = characterTypes[gameState.character];
    
    // Farmer: 20% discount on farm buildings (level 1 placement only)
    if (gameState.character === 'farmer' && level === 1 && building.category === 'farming') {
      cost.wood = Math.floor(cost.wood * character.buildDiscount);
      cost.stone = Math.floor(cost.stone * character.buildDiscount);
      cost.clay = Math.floor(cost.clay * character.buildDiscount);
      cost.iron = Math.floor(cost.iron * character.buildDiscount);
      cost.bricks = Math.floor(cost.bricks * character.buildDiscount);
    }
    
    // Miner: 20% discount on stone buildings (all levels)
    if (gameState.character === 'miner' && building.category === 'stone') {
      cost.wood = Math.floor(cost.wood * character.upgradeDiscount);
      cost.stone = Math.floor(cost.stone * character.upgradeDiscount);
      cost.clay = Math.floor(cost.clay * character.upgradeDiscount);
      cost.iron = Math.floor(cost.iron * character.upgradeDiscount);
      cost.bricks = Math.floor(cost.bricks * character.upgradeDiscount);
    }
  }
  
  return cost;
}

// Calculate total cost spent on a building (for refund calculation)
function getTotalBuildingCost(buildingType, level) {
  let total = { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0 };
  for (let l = 1; l <= level; l++) {
    const cost = getBuildingCost(buildingType, l);
    total.wood += cost.wood || 0;
    total.stone += cost.stone || 0;
    total.clay += cost.clay || 0;
    total.iron += cost.iron || 0;
    total.bricks += cost.bricks || 0;
  }
  return total;
}

// Calculate production from all buildings
function calculateProduction() {
  let totalWood = 1; // Base 1 wps always
  let totalStone = 0;
  let totalClay = 0;
  let totalIron = 0;
  let totalBricks = 0;
  let totalGold = 0;
  let totalCoal = 0;
  let totalPopulation = 0;
  let totalCapacity = 0;
  
  const bounds = getMapBounds();
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    if (!gameState.map[row]) continue;
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      const tile = gameState.map[row] && gameState.map[row][col] ? gameState.map[row][col] : null;
      if (!tile || tile.type === "empty") continue;
      
      // Handle smelter processing
      if (tile.type === "smelter") {
        processSmelter(row, col, tile.level);
      }
      
      const production = getBuildingProduction(tile.type, tile.level);
      
      // Apply 5% production boost for owned tiles
      const ownedBoost = tile.owned ? 1.05 : 1.0;
      
      totalWood += production.wood * ownedBoost;
      totalStone += production.stone * ownedBoost;
      totalClay += production.clay * ownedBoost;
      totalIron += production.iron * ownedBoost;
      totalBricks += production.bricks * ownedBoost;
      totalGold += production.gold * ownedBoost;
      totalCoal += production.coal * ownedBoost;
      totalPopulation += production.population * ownedBoost;
      totalCapacity += production.capacity * ownedBoost;
    }
  }
  
  // Apply housing capacity upgrade
  if (gameState.upgrades.housingCapacity) {
    totalCapacity *= 1.2;
  }
  
  // Apply temporary boosts from wandering trader
  if (gameState.temporaryBoosts) {
    if (gameState.temporaryBoosts.woodProduction && gameState.temporaryBoosts.woodProduction.multiplier) {
      totalWood *= gameState.temporaryBoosts.woodProduction.multiplier;
    }
    if (gameState.temporaryBoosts.stoneProduction && gameState.temporaryBoosts.stoneProduction.multiplier) {
      totalStone *= gameState.temporaryBoosts.stoneProduction.multiplier;
    }
    if (gameState.temporaryBoosts.clayProduction && gameState.temporaryBoosts.clayProduction.multiplier) {
      totalClay *= gameState.temporaryBoosts.clayProduction.multiplier;
    }
    if (gameState.temporaryBoosts.ironProduction && gameState.temporaryBoosts.ironProduction.multiplier) {
      totalIron *= gameState.temporaryBoosts.ironProduction.multiplier;
    }
  }
  
  // Apply trader permanent upgrades
  if (gameState.traderUpgrades) {
    if (gameState.traderUpgrades.woodProduction) {
      totalWood *= 1.15; // +15% from trader
    }
    if (gameState.traderUpgrades.stoneProduction) {
      totalStone *= 1.15; // +15% from trader
    }
  }
  
  gameState.rates.wps = totalWood;
  gameState.rates.sps = totalStone;
  gameState.rates.cps = totalClay;
  gameState.rates.ips = totalIron;
  gameState.rates.bps = totalBricks;
  gameState.rates.gps = totalGold;
  gameState.rates.coalps = totalCoal;
  gameState.population.capacity = totalCapacity;
  
  // Update population (capped by capacity)
  gameState.population.current = Math.min(
    gameState.population.current + totalPopulation,
    gameState.population.capacity
  );
}

// Process smelter conversion (clay -> bricks or iron -> iron bars)
function processSmelter(row, col, level) {
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) return;
  if (gameState.map[row][col].type !== "smelter") return;
  
  const smelter = ensureSmelterFields(getSmelter(row, col));
  const building = buildingTypes.smelter;
  const factor = Math.pow(building.productionGrowthFactor, level - 1);
  const fuelCapacity = building.baseFuelCapacity * factor;
  const now = Date.now();
  
  // Check if a smelting batch is complete
  if (smelter.smeltingStartTime !== null && smelter.queue.length > 0) {
    const currentBatch = smelter.queue[0];
    const elapsedTime = now - smelter.smeltingStartTime;
    let smeltTime = currentBatch.type === 'clay' ? building.smeltClayTime : building.smeltIronTime;
    
    // Apply smelting speed upgrade (20% faster = 80% of original time)
    if (gameState.upgrades && gameState.upgrades.smeltingSpeed) {
      smeltTime = smeltTime * 0.8;
    }
    
    // Apply 5% speed boost for owned tiles (5% faster = 95% of time)
    const tile = gameState.map[row][col];
    if (tile && tile.owned) {
      smeltTime = smeltTime * 0.95;
    }
    
    if (elapsedTime >= smeltTime) {
      // Smelting complete! Add output and process next batch
      if (currentBatch.type === 'clay') {
        smelter.readyOutput.bricks += building.smeltBrickOutput;
        // Track clay batches smelted with coal
        // If we have coal available, this batch was smelted with coal
        if (smelter.coal > 0) {
          smelter.clayBatchesWithCoal++;
          // Every 3 clay batches consume 1 coal
          if (smelter.clayBatchesWithCoal >= 3) {
            smelter.coal -= 1;
            smelter.clayBatchesWithCoal = 0;
          }
        }
      } else if (currentBatch.type === 'iron') {
        smelter.readyOutput.ironBars += building.smeltIronBarOutput;
      }
      
      // Remove completed batch from queue
      smelter.queue.shift();
      
      // If there's more to smelt and we have fuel, start next batch
      if (smelter.queue.length > 0) {
        const nextBatch = smelter.queue[0];
        let fuelConsumed = false;
        
        // Try coal first (more efficient)
        if (nextBatch.type === 'clay') {
          // 1 coal = 3 clay batches
          // Check if we have coal (will be consumed after 3 batches)
          if (smelter.coal >= 1) {
            // Don't consume coal yet - will be consumed after 3 batches complete
            smelter.smeltingStartTime = now;
            fuelConsumed = true;
          } else if (smelter.fuel >= building.smeltClayWoodAmount) {
            smelter.fuel -= building.smeltClayWoodAmount;
            smelter.smeltingStartTime = now;
            fuelConsumed = true;
          }
        } else if (nextBatch.type === 'iron') {
          // 5 coal = 1 iron batch
          if (smelter.coal >= building.smeltIronCoalAmount) {
            smelter.coal -= building.smeltIronCoalAmount;
            smelter.smeltingStartTime = now;
            fuelConsumed = true;
          } else if (smelter.fuel >= building.smeltIronWoodAmount) {
            smelter.fuel -= building.smeltIronWoodAmount;
            smelter.smeltingStartTime = now;
            fuelConsumed = true;
          }
        }
        
        if (!fuelConsumed) {
          // Not enough fuel, reset
          smelter.smeltingStartTime = null;
        }
      } else {
        // No more to smelt, reset
        smelter.smeltingStartTime = null;
      }
    }
  }
}

// Load mineral to smelter (loads exactly one batch worth, up to 10 total)
function loadMineralToSmelter(row, col, mineralType) {
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) return false;
  if (gameState.map[row][col].type !== "smelter") return false;
  
  const smelter = ensureSmelterFields(getSmelter(row, col));
  const smelterTile = gameState.map[row][col];
  const building = buildingTypes.smelter;
  const maxStorage = 10;
  
  if (smelter.queue.length >= maxStorage) return false;
  
  // Get fuel capacity (scales with level)
  const factor = Math.pow(building.productionGrowthFactor, smelterTile.level - 1);
  const fuelCapacity = building.baseFuelCapacity * factor;
  
  // Check resources based on mineral type
  if (mineralType === 'clay') {
    if (gameState.resources.clay < building.smeltClayAmount) {
      return false; // Not enough clay
    }
    // Prefer coal: 1 coal = 3 clay batches
    // Check if we have coal (in storage or player resources)
    const coalNeeded = 1; // 1 coal for 3 batches
    const coalSpace = fuelCapacity - (smelter.fuel + smelter.coal);
    
    // Try to use coal first
    if (smelter.coal < coalNeeded && coalSpace > 0 && gameState.resources.coal > 0) {
      const coalToAdd = Math.min(coalNeeded - smelter.coal, coalSpace, gameState.resources.coal);
      smelter.coal += coalToAdd;
      gameState.resources.coal -= coalToAdd;
    }
    
    // Fall back to wood if no coal
    if (smelter.coal < coalNeeded) {
      const fuelNeeded = building.smeltClayWoodAmount;
      if (smelter.fuel < fuelNeeded) {
        const fuelToTake = fuelNeeded - smelter.fuel;
        if (gameState.resources.wood < fuelToTake) {
          return false; // Not enough fuel
        }
        const fuelSpace = fuelCapacity - (smelter.fuel + smelter.coal);
        const fuelToAdd = Math.min(fuelToTake, fuelSpace);
        smelter.fuel += fuelToAdd;
        gameState.resources.wood -= fuelToAdd;
      }
    }
    
    // Consume mineral
    gameState.resources.clay -= building.smeltClayAmount;
    // Add to queue
    smelter.queue.push({ type: 'clay' });
    // Start smelting if not already smelting and we have fuel
    if (smelter.smeltingStartTime === null) {
      // Prefer coal, then wood
      if (smelter.coal >= 1) {
        smelter.smeltingStartTime = Date.now();
      } else if (smelter.fuel >= building.smeltClayWoodAmount) {
        smelter.fuel -= building.smeltClayWoodAmount;
        smelter.smeltingStartTime = Date.now();
      }
    }
    return true;
  } else if (mineralType === 'iron') {
    if (gameState.resources.iron < building.smeltIronAmount) {
      return false; // Not enough iron
    }
    // Prefer coal: 5 coal = 1 iron batch
    const coalNeeded = building.smeltIronCoalAmount;
    const coalSpace = fuelCapacity - (smelter.fuel + smelter.coal);
    
    // Try to use coal first
    if (smelter.coal < coalNeeded && coalSpace > 0 && gameState.resources.coal >= coalNeeded) {
      const coalToAdd = Math.min(coalNeeded - smelter.coal, coalSpace, gameState.resources.coal);
      smelter.coal += coalToAdd;
      gameState.resources.coal -= coalToAdd;
    }
    
    // Fall back to wood if no coal
    if (smelter.coal < coalNeeded) {
      const fuelNeeded = building.smeltIronWoodAmount;
      if (smelter.fuel < fuelNeeded) {
        const fuelToTake = fuelNeeded - smelter.fuel;
        if (gameState.resources.wood < fuelToTake) {
          return false; // Not enough fuel
        }
        const fuelSpace = fuelCapacity - (smelter.fuel + smelter.coal);
        const fuelToAdd = Math.min(fuelToTake, fuelSpace);
        smelter.fuel += fuelToAdd;
        gameState.resources.wood -= fuelToAdd;
      }
    }
    
    // Consume mineral
    gameState.resources.iron -= building.smeltIronAmount;
    // Add to queue
    smelter.queue.push({ type: 'iron' });
    // Start smelting if not already smelting and we have fuel
    if (smelter.smeltingStartTime === null) {
      // Prefer coal, then wood
      if (smelter.coal >= coalNeeded) {
        smelter.coal -= coalNeeded;
        smelter.smeltingStartTime = Date.now();
      } else if (smelter.fuel >= building.smeltIronWoodAmount) {
        smelter.fuel -= building.smeltIronWoodAmount;
        smelter.smeltingStartTime = Date.now();
      }
    }
    return true;
  }
  
  return false;
}

// Add wood to smelter fuel storage
function addFuelToSmelter(row, col) {
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) return false;
  if (gameState.map[row][col].type !== "smelter") return false;
  
  const smelter = getSmelter(row, col, false);
  if (!smelter) return false;
  
  const tile = gameState.map[row][col];
  const building = buildingTypes.smelter;
  const factor = Math.pow(building.productionGrowthFactor, tile.level - 1);
  const fuelCapacity = building.baseFuelCapacity * factor;
  
  const totalFuel = (smelter.fuel || 0) + (smelter.coal || 0);
  const fuelSpace = fuelCapacity - totalFuel;
  if (fuelSpace <= 0) return false;
  
  const fuelToAdd = Math.min(10, fuelSpace, gameState.resources.wood);
  if (fuelToAdd <= 0) return false;
  
  // Add fuel to storage
  if (!smelter.fuel) smelter.fuel = 0;
  smelter.fuel += fuelToAdd;
  gameState.resources.wood -= fuelToAdd;
  
  return true;
}

// Add coal to smelter fuel storage
function addCoalToSmelter(row, col) {
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) return false;
  if (gameState.map[row][col].type !== "smelter") return false;
  
  const smelter = getSmelter(row, col, false);
  if (!smelter) return false;
  
  const tile = gameState.map[row][col];
  const building = buildingTypes.smelter;
  const factor = Math.pow(building.productionGrowthFactor, tile.level - 1);
  const fuelCapacity = building.baseFuelCapacity * factor;
  
  const totalFuel = (smelter.fuel || 0) + (smelter.coal || 0);
  const fuelSpace = fuelCapacity - totalFuel;
  if (fuelSpace <= 0) return false;
  
  const coalToAdd = Math.min(10, fuelSpace, gameState.resources.coal);
  if (coalToAdd <= 0) return false;
  
  // Add coal to storage
  if (!smelter.coal) smelter.coal = 0;
  smelter.coal += coalToAdd;
  gameState.resources.coal -= coalToAdd;
  
  return true;
}

// Remove a batch from smelter and refund resources
function removeBatchFromSmelter(row, col) {
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) return false;
  if (gameState.map[row][col].type !== "smelter") return false;
  
  const smelter = ensureSmelterFields(getSmelter(row, col, false));
  if (!smelter || smelter.queue.length <= 0) return false;
  
  // Can't remove the batch currently being smelted (first in queue)
  if (smelter.queue.length <= 1 && smelter.smeltingStartTime !== null) {
    return false; // Only batch is being processed
  }
  
  // Remove from the end of the queue (waiting batches), not the first one (currently smelting)
  const batchToRemove = smelter.queue.pop(); // Remove last item
  if (!batchToRemove) return false;
  
  const building = buildingTypes.smelter;
  
  // Refund resources based on mineral type
  if (batchToRemove.type === 'clay') {
    gameState.resources.clay += building.smeltClayAmount;
    gameState.resources.wood += building.smeltClayWoodAmount;
  } else if (batchToRemove.type === 'iron') {
    gameState.resources.iron += building.smeltIronAmount;
    gameState.resources.wood += building.smeltIronWoodAmount;
  }
  
  // If no more batches, reset
  if (smelter.queue.length === 0 && smelter.smeltingStartTime === null) {
    // Already empty, nothing to reset
  }
  
  return true;
}

// Harvest all ready output from smelter
function harvestSmelter(row, col) {
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) {
    return { bricks: 0, ironBars: 0 };
  }
  
  const smelter = ensureSmelterFields(getSmelter(row, col, false));
  if (!smelter) return { bricks: 0, ironBars: 0 };
  
  const bricksToHarvest = smelter.readyOutput.bricks || 0;
  const ironBarsToHarvest = smelter.readyOutput.ironBars || 0;
  
  if (bricksToHarvest > 0 || ironBarsToHarvest > 0) {
    gameState.resources.bricks += bricksToHarvest;
    gameState.resources.ironBars += ironBarsToHarvest;
    smelter.readyOutput.bricks = 0;
    smelter.readyOutput.ironBars = 0;
    return { bricks: bricksToHarvest, ironBars: ironBarsToHarvest };
  }
  
  return { bricks: 0, ironBars: 0 };
}

// Reset all building unlocks to their default state
function resetBuildingUnlocks() {
  const defaultUnlocks = {
    tepee: true,
    farm: true,
    lumberMill: true,
    quarry: true,
    ironMine: true,
    coalMine: true,
    clayPool: false,
    cabin: false,
    advancedFarm: false,
    advancedLumberMill: false,
    deepMine: false,
    oreRefinery: false,
    orchard: false,
    smelter: false,
    brickHouse: false,
    baseMarker: true
  };
  
  for (const [key, building] of Object.entries(buildingTypes)) {
    if (defaultUnlocks.hasOwnProperty(key)) {
      building.unlocked = defaultUnlocks[key];
    }
  }
}

// Check unlock conditions
function checkUnlocks() {
  // Only check character requirements - building unlocks are now handled by quests
  for (const [key, building] of Object.entries(buildingTypes)) {
    // Check character requirement
    if (building.requiredCharacter && gameState.character !== building.requiredCharacter) {
      building.unlocked = false;
    }
  }
}

// Purchase a tile to own it (protects from random events)
function purchaseTile(row, col) {
  // Get or create the tile (handles sparse coordinates)
  const tile = getOrCreateTile(row, col);
  if (tile.owned) return false; // Already owned
  
  const tileCost = 50; // Cost in gold
  if (gameState.resources.gold < tileCost) return false;
  
  gameState.resources.gold -= tileCost;
  tile.owned = true;
  
  return true;
}

// Cost per tile for random expansion
const COST_PER_TILE = 1500; // Large fixed cost per tile

// Calculate expansion cost (average cost for 2-9 tiles)
function calculateRandomExpansionCost() {
  // Average of 2-9 is 5.5 tiles
  return COST_PER_TILE * 5.5;
}

// Buy random tiles outside current grid boundaries as a clump in one direction
function buyRandomExpansion() {
  // Generate random number of tiles: 2-9 (inclusive)
  const numTiles = Math.floor(Math.random() * 8) + 2; // 2-9
  
  const expansionCost = COST_PER_TILE * numTiles;
  if (gameState.resources.gold < expansionCost) {
    showMessage("Not enough gold for expansion");
    return false;
  }
  
  // Get current bounds to determine where to place new tiles
  const bounds = getMapBounds();
  const currentMinRow = bounds.minRow;
  const currentMaxRow = bounds.maxRow;
  const currentMinCol = bounds.minCol;
  const currentMaxCol = bounds.maxCol;
  const gridWidth = currentMaxCol - currentMinCol + 1;
  const gridHeight = currentMaxRow - currentMinRow + 1;
  
  // Choose ONE random direction (0=top, 1=right, 2=bottom, 3=left)
  const direction = Math.floor(Math.random() * 4);
  
  // Determine valid positions along the chosen edge and pick a starting position
  let startRow, startCol;
  let validPositions = [];
  
  switch(direction) {
    case 0: // Top (above current grid)
      // Generate valid starting positions along the top edge
      for (let col = currentMinCol; col <= currentMaxCol; col++) {
        validPositions.push({ row: currentMinRow - 1, col: col });
      }
      break;
    case 1: // Right
      // Generate valid starting positions along the right edge
      for (let row = currentMinRow; row <= currentMaxRow; row++) {
        validPositions.push({ row: row, col: currentMaxCol + 1 });
      }
      break;
    case 2: // Bottom
      // Generate valid starting positions along the bottom edge
      for (let col = currentMinCol; col <= currentMaxCol; col++) {
        validPositions.push({ row: currentMaxRow + 1, col: col });
      }
      break;
    case 3: // Left
      // Generate valid starting positions along the left edge
      for (let row = currentMinRow; row <= currentMaxRow; row++) {
        validPositions.push({ row: row, col: currentMinCol - 1 });
      }
      break;
  }
  
  // Pick a random starting position
  if (validPositions.length === 0) {
    showMessage("Cannot expand - no valid positions");
    return false;
  }
  
  const startPos = validPositions[Math.floor(Math.random() * validPositions.length)];
  startRow = startPos.row;
  startCol = startPos.col;
  
  // Generate clump of adjacent tiles starting from the starting position
  const clump = new Set();
  const clumpArray = [];
  
  // Helper function to check if a position is valid for clump expansion
  const isValidClumpPosition = (row, col) => {
    // Must be adjacent to at least one existing tile in the clump
    if (clump.size === 0) return true; // First tile is always valid
    
    // Check if adjacent to any tile in the clump
    for (const tile of clumpArray) {
      const rowDiff = Math.abs(row - tile.row);
      const colDiff = Math.abs(col - tile.col);
      if (rowDiff + colDiff === 1) { // Adjacent (manhattan distance = 1)
        return true;
      }
    }
    return false;
  };
  
  // Helper function to get adjacent positions
  const getAdjacentPositions = (row, col) => {
    return [
      { row: row - 1, col: col }, // Top
      { row: row + 1, col: col }, // Bottom
      { row: row, col: col - 1 }, // Left
      { row: row, col: col + 1 }  // Right
    ];
  };
  
  // Add starting position to clump
  const startKey = `${startRow},${startCol}`;
  clump.add(startKey);
  clumpArray.push({ row: startRow, col: startCol });
  
  // Generate remaining tiles in the clump
  for (let i = 1; i < numTiles; i++) {
    // Collect all valid adjacent positions
    const candidates = [];
    
    // For each tile in the clump, check its adjacent positions
    for (const tile of clumpArray) {
      const adjacent = getAdjacentPositions(tile.row, tile.col);
      for (const pos of adjacent) {
        const key = `${pos.row},${pos.col}`;
        
        // Skip if already in clump
        if (clump.has(key)) continue;
        
        // Check if position is valid for expansion
        // Position should be in the general direction of expansion (within reasonable bounds)
        let inDirection = false;
        switch(direction) {
          case 0: // Top
            inDirection = pos.row <= currentMinRow - 1 && pos.row >= currentMinRow - 3;
            break;
          case 1: // Right
            inDirection = pos.col >= currentMaxCol + 1 && pos.col <= currentMaxCol + 3;
            break;
          case 2: // Bottom
            inDirection = pos.row >= currentMaxRow + 1 && pos.row <= currentMaxRow + 3;
            break;
          case 3: // Left
            inDirection = pos.col <= currentMinCol - 1 && pos.col >= currentMinCol - 3;
            break;
        }
        
        if (inDirection && isValidClumpPosition(pos.row, pos.col)) {
          // Check if not already in candidates
          if (!candidates.find(c => c.row === pos.row && c.col === pos.col)) {
            candidates.push(pos);
          }
        }
      }
    }
    
    // If no candidates found, try to expand in any direction from existing clump tiles
    if (candidates.length === 0) {
      for (const tile of clumpArray) {
        const adjacent = getAdjacentPositions(tile.row, tile.col);
        for (const pos of adjacent) {
          const key = `${pos.row},${pos.col}`;
          if (!clump.has(key) && isValidClumpPosition(pos.row, pos.col)) {
            if (!candidates.find(c => c.row === pos.row && c.col === pos.col)) {
              candidates.push(pos);
            }
          }
        }
      }
    }
    
    // If still no candidates, break (shouldn't happen, but safety check)
    if (candidates.length === 0) {
      break;
    }
    
    // Randomly select one candidate
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    const selectedKey = `${selected.row},${selected.col}`;
    clump.add(selectedKey);
    clumpArray.push({ row: selected.row, col: selected.col });
  }
  
  // Convert clump to array of tiles
  const newTiles = clumpArray;
  
  // Find the minimum row and col (may be negative)
  let minRow = currentMinRow, minCol = currentMinCol;
  newTiles.forEach(tile => {
    minRow = Math.min(minRow, tile.row);
    minCol = Math.min(minCol, tile.col);
  });
  
  // Calculate offset to shift everything to positive coordinates
  const rowOffset = minRow < 0 ? -minRow : 0;
  const colOffset = minCol < 0 ? -minCol : 0;
  
  // If we need to shift, create a new map with offset applied
  if (rowOffset > 0 || colOffset > 0) {
    const newMap = [];
    const oldBounds = getMapBounds();
    
    // Copy existing tiles with offset
    for (let row = oldBounds.minRow; row <= oldBounds.maxRow; row++) {
      const newRow = row + rowOffset;
      if (!newMap[newRow]) newMap[newRow] = [];
      for (let col = oldBounds.minCol; col <= oldBounds.maxCol; col++) {
        const newCol = col + colOffset;
        if (gameState.map[row] && gameState.map[row][col]) {
          newMap[newRow][newCol] = gameState.map[row][col];
        }
      }
    }
    
    gameState.map = newMap;
  }
  
  // Place new tiles at their coordinates (with offset applied if needed)
  newTiles.forEach(tile => {
    const finalRow = tile.row + rowOffset;
    const finalCol = tile.col + colOffset;
    const tileData = getOrCreateTile(finalRow, finalCol);
    tileData.owned = true; // Mark as owned/accessible
  });
  
  // Update GRID_SIZE to max dimension for backward compatibility
  const newBounds = getMapBounds();
  GRID_SIZE = Math.max(
    newBounds.maxRow - newBounds.minRow + 1,
    newBounds.maxCol - newBounds.minCol + 1,
    GRID_SIZE
  );
  
  // Deduct gold cost
  gameState.resources.gold -= expansionCost;
  
  renderGrid();
  updateUI();
  showMessage(`Acquired ${numTiles} new tiles!`);
  return true;
}

// Place building on grid
function placeBuilding(row, col, buildingType) {
  // Ensure grid is initialized
  if (!gameState.map || gameState.map.length === 0) {
    initializeGrid();
  }
  
  // Get or create the tile (handles sparse coordinates)
  const tile = getOrCreateTile(row, col);
  if (tile.type !== "empty") return false;
  
  // Check if tile is locked by a town
  if (tile.townId) {
    showMessage("Cannot place building on town-locked tile!");
    return false;
  }
  
  const building = buildingTypes[buildingType];
  if (!building || !building.unlocked) return false;
  
  // Check character requirement
  if (building.requiredCharacter && gameState.character !== building.requiredCharacter) {
    return false;
  }
  
  // Check building cap (don't count town centers as they're not placed directly)
  if (getBuildingCount() >= gameState.globalBuildingCap) {
    showMessage(`Building cap reached (${gameState.globalBuildingCap}). Level up towns to increase capacity.`);
    return false;
  }
  
  const cost = getBuildingCost(buildingType, 1);
  if (!canAfford(cost)) return false;
  deductCost(cost);
  
  // Place building
  tile.type = buildingType;
  tile.level = 1;
  
  // Initialize smelter storage if it's a smelter
  if (buildingType === "smelter") {
    getSmelter(row, col); // This creates and initializes the smelter
  }
  
  // Claim surrounding tiles if it's a base marker (3x3 area)
  if (buildingType === "baseMarker") {
    const claimRadius = 1; // 1 tile in each direction = 3x3 total
    for (let r = row - claimRadius; r <= row + claimRadius; r++) {
      for (let c = col - claimRadius; c <= col + claimRadius; c++) {
        // Check bounds
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          const targetTile = gameState.map[r][c];
          if (targetTile && !targetTile.owned) {
            targetTile.owned = true;
          }
        }
      }
    }
  }
  
  calculateProduction();
  checkUnlocks();
  checkQuests();
  updateBuildMenu();
  renderGrid();
  updateUI();
  
  // Check for town pattern whenever any building is placed
  // Strategy: Check all possible cabin center positions that could form a 3x3 pattern
  // with the newly placed building. This works regardless of placement order.
  
  let patternFound = false;
  
  // The placed building could be part of a 3x3 pattern where the cabin center is
  // anywhere from 2 tiles away (if placed at corner) to 0 tiles away (if cabin itself)
  // Check all positions within 2 tiles that could be valid cabin centers (need 1 tile margin)
  const minRow = Math.max(1, row - 2);
  const maxRow = Math.min(GRID_SIZE - 2, row + 2);
  const minCol = Math.max(1, col - 2);
  const maxCol = Math.min(GRID_SIZE - 2, col + 2);
  
  console.log(`🔍 Checking for town patterns after placing ${buildingType} at (${row}, ${col})`);
  console.log(`   Scanning cabin centers from (${minRow}, ${minCol}) to (${maxRow}, ${maxCol})`);
  
  // Check all possible cabin center positions
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const tile = gameState.map[r][c];
      
      // Check if this position is a cabin (either existing or just placed)
      const isCabin = (r === row && c === col && buildingType === "cabin") || 
                      (tile && tile.type === "cabin");
      
      if (isCabin && tile && !tile.townId) {
        console.log(`   Checking pattern with cabin center at (${r}, ${c})...`);
        const result = checkTownPattern(r, c);
        if (result >= 0) {
          console.log(`   ✅ Town pattern detected at (${r}, ${c}) with rotation ${result * 90}°`);
          patternFound = true;
          break; // Pattern found, no need to check other positions
        } else {
          console.log(`   ❌ No pattern match at (${r}, ${c})`);
        }
      }
    }
    if (patternFound) break; // Pattern found, no need to check other positions
  }
  
  // As a final comprehensive check, scan ALL cabins on the entire map
  // This is a safety net to catch any patterns we might have missed
  if (!patternFound) {
    console.log(`   Performing comprehensive scan of all cabins on map...`);
    const patternsFound = checkAllCabinsForPatterns();
    if (patternsFound > 0) {
      console.log(`   ✅ Found ${patternsFound} town pattern(s) by comprehensive scan`);
      patternFound = true;
    } else {
      console.log(`   ❌ No patterns found in comprehensive scan`);
    }
  }
  
  return true;
}

// Check if a building type is a mine (any mine type)
function isMineType(buildingType) {
  return buildingType === "ironMine" || buildingType === "coalMine" || buildingType === "deepMine";
}

// Check if a building type is a mineral building (quarry or any mine type)
function isMineralType(buildingType) {
  return buildingType === "quarry" || buildingType === "ironMine" || buildingType === "coalMine" || buildingType === "deepMine";
}

// Check if a 3x3 pattern matches the town pattern at the given center position
// Pattern: Outer ring (8 tiles): Mineral (any: quarry/ironMine/coalMine/deepMine), Tepee, Farm, Tepee, Mineral, Tepee, Farm, Tepee
// Center: Cabin
// Returns rotation (0, 90, 180, 270) if pattern matches, -1 otherwise
function checkTownPattern(centerRow, centerCol) {
  // Check bounds - need 1 tile in each direction
  if (centerRow < 1 || centerRow >= GRID_SIZE - 1 || centerCol < 1 || centerCol >= GRID_SIZE - 1) {
    return -1;
  }
  
  // Check if center is a Cabin
  const centerTile = gameState.map[centerRow][centerCol];
  if (centerTile.type !== "cabin") {
    return -1;
  }
  
  // Check if center is already part of a town
  if (centerTile.townId) {
    return -1;
  }
  
  // Define the pattern positions relative to center (0° rotation)
  // Pattern order: Top-left, Top, Top-right, Right, Bottom-right, Bottom, Bottom-left, Left
  // Expected: Mineral (any: quarry, ironMine, coalMine, deepMine), Tepee, Farm, Tepee, Mineral, Tepee, Farm, Tepee
  const pattern0 = [
    { row: centerRow - 1, col: centerCol - 1, expected: "mineral" },
    { row: centerRow - 1, col: centerCol, expected: "tepee" },
    { row: centerRow - 1, col: centerCol + 1, expected: "farm" },
    { row: centerRow, col: centerCol + 1, expected: "tepee" },
    { row: centerRow + 1, col: centerCol + 1, expected: "mineral" },
    { row: centerRow + 1, col: centerCol, expected: "tepee" },
    { row: centerRow + 1, col: centerCol - 1, expected: "farm" },
    { row: centerRow, col: centerCol - 1, expected: "tepee" }
  ];
  
  // Check all 4 rotations
  for (let rotation = 0; rotation < 4; rotation++) {
    let matches = true;
    
    for (let i = 0; i < pattern0.length; i++) {
      const pos = pattern0[i];
      
      // Calculate rotated position
      let rotatedRow, rotatedCol;
      const relRow = pos.row - centerRow;
      const relCol = pos.col - centerCol;
      
      switch (rotation) {
        case 0: // 0°
          rotatedRow = centerRow + relRow;
          rotatedCol = centerCol + relCol;
          break;
        case 1: // 90° clockwise
          rotatedRow = centerRow - relCol;
          rotatedCol = centerCol + relRow;
          break;
        case 2: // 180°
          rotatedRow = centerRow - relRow;
          rotatedCol = centerCol - relCol;
          break;
        case 3: // 270° clockwise (90° counter-clockwise)
          rotatedRow = centerRow + relCol;
          rotatedCol = centerCol - relRow;
          break;
      }
      
      // Check bounds
      if (rotatedRow < 0 || rotatedRow >= GRID_SIZE || rotatedCol < 0 || rotatedCol >= GRID_SIZE) {
        matches = false;
        break;
      }
      
      const rotatedTile = gameState.map[rotatedRow][rotatedCol];
      
      // Check if tile is empty (pattern requires all tiles to have buildings)
      if (!rotatedTile || rotatedTile.type === "empty") {
        matches = false;
        break;
      }
      
      // Check if tile is already part of a town
      if (rotatedTile.townId) {
        matches = false;
        break;
      }
      
      const expectedType = pattern0[i].expected;
      
      // Check if building matches expected type
      if (expectedType === "mineral") {
        if (!isMineralType(rotatedTile.type)) {
          matches = false;
          break;
        }
      } else if (rotatedTile.type !== expectedType) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      // Pattern found! Create town
      console.log(`✅ Town pattern detected at (${centerRow}, ${centerCol}) with rotation ${rotation * 90}°`);
      createTown(centerRow, centerCol, rotation);
      return rotation;
    }
  }
  
  return -1;
}

// Check all cabins on the map for town patterns
// This is a comprehensive check that ensures no patterns are missed
function checkAllCabinsForPatterns() {
  let patternsFound = 0;
  
  for (let row = 1; row < GRID_SIZE - 1; row++) {
    for (let col = 1; col < GRID_SIZE - 1; col++) {
      const tile = gameState.map[row][col];
      if (tile && tile.type === "cabin" && !tile.townId) {
        const result = checkTownPattern(row, col);
        if (result >= 0) {
          patternsFound++;
          // Pattern found and town created, continue checking other cabins
        }
      }
    }
  }
  
  return patternsFound;
}

// Create a town at the given center position with the specified rotation
function createTown(centerRow, centerCol, rotation) {
  const townId = gameState.nextTownId++;
  
  const linkedPositions = [];
  
  // Claim surrounding tiles in a 5x5 area (same as base marker)
  // This uses the same code as when a player purchases tiles with gold
  const claimRadius = 2; // 2 tiles in each direction = 5x5 total
  for (let r = centerRow - claimRadius; r <= centerRow + claimRadius; r++) {
    for (let c = centerCol - claimRadius; c <= centerCol + claimRadius; c++) {
      // Check bounds
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        const targetTile = gameState.map[r][c];
        if (targetTile) {
          // Claim the tile (same as gold purchase)
          if (!targetTile.owned) {
            targetTile.owned = true;
          }
          // Also set townId for town-specific locking
          targetTile.townId = townId;
          linkedPositions.push({ row: r, col: c });
        }
      }
    }
  }
  
  // Replace center Cabin with Town Center L1
  const centerTile = gameState.map[centerRow][centerCol];
  centerTile.type = "townCenter_L1";
  centerTile.level = 1;
  
  // Create town data
  gameState.towns[townId] = {
    level: 1,
    questsCompleted: [],
    linkedPositions: linkedPositions,
    merchantUnlocks: []
  };
  
  // Update building cap
  updateBuildingCap();
  
  // Console log town center creation
  console.log(`🏛️ TOWN CENTER CREATED!`);
  console.log(`   Town ID: ${townId}`);
  console.log(`   Location: (${centerRow}, ${centerCol})`);
  console.log(`   Rotation: ${rotation * 90}°`);
  console.log(`   Level: 1`);
  console.log(`   Locked Tiles: ${linkedPositions.length} tiles (5x5 area)`);
  console.log(`   New Building Cap: ${gameState.globalBuildingCap}`);
  console.log(`   Linked Positions:`, linkedPositions);
  
  // Show message
  if (typeof showMessage === 'function') {
    showMessage("Town Center created! The area is now locked.");
  }
  
  // Re-render grid to show changes
  if (typeof renderGrid === 'function') {
    renderGrid();
  }
  if (typeof updateUI === 'function') {
    updateUI();
  }
}

// Get town at a given position
function getTownAtPosition(row, col) {
  const tile = gameState.map[row][col];
  if (!tile || !tile.townId) return null;
  return gameState.towns[tile.townId] || null;
}

// Get building count (total non-empty buildings, excluding town centers)
function getBuildingCount() {
  let count = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const tile = gameState.map[row][col];
      if (tile && tile.type !== "empty" && !tile.type.startsWith('townCenter_')) {
        count++;
      }
    }
  }
  return count;
}

// Update global building cap based on all towns
function updateBuildingCap() {
  let totalLevels = 0;
  for (const townId in gameState.towns) {
    totalLevels += gameState.towns[townId].level;
  }
  gameState.globalBuildingCap = 20 + (totalLevels * 5);
}

// Get detailed quest progress information
function getQuestProgress(questDef) {
  if (!questDef) return null;
  
  const description = questDef.description;
  let progress = { current: 0, target: 0, percentage: 0, type: 'simple', details: {} };
  
  // Parse different quest types
  if (description.includes('Build') && description.includes('buildings') && !description.includes('Farms') && !description.includes('Quarries')) {
    // Extract number from "Build X buildings" or "Build X total buildings"
    const match = description.match(/Build (\d+)\s+(?:total\s+)?buildings/i);
    if (match) {
      const target = parseInt(match[1]);
      const current = getBuildingCount();
      progress = {
        current: current,
        target: target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        type: 'buildings',
        icon: '🏗️',
        details: { current, target, unit: 'buildings' }
      };
    }
  } else if (description.includes('Gather') && description.includes('wood')) {
    const match = description.match(/(\d+) wood/);
    if (match) {
      const target = parseInt(match[1]);
      const current = gameState.resources.wood || 0;
      progress = {
        current: current,
        target: target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        type: 'resource',
        icon: '🪵',
        resource: 'wood',
        details: { current, target, unit: 'wood' }
      };
    }
  } else if (description.includes('Farms')) {
    const match = description.match(/Build (\d+) Farms/);
    if (match) {
      const target = parseInt(match[1]);
      const current = countBuildings('farm');
      progress = {
        current: current,
        target: target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        type: 'building',
        icon: '🌾',
        buildingType: 'farm',
        details: { current, target, unit: 'farms' }
      };
    }
  } else if (description.includes('Store') && description.includes('gold')) {
    const match = description.match(/(\d+) gold/);
    if (match) {
      const target = parseInt(match[1]);
      const current = gameState.resources.gold || 0;
      progress = {
        current: current,
        target: target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        type: 'resource',
        icon: '💰',
        resource: 'gold',
        details: { current, target, unit: 'gold' }
      };
    }
  } else if (description.includes('Quarries')) {
    const match = description.match(/Build (\d+) Quarries/);
    if (match) {
      const target = parseInt(match[1]);
      const current = countBuildings('quarry');
      progress = {
        current: current,
        target: target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        type: 'building',
        icon: '⛏️',
        buildingType: 'quarry',
        details: { current, target, unit: 'quarries' }
      };
    }
  } else if (description.includes('Produce') && description.includes('bricks')) {
    const match = description.match(/(\d+) bricks/);
    if (match) {
      const target = parseInt(match[1]);
      const current = gameState.resources.bricks || 0;
      progress = {
        current: current,
        target: target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        type: 'resource',
        icon: '🧱',
        resource: 'bricks',
        details: { current, target, unit: 'bricks' }
      };
    }
  } else if (description.includes('Reach') && description.includes('population')) {
    const match = description.match(/(\d+) population/);
    if (match) {
      const target = parseInt(match[1]);
      const current = gameState.population.current || 0;
      progress = {
        current: current,
        target: target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        type: 'population',
        icon: '👥',
        details: { current, target, unit: 'population' }
      };
    }
  }
  
  // Default: return progress even if parsing didn't work (will show as simple quest)
  
  return progress;
}

// Check town quests for a specific town
function checkTownQuests(townId) {
  const town = gameState.towns[townId];
  if (!town) return false;
  
  const currentLevel = town.level;
  if (currentLevel >= 10) return false; // Already max level
  
  const questDef = townQuestDefinitions.find(q => q.level === currentLevel);
  if (!questDef) return false;
  
  // Check if quest is already completed
  if (town.questsCompleted.includes(questDef.id)) {
    return true; // Quest already completed
  }
  
  // Check if quest condition is met
  if (questDef.checkCondition()) {
    // Quest completed - mark it
    town.questsCompleted.push(questDef.id);
    return true;
  }
  
  return false;
}

// Level up a town
function levelUpTown(townId) {
  const town = gameState.towns[townId];
  if (!town) return false;
  
  const currentLevel = town.level;
  if (currentLevel >= 10) {
    if (typeof showMessage === 'function') {
      showMessage("Town is already at maximum level!");
    }
    return false;
  }
  
  // Check if quest is completed
  const questDef = townQuestDefinitions.find(q => q.level === currentLevel);
  if (!questDef) return false;
  
  if (!town.questsCompleted.includes(questDef.id)) {
    // Check if quest can be completed now
    if (!questDef.checkCondition()) {
      if (typeof showMessage === 'function') {
        showMessage("Quest not completed yet!");
      }
      return false;
    }
    town.questsCompleted.push(questDef.id);
  }
  
  // Level up
  town.level = currentLevel + 1;
  
  // Unlock merchant if applicable
  if (questDef.merchantUnlock && !town.merchantUnlocks.includes(questDef.merchantUnlock)) {
    town.merchantUnlocks.push(questDef.merchantUnlock);
  }
  
  // Update building cap
  updateBuildingCap();
  
  // Find center tile and update building type
  // The center is the last position added in createTown, or we can find it by checking townId
  let centerPos = null;
  for (const pos of town.linkedPositions) {
    const tile = gameState.map[pos.row][pos.col];
    if (tile && tile.townId === townId && tile.type && tile.type.startsWith('townCenter_')) {
      centerPos = pos;
      break;
    }
  }
  
  if (centerPos) {
    const centerTile = gameState.map[centerPos.row][centerPos.col];
    centerTile.type = `townCenter_L${town.level}`;
    centerTile.level = town.level;
  } else {
    console.warn(`Could not find center tile for town ${townId}`);
  }
  
  // Show message
  if (typeof showMessage === 'function') {
    showMessage(`Town leveled up to Level ${town.level}! Building cap increased.`);
  }
  
  // Re-render
  if (typeof renderGrid === 'function') {
    renderGrid();
  }
  
  if (typeof updateUI === 'function') {
    updateUI();
  }
  
  return true;
}

// Get available merchants for a town
function getAvailableMerchants(townId) {
  const town = gameState.towns[townId];
  if (!town) return [];
  
  const available = [];
  for (const merchantId of town.merchantUnlocks) {
    const merchant = merchantDefinitions[merchantId];
    if (merchant) {
      available.push(merchant);
    }
  }
  
  return available;
}

// Check all town quests (called periodically)
function checkAllTownQuests() {
  for (const townId in gameState.towns) {
    checkTownQuests(townId);
  }
}

// Upgrade building
function upgradeBuilding(row, col) {
  // Check if tile exists
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) return false;
  
  const tile = gameState.map[row][col];
  if (!tile || tile.type === "empty") return false;
  
  const building = buildingTypes[tile.type];
  if (!building) return false;
  
  // Cannot upgrade town centers through normal upgrade (must use town leveling)
  if (tile.type && tile.type.startsWith('townCenter_')) {
    showMessage("Use the Town Center panel to level up towns!");
    return false;
  }
  
  // Cannot upgrade base markers
  if (tile.type === "baseMarker") {
    showMessage("Base markers cannot be upgraded!");
    return false;
  }
  
  // Check max level
  if (building.maxLevel && tile.level >= building.maxLevel) return false;
  
  const nextLevel = tile.level + 1;
  const cost = getBuildingCost(tile.type, nextLevel);
  if (!canAfford(cost)) return false;
  deductCost(cost);
  
  // Upgrade building
  tile.level = nextLevel;
  
  calculateProduction();
  checkUnlocks();
  checkQuests();
  renderGrid();
  updateUI();
  updateTileInfo();
  
  return true;
}

// Remove building (with refund)
function removeBuilding(row, col) {
  // Check if tile exists
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) return false;
  
  const tile = gameState.map[row][col];
  if (!tile || tile.type === "empty") return false;
  
  // Cannot remove town centers
  if (tile.type && tile.type.startsWith('townCenter_')) {
    showMessage("Cannot remove Town Center!");
    return false;
  }
  
  // Cannot remove buildings on town-locked tiles
  if (tile.townId) {
    showMessage("Cannot remove buildings from town-locked tiles!");
    return false;
  }
  
  // Refund 50% of total cost
  const totalCost = getTotalBuildingCost(tile.type, tile.level);
  const refund = {
    wood: Math.floor((totalCost.wood || 0) * 0.5),
    stone: Math.floor((totalCost.stone || 0) * 0.5),
    clay: Math.floor((totalCost.clay || 0) * 0.5),
    iron: Math.floor((totalCost.iron || 0) * 0.5),
    bricks: Math.floor((totalCost.bricks || 0) * 0.5),
    gold: Math.floor((totalCost.gold || 0) * 0.5)
  };
  
  gameState.resources.wood += refund.wood;
  gameState.resources.stone += refund.stone;
  gameState.resources.clay += refund.clay;
  gameState.resources.iron += refund.iron;
  gameState.resources.bricks += refund.bricks;
  gameState.resources.gold += refund.gold;
  
  // Remove smelter storage if it's a smelter
  if (tile.type === "smelter" && gameState.smelters) {
    delete gameState.smelters[smelterKey(row, col)];
  }
  
  // Unclaim surrounding tiles if it's a base marker (3x3 area)
  if (tile.type === "baseMarker") {
    const claimRadius = 1; // 1 tile in each direction = 3x3 total
    for (let r = row - claimRadius; r <= row + claimRadius; r++) {
      for (let c = col - claimRadius; c <= col + claimRadius; c++) {
        // Check bounds
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          const targetTile = gameState.map[r][c];
          if (targetTile) {
            targetTile.owned = false;
          }
        }
      }
    }
  }
  
  // Remove building
  tile.type = "empty";
  tile.level = 0;
  
  calculateProduction();
  renderGrid();
  updateUI();
  updateTileInfo();
  
  return true;
}

// Generate event key from row/col
function eventKey(row, col) {
  return `${row}_${col}`;
}

// Spawn a random event on an un-owned tile
function spawnRandomEvent(eventType = 'wanderingTrader') {
  if (!gameState.map || gameState.map.length === 0) {
    return false;
  }
  
  // Find all un-owned tiles
  const unOwnedTiles = [];
  forEachTile((tile, row, col) => {
    if (!tile.owned) {
      unOwnedTiles.push({ row, col, tile });
    }
  });
  
  if (unOwnedTiles.length === 0) {
    showMessage("No un-owned tiles available for random events!");
    return false;
  }
  
  // Randomly select an un-owned tile
  const selected = unOwnedTiles[Math.floor(Math.random() * unOwnedTiles.length)];
  const { row, col, tile } = selected;
  const key = eventKey(row, col);
  
  // Check if there's already an event on this tile
  if (gameState.randomEvents[key]) {
    return false; // Event already exists here
  }
  
  // If tile has a building, remove it
  let buildingRemoved = false;
  let buildingName = '';
  if (tile.type !== "empty") {
    buildingName = buildingTypes[tile.type] ? buildingTypes[tile.type].displayName : tile.type;
    // Temporarily disable the message from removeBuilding
    const originalShowMessage = window.showMessage;
    window.showMessage = () => {}; // Suppress message
    buildingRemoved = removeBuilding(row, col);
    window.showMessage = originalShowMessage; // Restore
    
    if (buildingRemoved) {
      showMessage(`A ${eventType === 'wanderingTrader' ? 'wandering trader' : 'random event'} has appeared! The ${buildingName} was removed.`);
    }
  }
  
  // Create event data
  const now = Date.now();
  const eventDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
  gameState.randomEvents[key] = {
    type: eventType,
    spawnTime: now,
    expiresAt: now + eventDuration,
    row: row,
    col: col
  };
  
  renderGrid();
  if (!buildingRemoved) {
    showMessage(`A ${eventType === 'wanderingTrader' ? 'wandering trader' : 'random event'} has appeared at (${row}, ${col})!`);
  }
  
  return true;
}

// Manual trigger for random events (for testing)
function triggerRandomEvent(eventType = 'wanderingTrader') {
  return spawnRandomEvent(eventType);
}

// Check and remove expired events
function checkEventExpirations() {
  const now = Date.now();
  let expired = false;
  
  for (const key in gameState.randomEvents) {
    const event = gameState.randomEvents[key];
    if (event && event.expiresAt && now >= event.expiresAt) {
      delete gameState.randomEvents[key];
      expired = true;
    }
  }
  
  // Also check expired temporary boosts
  for (const boostType in gameState.temporaryBoosts) {
    const boost = gameState.temporaryBoosts[boostType];
    if (boost && boost.expiresAt && now >= boost.expiresAt) {
      delete gameState.temporaryBoosts[boostType];
    }
  }
  
  if (expired) {
    renderGrid();
    updateUI();
  }
}

// Render grid
function renderGrid() {
  const gridContainer = document.getElementById('grid-container');
  const gridWrapper = document.getElementById('grid-wrapper');
  if (!gridContainer || !gridWrapper) return;
  
  gridContainer.innerHTML = '';
  
  // Calculate bounding box of all tiles
  const bounds = getMapBounds();
  const numRows = bounds.maxRow - bounds.minRow + 1;
  const numCols = bounds.maxCol - bounds.minCol + 1;
  
  // Calculate optimal tile size based on container and grid dimensions
  const wrapperRect = gridWrapper.getBoundingClientRect();
  const availableWidth = wrapperRect.width || 600;
  const availableHeight = wrapperRect.height || 600;
  
  // Account for padding (10px on each side = 20px total)
  const padding = 20;
  const gapSize = 2;
  
  // Calculate tile size that fits the grid in the available space
  const maxTileWidth = (availableWidth - padding - (gapSize * Math.max(0, numCols - 1))) / Math.max(1, numCols);
  const maxTileHeight = (availableHeight - padding - (gapSize * Math.max(0, numRows - 1))) / Math.max(1, numRows);
  
  // Use the smaller dimension to maintain square tiles
  let tileSize = Math.min(maxTileWidth, maxTileHeight);
  
  // Set minimum and maximum tile sizes for usability
  const MIN_TILE_SIZE = 25; // Minimum 25px per tile (readable)
  const MAX_TILE_SIZE = 50; // Maximum 50px per tile (comfortable size)
  
  // Clamp tile size to min/max bounds
  // If grid is too large, tiles will be at minimum size and grid will scroll
  tileSize = Math.max(MIN_TILE_SIZE, Math.min(MAX_TILE_SIZE, Math.floor(tileSize)));
  
  // Calculate actual grid dimensions
  const gridWidth = (tileSize * numCols) + (gapSize * Math.max(0, numCols - 1)) + 4; // +4 for container padding
  const gridHeight = (tileSize * numRows) + (gapSize * Math.max(0, numRows - 1)) + 4;
  
  // Set grid template with fixed tile size
  gridContainer.style.gridTemplateColumns = `repeat(${numCols}, ${tileSize}px)`;
  gridContainer.style.gridTemplateRows = `repeat(${numRows}, ${tileSize}px)`;
  gridContainer.style.width = `${gridWidth}px`;
  gridContainer.style.height = `${gridHeight}px`;
  
  // Store bounds and tile size for use in event handlers
  gridContainer.dataset.minRow = bounds.minRow;
  gridContainer.dataset.minCol = bounds.minCol;
  gridContainer.dataset.tileSize = tileSize;
  gridContainer.dataset.baseWidth = gridWidth;
  gridContainer.dataset.baseHeight = gridHeight;
  
  // Apply zoom transform after dimensions are set
  applyZoom();
  
  // Get player color for backgrounds
  const playerColor = gameState.playerColor ? playerColors[gameState.playerColor] : '#4CAF50';
  
  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // Render all tiles in the bounding box
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      
      // Get tile (may be undefined if sparse)
      const tile = gameState.map[row] && gameState.map[row][col] 
        ? gameState.map[row][col] 
        : { type: "empty", level: 0, owned: false };
      
      if (tile.type !== "empty") {
        cell.classList.add(`cell-${tile.type}`);
        cell.setAttribute('data-level', tile.level);
        
        // Add town center level class for styling
        if (tile.type && tile.type.startsWith('townCenter_')) {
          const level = tile.type.replace('townCenter_L', '');
          cell.classList.add(`town-center-level-${level}`);
        }
      } else {
        cell.classList.add('cell-empty');
      }
      
      // Show ownership indicator with player color background
      // This applies to both purchased tiles and town-claimed tiles (same styling)
      if (tile.owned) {
        cell.classList.add('cell-owned');
        cell.title = 'Owned tile - protected from random events';
        
        // Apply semi-transparent background using player color
        const bgColor = hexToRgba(playerColor, 0.3);
        cell.style.backgroundColor = bgColor;
        cell.style.boxShadow = `inset 0 0 10px ${hexToRgba(playerColor, 0.5)}`;
      }
      
      // Check for random events on this tile
      const key = eventKey(row, col);
      const event = gameState.randomEvents[key];
      if (event) {
        if (event.type === 'wanderingTrader') {
          cell.classList.add('cell-event-trader');
          cell.style.position = 'relative';
          cell.title = 'Wandering Trader - Click to trade!';
          
          // Add visual indicator (animated border or icon)
          const eventIndicator = document.createElement('div');
          eventIndicator.style.position = 'absolute';
          eventIndicator.style.top = '2px';
          eventIndicator.style.right = '2px';
          eventIndicator.style.width = '12px';
          eventIndicator.style.height = '12px';
          eventIndicator.style.borderRadius = '50%';
          eventIndicator.style.backgroundColor = '#FFD700';
          eventIndicator.style.border = '2px solid #FFA500';
          eventIndicator.style.boxShadow = '0 0 8px #FFD700';
          eventIndicator.style.animation = 'pulse 1.5s infinite';
          eventIndicator.title = 'Wandering Trader';
          cell.appendChild(eventIndicator);
          
          // Add pulsing border effect
          cell.style.border = '2px solid #FFD700';
          cell.style.boxShadow = `0 0 10px rgba(255, 215, 0, 0.6), inset 0 0 10px rgba(255, 215, 0, 0.3)`;
        }
      }
      
      // Highlight selected cell
      if (selectedTile && selectedTile.row === row && selectedTile.col === col) {
        cell.classList.add('cell-selected');
      }
      
      // Highlight tile being moved in edit mode
      if (editMode && tileBeingMoved && tileBeingMoved.row === row && tileBeingMoved.col === col) {
        cell.classList.add('cell-moving');
      }
      
      // Make cells with buildings draggable
      if (tile.type !== "empty") {
        cell.draggable = true;
        cell.setAttribute('data-row', row);
        cell.setAttribute('data-col', col);
      }
      
      // Add drag event handlers for all cells
      cell.addEventListener('dragover', (e) => handleDragOver(e, row, col));
      cell.addEventListener('drop', (e) => handleDrop(e, row, col));
      cell.addEventListener('dragleave', (e) => handleDragLeave(e));
      
      // Only add dragstart and dragend for cells with buildings
      if (tile.type !== "empty") {
        cell.addEventListener('dragstart', (e) => handleDragStart(e, row, col));
        cell.addEventListener('dragend', (e) => handleDragEnd(e));
      }
      
      // Add click handler
      cell.addEventListener('click', () => handleCellClick(row, col));
      
      // Add hover tooltip
      cell.addEventListener('mouseenter', (e) => showCellTooltip(e, row, col));
      cell.addEventListener('mousemove', (e) => {
        const tooltip = document.getElementById('tooltip');
        if (tooltip && tooltip.style.display === 'block') {
          positionTooltip(e, tooltip);
        }
      });
      cell.addEventListener('mouseleave', hideCellTooltip);
      
      gridContainer.appendChild(cell);
    }
  }
}

// Zoom functions
function zoomIn() {
  if (!gameState.zoomLevel) gameState.zoomLevel = 1.0;
  gameState.zoomLevel = Math.min(3.0, gameState.zoomLevel + 0.1); // Max 300% zoom
  applyZoom();
  updateZoomDisplay();
}

function zoomOut() {
  if (!gameState.zoomLevel) gameState.zoomLevel = 1.0;
  gameState.zoomLevel = Math.max(0.3, gameState.zoomLevel - 0.1); // Min 30% zoom
  applyZoom();
  updateZoomDisplay();
}

function resetZoom() {
  gameState.zoomLevel = 1.0;
  applyZoom();
  updateZoomDisplay();
}

function applyZoom() {
  const gridContainer = document.getElementById('grid-container');
  const gridWrapper = document.getElementById('grid-wrapper');
  if (!gridContainer || !gridWrapper) return;
  
  const zoom = gameState.zoomLevel || 1.0;
  
  // Get the base dimensions from dataset or style
  const baseWidth = parseFloat(gridContainer.dataset.baseWidth) || parseFloat(gridContainer.style.width) || gridContainer.offsetWidth || 0;
  const baseHeight = parseFloat(gridContainer.dataset.baseHeight) || parseFloat(gridContainer.style.height) || gridContainer.offsetHeight || 0;
  
  if (baseWidth === 0 || baseHeight === 0) {
    // If dimensions aren't set yet, try again after a short delay
    setTimeout(() => applyZoom(), 50);
    return;
  }
  
  // Apply zoom transform
  gridContainer.style.transform = `scale(${zoom})`;
  
  // Calculate zoomed dimensions
  const zoomedWidth = baseWidth * zoom;
  const zoomedHeight = baseHeight * zoom;
  const wrapperWidth = gridWrapper.clientWidth;
  const wrapperHeight = gridWrapper.clientHeight;
  
  // Always use top-left origin for consistent scrolling behavior
  gridContainer.style.transformOrigin = '0 0';
  
  // Set wrapper alignment to allow scrolling from top-left
  gridWrapper.style.justifyContent = 'flex-start';
  gridWrapper.style.alignItems = 'flex-start';
  
  // Ensure wrapper always allows scrolling
  gridWrapper.style.overflow = 'auto';
  
  // When zoomed out, center the grid by adjusting margins after scaling
  if (zoom < 1.0) {
    // Calculate centering offset
    const offsetX = (wrapperWidth - zoomedWidth) / 2;
    const offsetY = (wrapperHeight - zoomedHeight) / 2;
    
    // Use margin to center when zoomed out
    gridContainer.style.marginLeft = `${Math.max(0, offsetX)}px`;
    gridContainer.style.marginTop = `${Math.max(0, offsetY)}px`;
  } else {
    // When zoomed in, no centering - allow full scrolling
    gridContainer.style.marginLeft = '0';
    gridContainer.style.marginTop = '0';
  }
}

function updateZoomDisplay() {
  const zoomDisplay = document.getElementById('zoom-level-display');
  if (zoomDisplay) {
    const zoomPercent = Math.round((gameState.zoomLevel || 1.0) * 100);
    zoomDisplay.textContent = `${zoomPercent}%`;
  }
}

// Drag and drop handlers
let draggedCell = null;

function handleDragStart(e, row, col) {
  const tile = gameState.map[row][col];
  if (tile.type === "empty") {
    e.preventDefault();
    return;
  }
  
  draggedCell = { row, col };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', ''); // Required for Firefox
  
  // Add visual feedback
  e.target.classList.add('cell-dragging');
}

function handleDragOver(e, row, col) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  // Add visual feedback for valid drop target (empty cells or other buildings for swapping)
  if (draggedCell) {
    const tile = gameState.map[row][col];
    // Allow dropping on empty cells or other buildings (for swapping)
    if (tile.type === "empty" || (draggedCell.row !== row || draggedCell.col !== col)) {
      e.currentTarget.classList.add('cell-drag-over');
    }
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('cell-drag-over');
}

function handleDrop(e, row, col) {
  e.preventDefault();
  e.stopPropagation();
  
  // Remove drag-over class
  e.currentTarget.classList.remove('cell-drag-over');
  
  if (!draggedCell) return;
  
  const fromRow = draggedCell.row;
  const fromCol = draggedCell.col;
  const toRow = row;
  const toCol = col;
  
  // Don't do anything if dropping on the same cell
  if (fromRow === toRow && fromCol === toCol) {
    draggedCell = null;
    return;
  }
  
  const toTile = gameState.map[toRow][toCol];
  const fromTile = gameState.map[fromRow][fromCol];
  
  // Allow dropping on empty cells or swapping with other buildings
  if (toTile.type === "empty") {
    // Move to empty cell
    if (moveBuilding(fromRow, fromCol, toRow, toCol)) {
      showMessage("Building moved!");
      renderGrid();
      updateTileInfo();
    } else {
      showMessage("Cannot move building.");
    }
  } else {
    // Swap buildings
    if (swapBuildings(fromRow, fromCol, toRow, toCol)) {
      showMessage("Buildings swapped!");
      renderGrid();
      updateTileInfo();
    } else {
      showMessage("Cannot swap buildings.");
    }
  }
  
  draggedCell = null;
}

function handleDragEnd(e) {
  // Remove visual feedback
  e.target.classList.remove('cell-dragging');
  
  // Remove drag-over class from all cells
  const cells = document.querySelectorAll('.grid-cell');
  cells.forEach(cell => cell.classList.remove('cell-drag-over'));
  
  draggedCell = null;
}

// Handle cell click
function handleCellClick(row, col) {
  // Safety check for map bounds
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) {
    return;
  }
  
  const tile = gameState.map[row][col];
  
  // Check for random events first (highest priority)
  const key = eventKey(row, col);
  const event = gameState.randomEvents[key];
  if (event) {
    if (event.type === 'wanderingTrader') {
      openWanderingTraderModal(key);
      return;
    }
  }
  
  // Edit mode: move buildings
  if (editMode) {
    if (tileBeingMoved) {
      // Placing the builcding at new location
      if (tile.type === "empty") {
        moveBuilding(tileBeingMoved.row, tileBeingMoved.col, row, col);
        tileBeingMoved = null;
        renderGrid();
        showMessage("Building moved!");
      } else {
        showMessage("Cannot place here - cell is occupied.");
      }
    } else if (tile.type !== "empty") {
      // Pick up building to move
      tileBeingMoved = { row, col, type: tile.type, level: tile.level };
      renderGrid();
      showMessage("Building selected. Click an empty cell to place it.");
    }
    return;
  }
  
  // Normal mode behavior
  if (selectedBuildingType && tile.type === "empty") {
    // Try to place building
    if (!placeBuilding(row, col, selectedBuildingType)) {
      showMessage("Not enough resources.");
    } else {
      // Only clear building selection if Shift is not held (allows multiple placements)
      if (!shiftHeld) {
        selectedBuildingType = null;
        updateBuildingSelection();
      }
    }
  } else if (!selectedBuildingType && tile.type !== "empty") {
    // Check if it's a Town Center
    if (tile.type && tile.type.startsWith('townCenter_') && tile.townId) {
      openTownCenterModal(tile.townId, row, col);
    } else {
      // Select tile for info panel
      selectedTile = { row, col };
      renderGrid();
      updateTileInfo();
    }
  } else if (selectedBuildingType && tile.type !== "empty") {
    // Check if it's a Town Center
    if (tile.type && tile.type.startsWith('townCenter_') && tile.townId) {
      selectedBuildingType = null;
      updateBuildingSelection();
      openTownCenterModal(tile.townId, row, col);
    } else {
      // Clear selection and show tile info
      selectedBuildingType = null;
      updateBuildingSelection();
      selectedTile = { row, col };
      renderGrid();
      updateTileInfo();
    }
  } else if (!selectedBuildingType && tile.type === "empty") {
    // Select empty tile to show purchase option
    selectedTile = { row, col };
    renderGrid();
    updateTileInfo();
  }
}

// Show message
function showMessage(text) {
  // Simple alert for now, can be improved with a toast notification
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.textContent = text;
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 2000);
  }
}

// Show custom confirmation modal (replaces browser confirm)
function showConfirmation(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmation-modal');
    const messageEl = document.getElementById('confirmation-message');
    const yesBtn = document.getElementById('confirmation-yes');
    const noBtn = document.getElementById('confirmation-no');
    
    if (!modal || !messageEl || !yesBtn || !noBtn) {
      // Fallback to browser confirm if modal elements not found
      resolve(confirm(message));
      return;
    }
    
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    const cleanup = () => {
      modal.style.display = 'none';
      yesBtn.onclick = null;
      noBtn.onclick = null;
      modal.onclick = null;
    };
    
    yesBtn.onclick = () => {
      cleanup();
      resolve(true);
    };
    
    noBtn.onclick = () => {
      cleanup();
      resolve(false);
    };
    
    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };
  });
}

// Update building selection UI
function updateBuildingSelection() {
  const buttons = document.querySelectorAll('.building-btn');
  buttons.forEach(btn => {
    if (btn.dataset.buildingType === selectedBuildingType) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

// Select building type
function selectBuildingType(buildingType) {
  if (selectedBuildingType === buildingType && !shiftHeld) {
    // Deselect if clicking same building (unless Shift is held)
    selectedBuildingType = null;
    } else {
    selectedBuildingType = buildingType;
    selectedTile = null; // Clear tile selection when selecting building
  }
  updateBuildingSelection();
  updateTileInfo();
}

// Update tile info panel
function updateTileInfo() {
  const infoPanel = document.getElementById('tile-info');
  if (!infoPanel) return;
  
  if (!selectedTile) {
    infoPanel.innerHTML = '<p>Select a building to place or click on a placed building to view details.</p>';
    return;
  }
  
  const tile = gameState.map[selectedTile.row][selectedTile.col];
  
  if (tile.type === "empty") {
    const tileCost = 50; // Cost in gold to purchase a tile
    const canAffordTile = gameState.resources.gold >= tileCost;
    
    let html = '<div style="padding: 10px;">';
    html += `<h3>Empty Tile</h3>`;
    
    if (tile.owned) {
      html += `<p style="color: #4CAF50; font-weight: bold;">✓ This tile is owned and protected from random events.</p>`;
    } else {
      html += `<p>This tile is not owned. Random events can affect unowned tiles.</p>`;
      html += `<button id="purchase-tile-btn" style="margin: 15px 0; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: ${canAffordTile ? '#FFD700' : '#666'}; border: 3px solid ${canAffordTile ? 'rgba(255,255,255,0.4)' : '#888'}; border-radius: 8px; cursor: ${canAffordTile ? 'pointer' : 'not-allowed'}; opacity: ${canAffordTile ? '1' : '0.5'}; transition: all 0.2s; font-weight: bold; font-size: 16px;" ${!canAffordTile ? 'disabled' : ''} onmouseover="if(this.style.opacity!=='0.5')this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">`;
      html += `<img src="images/gold.png" alt="Gold" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 18px; color: ${canAffordTile ? '#000000' : '#ffffff'};">${formatNumber(tileCost)}</span>`;
      html += `</button>`;
    }
    
    html += `<p style="margin-top: 15px; font-size: 12px; color: #aaa;">Select a building type from the menu to place here.</p>`;
    html += `</div>`;
    
    infoPanel.innerHTML = html;
    
    // Add event listener for purchase button
    const purchaseBtn = document.getElementById('purchase-tile-btn');
    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', () => {
        if (selectedTile && purchaseTile(selectedTile.row, selectedTile.col)) {
          updateTileInfo();
          updateUI();
          renderGrid();
          showMessage("Tile purchased! This tile is now protected from random events.");
        } else {
          showMessage("Cannot purchase tile: insufficient gold.");
        }
      });
    }
    return;
  }
  
  const building = buildingTypes[tile.type];
  const production = getBuildingProduction(tile.type, tile.level);
  const upgradeCost = getBuildingCost(tile.type, tile.level + 1);
  // Base markers cannot be upgraded
  const canUpgrade = tile.type !== "baseMarker" && (building.maxLevel === null || tile.level < building.maxLevel);
  const canAffordUpgrade = canAfford(upgradeCost);
  
  // Resource colors matching the game's color scheme
  const resourceBgColors = {
    wood: '#8B4513',
    stone: '#9E9E9E',
    clay: '#8D6E63',
    iron: '#708090',
    gold: '#FFD700',
    bricks: '#D32F2F',
    ironBars: '#708090'
  };
  
  let html = `<h3>${building.displayName} (Level ${tile.level})</h3>`;
  
  // Calculate actual production with owned boost
  const ownedBoost = tile.owned ? 1.05 : 1.0;
  const actualProduction = {
    wood: production.wood * ownedBoost,
    stone: production.stone * ownedBoost,
    clay: production.clay * ownedBoost,
    iron: production.iron * ownedBoost,
    coal: production.coal * ownedBoost,
    bricks: production.bricks * ownedBoost,
    population: production.population * ownedBoost,
    capacity: production.capacity * ownedBoost
  };
  
  if (tile.owned) {
    html += `<p style="color: #4CAF50; font-weight: bold; margin: 5px 0;">✓ Owned - Protected from random events</p>`;
  }
  
  // Helper function to format production with boost indicator
  const formatProductionWithBoost = (baseValue, actualValue, icon, label) => {
    if (baseValue <= 0) return '';
    let text = `<p style="display: flex; align-items: center; gap: 8px;">`;
    text += `<img src="${icon}" alt="${label}" style="width: 30px; height: 30px; vertical-align: middle;">`;
    text += `<span style="color: #4CAF50; font-weight: bold;">↑</span>`;
    text += `<span>${formatNumberWithDecimals(actualValue)}/s</span>`;
    if (tile.owned && baseValue > 0) {
      text += `<span style="color: #FFD700; font-size: 11px; margin-left: 5px;">(+5%)</span>`;
    }
    text += `</p>`;
    return text;
  };
  
  if (actualProduction.wood > 0) html += formatProductionWithBoost(production.wood, actualProduction.wood, 'images/wood-log.png', 'Wood');
  if (actualProduction.stone > 0) html += formatProductionWithBoost(production.stone, actualProduction.stone, 'images/rock.png', 'Stone');
  if (actualProduction.clay > 0) html += formatProductionWithBoost(production.clay, actualProduction.clay, 'images/clay.png', 'Clay');
  if (actualProduction.iron > 0) html += formatProductionWithBoost(production.iron, actualProduction.iron, 'images/iron.png', 'Iron');
  if (actualProduction.coal > 0) html += formatProductionWithBoost(production.coal, actualProduction.coal, 'images/coal.png', 'Coal');
  if (actualProduction.bricks > 0) html += formatProductionWithBoost(production.bricks, actualProduction.bricks, 'images/claybricks.png', 'Bricks');
  if (actualProduction.population > 0) html += formatProductionWithBoost(production.population, actualProduction.population, 'images/population.png', 'Population');
  if (actualProduction.capacity > 0) {
    html += `<p style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: bold;">Capacity:</span> <span style="color: #4CAF50; font-weight: bold;">↑</span> ${formatNumber(actualProduction.capacity)}`;
    if (tile.owned && production.capacity > 0) {
      html += `<span style="color: #FFD700; font-size: 11px; margin-left: 5px;">(+5%)</span>`;
    }
    html += `</p>`;
  }
  
  // Special handling for smelter
  if (tile.type === "smelter") {
    const smelter = ensureSmelterFields(getSmelter(selectedTile.row, selectedTile.col));
    const building = buildingTypes.smelter;
    const maxStorage = 10;
    const factor = Math.pow(building.productionGrowthFactor, tile.level - 1);
    const fuelCapacity = building.baseFuelCapacity * factor;
    
    // Get currently smelting batch (first in queue)
    const currentBatch = smelter.queue.length > 0 ? smelter.queue[0] : null;
    
    // Calculate smelting progress
    let smeltingProgress = 0;
    let smeltingTimeLeft = 0;
    let smeltTime = 0;
    if (smelter.smeltingStartTime !== null && currentBatch) {
      const now = Date.now();
      const elapsed = now - smelter.smeltingStartTime;
      smeltTime = currentBatch.type === 'clay' ? building.smeltClayTime : building.smeltIronTime;
      // Apply smelting speed upgrade (20% faster = 80% of original time)
      if (gameState.upgrades && gameState.upgrades.smeltingSpeed) {
        smeltTime = smeltTime * 0.8;
      }
      smeltingProgress = Math.min(100, (elapsed / smeltTime) * 100);
      smeltingTimeLeft = Math.max(0, Math.ceil((smeltTime - elapsed) / 1000));
    }
    
    const totalReady = (smelter.readyOutput.bricks || 0) + (smelter.readyOutput.ironBars || 0);
    // Check if we can load - need mineral, and either fuel in storage or player has wood/coal
    const hasEnoughFuelForClay = smelter.fuel >= building.smeltClayWoodAmount || smelter.coal >= 1 || gameState.resources.wood >= building.smeltClayWoodAmount || gameState.resources.coal >= 1;
    const hasEnoughFuelForIron = smelter.fuel >= building.smeltIronWoodAmount || smelter.coal >= building.smeltIronCoalAmount || gameState.resources.wood >= building.smeltIronWoodAmount || gameState.resources.coal >= building.smeltIronCoalAmount;
    const canLoadClay = smelter.queue.length < maxStorage && gameState.resources.clay >= building.smeltClayAmount && hasEnoughFuelForClay;
    const canLoadIron = smelter.queue.length < maxStorage && gameState.resources.iron >= building.smeltIronAmount && hasEnoughFuelForIron;
    
    html += `<hr style="margin: 15px 0; border-color: rgba(255,255,255,0.2);">`;
    
    // Fuel Storage Section
    const totalFuel = smelter.fuel + smelter.coal;
    const fuelPercentage = (totalFuel / fuelCapacity) * 100;
    const fuelSpace = fuelCapacity - totalFuel;
    const canAddWood = fuelSpace > 0 && gameState.resources.wood > 0;
    const canAddCoal = fuelSpace > 0 && gameState.resources.coal > 0;
    const woodToAdd = Math.min(10, fuelSpace, gameState.resources.wood);
    const coalToAdd = Math.min(10, fuelSpace, gameState.resources.coal);
    
    html += `<div style="padding: 12px; background: linear-gradient(135deg, rgba(109, 76, 65, 0.3) 0%, rgba(141, 110, 99, 0.3) 100%); border: 2px solid #8D6E63; border-radius: 8px; margin: 10px 0;">`;
    html += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">`;
    html += `<strong style="color: #8D6E63; font-size: 16px;">🔥 Fuel Storage</strong>`;
    html += `<span style="color: #8D6E63; font-weight: bold; font-size: 14px;">${formatNumber(totalFuel)} / ${formatNumber(fuelCapacity)}</span>`;
    html += `</div>`;
    
    // Fuel breakdown
    html += `<div style="display: flex; gap: 5px; margin-bottom: 8px; font-size: 12px;">`;
    html += `<span style="color: #8D6E63; flex: 1; text-align: center; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 4px;">Wood: ${formatNumber(smelter.fuel)}</span>`;
    html += `<span style="color: #CCCCCC; flex: 1; text-align: center; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 4px;">Coal: ${formatNumber(smelter.coal)}</span>`;
    html += `</div>`;
    
    // Fuel progress bar
    html += `<div style="background: rgba(0,0,0,0.3); border-radius: 6px; height: 20px; margin: 8px 0; position: relative; overflow: hidden; border: 1px solid rgba(141, 110, 99, 0.5);">`;
    html += `<div style="background: linear-gradient(90deg, #6D4C41 0%, #8D6E63 100%); height: 100%; width: ${fuelPercentage}%; border-radius: 6px; transition: width 0.3s;"></div>`;
    html += `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-size: 11px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${fuelPercentage.toFixed(0)}%</div>`;
    html += `</div>`;
    
    // Fuel consumption info
    html += `<div style="display: flex; gap: 10px; margin: 8px 0; font-size: 12px;">`;
    html += `<span style="color: #aaa; flex: 1; text-align: center; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 4px;">Clay: <strong style="color: #8B4513;">${building.smeltClayWoodAmount}</strong> <img src="images/wood-log.png" alt="Wood" style="width: 16px; height: 16px; vertical-align: middle;"> or <strong style="color: #CCCCCC;">1</strong> <img src="images/coal.png" alt="Coal" style="width: 16px; height: 16px; vertical-align: middle;"> (3 batches)</span>`;
    html += `<span style="color: #aaa; flex: 1; text-align: center; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 4px;">Iron: <strong style="color: #708090;">${building.smeltIronWoodAmount}</strong> <img src="images/wood-log.png" alt="Wood" style="width: 16px; height: 16px; vertical-align: middle;"> or <strong style="color: #CCCCCC;">${building.smeltIronCoalAmount}</strong> <img src="images/coal.png" alt="Coal" style="width: 16px; height: 16px; vertical-align: middle;"></span>`;
    html += `</div>`;
    
    // Add fuel buttons
    html += `<button id="add-fuel-btn" style="margin-top: 8px; width: 100%; padding: 10px; background: ${canAddWood ? '#6D4C41' : 'rgba(100, 100, 100, 0.2)'}; border: 2px solid ${canAddWood ? '#8D6E63' : '#666'}; border-radius: 6px; cursor: ${canAddWood ? 'pointer' : 'not-allowed'}; opacity: ${canAddWood ? '1' : '0.5'}; color: white; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;" ${!canAddWood ? 'disabled' : ''}>`;
    html += `<img src="images/wood-log.png" alt="Wood" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>Add ${formatNumber(woodToAdd)} Wood</span>`;
    html += `</button>`;
    html += `<button id="add-coal-btn" style="margin-top: 8px; width: 100%; padding: 10px; background: ${canAddCoal ? '#212121' : 'rgba(100, 100, 100, 0.2)'}; border: 2px solid ${canAddCoal ? '#424242' : '#666'}; border-radius: 6px; cursor: ${canAddCoal ? 'pointer' : 'not-allowed'}; opacity: ${canAddCoal ? '1' : '0.5'}; color: white; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;" ${!canAddCoal ? 'disabled' : ''}>`;
    html += `<img src="images/coal.png" alt="Coal" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>Add ${formatNumber(coalToAdd)} Coal</span>`;
    html += `</button>`;
    html += `</div>`;
    
    // Mineral selection buttons
    html += `<p><strong>Load Mineral:</strong></p>`;
    html += `<div style="display: flex; gap: 10px; margin: 10px 0;">`;
    html += `<button id="load-clay-btn" style="flex: 1; padding: 10px; background: ${canLoadClay ? '#8B4513' : 'rgba(139, 69, 19, 0.3)'}; border: 2px solid ${canLoadClay ? '#8B4513' : '#666'}; border-radius: 5px; cursor: ${canLoadClay ? 'pointer' : 'not-allowed'}; opacity: ${canLoadClay ? '1' : '0.5'};" ${!canLoadClay ? 'disabled' : ''}>`;
    html += `<img src="images/clay.png" alt="Clay" style="width: 40px; height: 40px; display: block; margin: 0 auto 5px;">`;
    html += `<span style="font-size: 12px;">${building.smeltClayAmount} Clay</span>`;
    html += `</button>`;
    html += `<button id="load-iron-btn" style="flex: 1; padding: 10px; background: ${canLoadIron ? '#708090' : 'rgba(112, 128, 144, 0.3)'}; border: 2px solid ${canLoadIron ? '#708090' : '#666'}; border-radius: 5px; cursor: ${canLoadIron ? 'pointer' : 'not-allowed'}; opacity: ${canLoadIron ? '1' : '0.5'};" ${!canLoadIron ? 'disabled' : ''}>`;
    html += `<img src="images/iron.png" alt="Iron" style="width: 40px; height: 40px; display: block; margin: 0 auto 5px;">`;
    html += `<span style="font-size: 12px;">${building.smeltIronAmount} Iron</span>`;
    html += `</button>`;
    html += `</div>`;
    
    // Current status - show icons for stored batches (queue)
    html += `<p><strong>Queue (${smelter.queue.length} / ${maxStorage}):</strong></p>`;
    if (smelter.queue.length > 0) {
      // Show icons for all batches in queue (skip first if currently smelting)
      const startIndex = (smelter.smeltingStartTime !== null) ? 1 : 0;
      const iconsToShow = smelter.queue.slice(startIndex); // All batches except the one being smelted
      
      html += `<div id="stored-batches-container" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; min-height: 50px; align-items: center;">`;
      if (iconsToShow.length > 0) {
        iconsToShow.forEach((batch, displayIndex) => {
          const mineralIcon = batch.type === 'clay' ? 'images/clay.png' : 'images/iron.png';
          const mineralColor = batch.type === 'clay' ? '#8B4513' : '#708090';
          const actualQueueIndex = startIndex + displayIndex; // Actual index in the queue array
          html += `<img class="batch-icon" data-mineral-type="${batch.type}" data-queue-index="${actualQueueIndex}" src="${mineralIcon}" alt="${batch.type}" style="width: 35px; height: 35px; border: 2px solid ${mineralColor}; border-radius: 3px; background: ${mineralColor}; padding: 2px; cursor: pointer; transition: opacity 0.2s;" title="Click to remove this batch">`;
        });
      } else {
        html += `<span style="color: #999; font-style: italic;">All batches are being processed</span>`;
      }
      html += `</div>`;
    } else {
      html += `<div style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; min-height: 50px; align-items: center;">`;
      html += `<span style="color: #999; font-style: italic;">Empty</span>`;
      html += `</div>`;
    }
    
    // Show smelting progress
    if (smelter.smeltingStartTime !== null && currentBatch) {
      // Calculate smelt time with all bonuses
      let displaySmeltTime = currentBatch.type === 'clay' ? building.smeltClayTime : building.smeltIronTime;
      if (gameState.upgrades && gameState.upgrades.smeltingSpeed) {
        displaySmeltTime = displaySmeltTime * 0.8;
      }
      if (tile.owned) {
        displaySmeltTime = displaySmeltTime * 0.95;
      }
      const totalTimeSeconds = Math.ceil(displaySmeltTime / 1000);
      const elapsedSeconds = Math.floor((Date.now() - smelter.smeltingStartTime) / 1000);
      const inputIcon = currentBatch.type === 'clay' ? 'images/clay.png' : 'images/iron.png';
      const outputIcon = currentBatch.type === 'clay' ? 'images/claybricks.png' : 'images/ironBar.webp';
      const inputAlt = currentBatch.type === 'clay' ? 'Clay' : 'Iron';
      const outputAlt = currentBatch.type === 'clay' ? 'Bricks' : 'Iron Bars';
      html += `<div style="background: rgba(255,255,255,0.2); border-radius: 4px; height: 25px; margin: 5px 0; position: relative; overflow: hidden;">`;
      html += `<div style="background: ${smelter.mineralType === 'clay' ? '#8B4513' : '#708090'}; height: 100%; width: ${smeltingProgress}%; border-radius: 4px; transition: width 0.3s;"></div>`;
      html += `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-size: 12px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${smeltingTimeLeft}s / ${totalTimeSeconds}s</div>`;
      html += `</div>`;
      // Show speed boost info
      if (tile.owned) {
        html += `<p style="color: #FFD700; font-size: 11px; margin: 2px 0;">⚡ +5% Smelting Speed Boost Active</p>`;
      }
    } else if (smelter.amount > 0 && smelter.smeltingStartTime === null) {
      // Has resources but not smelting (shouldn't happen, but handle it)
      html += `<p style="color: #FF6B6B;">Ready to start smelting ${smelter.mineralType}...</p>`;
    }
    
    // Ready output
    if (totalReady > 0) {
      html += `<p><strong>Ready to Harvest:</strong></p>`;
      if (smelter.readyOutput.bricks > 0) {
         html += `<p>Bricks: ${formatNumber(smelter.readyOutput.bricks)}</p>`;
       }
       if (smelter.readyOutput.ironBars > 0) {
         html += `<p>Iron Bars: ${formatNumber(smelter.readyOutput.ironBars)}</p>`;
      }
    }
    
    // Harvest button
    html += `<button id="harvest-smelter-btn" style="margin: 10px 0; width: 100%; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 5px;" ${totalReady <= 0 ? 'disabled' : ''}>`;
     html += `Harvest `;
     if (smelter.readyOutput.bricks > 0 && smelter.readyOutput.ironBars > 0) {
       html += `${formatNumber(smelter.readyOutput.bricks)} <img src="images/claybricks.png" alt="Bricks" style="width: 30px; height: 30px; vertical-align: middle;">`;
       html += `${formatNumber(smelter.readyOutput.ironBars)} <img src="images/ironBar.webp" alt="Iron Bars" style="width: 30px; height: 30px; vertical-align: middle;">`;
     } else if (smelter.readyOutput.bricks > 0) {
       html += `${formatNumber(smelter.readyOutput.bricks)} <img src="images/claybricks.png" alt="Bricks" style="width: 30px; height: 30px; vertical-align: middle;">`;
     } else if (smelter.readyOutput.ironBars > 0) {
       html += `${formatNumber(smelter.readyOutput.ironBars)} <img src="images/ironBar.webp" alt="Iron Bars" style="width: 30px; height: 30px; vertical-align: middle;">`;
    } else {
      html += `(Nothing Ready)`;
    }
    html += `</button>`;
  }
  
  if (canUpgrade) {
    html += `<p><strong>Upgrade Cost:</strong></p>`;
    html += `<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0;">`;
    if (upgradeCost.wood > 0) {
      const hasEnough = gameState.resources.wood >= upgradeCost.wood;
      const borderColor = 'rgba(255,255,255,0.2)';
      const textColor = '#FFFFFF';
      html += `<span style="display: flex; align-items: center; gap: 5px; padding: 5px 8px; background: ${resourceBgColors.wood}; border-radius: 5px; border: 3px solid ${borderColor}; position: relative;">`;
      html += `<img src="images/wood-log.png" alt="Wood" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 16px; color: ${textColor};">${formatNumber(upgradeCost.wood)}</span>`;
      html += `<img src="images/${hasEnough ? 'save' : 'no'}.png?v=${Date.now()}" alt="${hasEnough ? 'Available' : 'Not Available'}" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; transform: rotate(15deg); z-index: 5;">`;
      html += `</span>`;
    }
    if (upgradeCost.stone > 0) {
      const hasEnough = gameState.resources.stone >= upgradeCost.stone;
      const borderColor = 'rgba(255,255,255,0.2)';
      const textColor = '#FFFFFF';
      html += `<span style="display: flex; align-items: center; gap: 5px; padding: 5px 8px; background: ${resourceBgColors.stone}; border-radius: 5px; border: 3px solid ${borderColor}; position: relative;">`;
      html += `<img src="images/rock.png" alt="Stone" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 16px; color: ${textColor};">${formatNumber(upgradeCost.stone)}</span>`;
      html += `<img src="images/${hasEnough ? 'save' : 'no'}.png?v=${Date.now()}" alt="${hasEnough ? 'Available' : 'Not Available'}" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; transform: rotate(15deg); z-index: 5;">`;
      html += `</span>`;
    }
    if (upgradeCost.clay > 0) {
      const hasEnough = gameState.resources.clay >= upgradeCost.clay;
      const borderColor = 'rgba(255,255,255,0.2)';
      const textColor = '#FFFFFF';
      html += `<span style="display: flex; align-items: center; gap: 5px; padding: 5px 8px; background: ${resourceBgColors.clay}; border-radius: 5px; border: 3px solid ${borderColor}; position: relative;">`;
      html += `<img src="images/clay.png" alt="Clay" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 16px; color: ${textColor};">${formatNumber(upgradeCost.clay)}</span>`;
      html += `<img src="images/${hasEnough ? 'save' : 'no'}.png?v=${Date.now()}" alt="${hasEnough ? 'Available' : 'Not Available'}" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; transform: rotate(15deg); z-index: 5;">`;
      html += `</span>`;
    }
    if (upgradeCost.iron > 0) {
      const hasEnough = gameState.resources.iron >= upgradeCost.iron;
      const borderColor = 'rgba(255,255,255,0.2)';
      const textColor = '#FFFFFF';
      html += `<span style="display: flex; align-items: center; gap: 5px; padding: 5px 8px; background: ${resourceBgColors.iron}; border-radius: 5px; border: 3px solid ${borderColor}; position: relative;">`;
      html += `<img src="images/iron.png" alt="Iron" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 16px; color: ${textColor};">${formatNumber(upgradeCost.iron)}</span>`;
      html += `<img src="images/${hasEnough ? 'save' : 'no'}.png?v=${Date.now()}" alt="${hasEnough ? 'Available' : 'Not Available'}" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; transform: rotate(15deg); z-index: 5;">`;
      html += `</span>`;
    }
    if (upgradeCost.bricks > 0) {
      const hasEnough = gameState.resources.bricks >= upgradeCost.bricks;
      const borderColor = 'rgba(255,255,255,0.2)';
      const textColor = '#FFFFFF';
      html += `<span style="display: flex; align-items: center; gap: 5px; padding: 5px 8px; background: ${resourceBgColors.bricks}; border-radius: 5px; border: 3px solid ${borderColor}; position: relative;">`;
      html += `<img src="images/claybricks.png" alt="Bricks" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 16px; color: ${textColor};">${formatNumber(upgradeCost.bricks)}</span>`;
      html += `<img src="images/${hasEnough ? 'save' : 'no'}.png?v=${Date.now()}" alt="${hasEnough ? 'Available' : 'Not Available'}" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; transform: rotate(15deg); z-index: 5;">`;
      html += `</span>`;
    }
    if (upgradeCost.gold > 0) {
      const hasEnough = gameState.resources.gold >= upgradeCost.gold;
      const borderColor = 'rgba(255,255,255,0.2)';
      const textColor = '#000000';
      html += `<span style="display: flex; align-items: center; gap: 5px; padding: 5px 8px; background: ${resourceBgColors.gold}; border-radius: 5px; border: 3px solid ${borderColor}; position: relative;">`;
      html += `<img src="images/gold.png" alt="Gold" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 16px; color: ${textColor};">${formatNumber(upgradeCost.gold)}</span>`;
      html += `<img src="images/${hasEnough ? 'save' : 'no'}.png?v=${Date.now()}" alt="${hasEnough ? 'Available' : 'Not Available'}" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; transform: rotate(15deg); z-index: 5;">`;
      html += `</span>`;
    }
    if (upgradeCost.ironBars > 0) {
      const hasEnough = gameState.resources.ironBars >= upgradeCost.ironBars;
      const borderColor = 'rgba(255,255,255,0.2)';
      const textColor = '#FFFFFF';
      html += `<span style="display: flex; align-items: center; gap: 5px; padding: 5px 8px; background: ${resourceBgColors.ironBars}; border-radius: 5px; border: 3px solid ${borderColor}; position: relative;">`;
      html += `<img src="images/ironBar.webp" alt="Iron Bars" style="width: 35px; height: 35px; vertical-align: middle;">`;
      html += `<span style="font-weight: bold; font-size: 16px; color: ${textColor};">${formatNumber(upgradeCost.ironBars)}</span>`;
      html += `<img src="images/${hasEnough ? 'save' : 'no'}.png?v=${Date.now()}" alt="${hasEnough ? 'Available' : 'Not Available'}" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; transform: rotate(15deg); z-index: 5;">`;
      html += `</span>`;
    }
    html += `</div>`;
    html += `<button id="upgrade-btn" ${!canAffordUpgrade ? 'disabled' : ''}><img src="images/upgrade.png" alt="Upgrade" style="width: 30px; height: 30px; vertical-align: middle; margin-right: 5px;"> Upgrade</button>`;
    } else {
    html += `<p>Max level reached</p>`;
  }
  
  html += `<button id="remove-btn"><img src="images/sell.png" alt="Sell" style="width: 30px; height: 30px; vertical-align: middle; margin-right: 5px;">50% refund</button>`;
  
  infoPanel.innerHTML = html;
  
  // Add event listener for add fuel button
  const addFuelBtn = document.getElementById('add-fuel-btn');
  if (addFuelBtn) {
    const newAddFuelBtn = addFuelBtn.cloneNode(true);
    addFuelBtn.parentNode.replaceChild(newAddFuelBtn, addFuelBtn);
    newAddFuelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedTile && addFuelToSmelter(selectedTile.row, selectedTile.col)) {
        updateTileInfo();
        updateUI();
        showMessage("Added wood to fuel storage.");
      } else {
        showMessage("Cannot add fuel: storage is full or insufficient wood.");
      }
    });
  }
  
  // Add event listener for add coal button
  const addCoalBtn = document.getElementById('add-coal-btn');
  if (addCoalBtn) {
    const newAddCoalBtn = addCoalBtn.cloneNode(true);
    addCoalBtn.parentNode.replaceChild(newAddCoalBtn, addCoalBtn);
    newAddCoalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedTile && addCoalToSmelter(selectedTile.row, selectedTile.col)) {
        updateTileInfo();
        updateUI();
        showMessage("Added coal to fuel storage.");
      } else {
        showMessage("Cannot add coal: storage is full or insufficient coal.");
      }
    });
  }
  
  // Add event listeners for batch icons (clickable to remove)
  const batchIcons = document.querySelectorAll('.batch-icon');
  batchIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedTile) {
        const smelter = getSmelter(selectedTile.row, selectedTile.col, false);
        if (smelter && smelter.queue) {
          // Get the queue index directly from the data attribute
          const queueIndex = parseInt(icon.getAttribute('data-queue-index'));
          const currentlySmelting = (smelter.smeltingStartTime !== null) ? 1 : 0;
          
          // Can't remove the batch currently being smelted (index 0)
          if (queueIndex === 0 && currentlySmelting > 0) {
            showMessage("Cannot remove batch: batch is being processed.");
            return;
          }
          
          if (queueIndex >= 0 && queueIndex < smelter.queue.length) {
            const batchToRemove = smelter.queue[queueIndex];
            const building = buildingTypes.smelter;
            
            // Refund resources
            if (batchToRemove.type === 'clay') {
              gameState.resources.clay += building.smeltClayAmount;
              gameState.resources.wood += building.smeltClayWoodAmount;
            } else if (batchToRemove.type === 'iron') {
              gameState.resources.iron += building.smeltIronAmount;
              gameState.resources.wood += building.smeltIronWoodAmount;
            }
            
            // Remove from queue at the correct index
            smelter.queue.splice(queueIndex, 1);
            
            const mineralName = batchToRemove.type === 'clay' ? 'clay' : 'iron';
            updateTileInfo();
            updateUI();
            showMessage(`Removed 1 batch of ${mineralName}. Resources refunded.`);
          } else {
            showMessage("Cannot remove batch: invalid index.");
          }
        } else {
          showMessage("Cannot remove batch.");
        }
      }
    });
    // Add hover effect
    icon.addEventListener('mouseenter', () => {
      icon.style.opacity = '0.7';
      icon.style.transform = 'scale(1.1)';
    });
    icon.addEventListener('mouseleave', () => {
      icon.style.opacity = '1';
      icon.style.transform = 'scale(1)';
    });
  });
  
  // Add event listeners
  const upgradeBtn = document.getElementById('upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      if (upgradeBuilding(selectedTile.row, selectedTile.col)) {
        const building = buildingTypes[gameState.map[selectedTile.row][selectedTile.col].type];
        const newLevel = gameState.map[selectedTile.row][selectedTile.col].level;
        showMessage(`${building.displayName} upgraded to Level ${newLevel}!`);
    } else {
        showMessage("Cannot upgrade: insufficient resources or max level reached.");
      }
    });
  }
  
  const removeBtn = document.getElementById('remove-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      if (await showConfirmation('Remove this building? You will receive 50% refund.')) {
        removeBuilding(selectedTile.row, selectedTile.col);
        selectedTile = null;
        updateTileInfo();
        showMessage("Building removed.");
      }
    });
  }
  
  // Add smelter management event listeners using event delegation
  // Use event delegation - listen on the panel, filter by button ID
  if (infoPanel) {
    // Check if listener already exists by checking for a data attribute
    if (!infoPanel.hasAttribute('data-smelter-listeners')) {
      infoPanel.setAttribute('data-smelter-listeners', 'true');
      infoPanel.addEventListener('click', (e) => {
        if (e.target.closest('#load-clay-btn')) {
          e.preventDefault();
          e.stopPropagation();
          if (selectedTile && loadMineralToSmelter(selectedTile.row, selectedTile.col, 'clay')) {
            updateTileInfo();
            updateUI();
            showMessage("Loaded clay into smelter. Smelting started!");
          } else {
            showMessage("Cannot load clay: smelter is busy, or insufficient clay/wood.");
          }
        } else if (e.target.closest('#load-iron-btn')) {
          e.preventDefault();
          e.stopPropagation();
          if (selectedTile && loadMineralToSmelter(selectedTile.row, selectedTile.col, 'iron')) {
            updateTileInfo();
            updateUI();
            showMessage("Loaded iron into smelter. Smelting started!");
          } else {
            showMessage("Cannot load iron: smelter is busy, or insufficient iron/wood.");
          }
        } else if (e.target.closest('#harvest-smelter-btn')) {
          e.preventDefault();
          e.stopPropagation();
          if (selectedTile) {
            const harvested = harvestSmelter(selectedTile.row, selectedTile.col);
            if (harvested.bricks > 0 || harvested.ironBars > 0) {
              let message = "Harvested: ";
              const parts = [];
              if (harvested.bricks > 0) parts.push(`${harvested.bricks} bricks`);
              if (harvested.ironBars > 0) parts.push(`${harvested.ironBars} iron bars`);
              message += parts.join(" + ");
              showMessage(message + "!");
              updateTileInfo();
              updateUI();
            } else {
              showMessage("Nothing ready to harvest.");
            }
          }
        }
      });
    }
  }
}

// Position tooltip to follow cursor
function positionTooltip(event, tooltip) {
  if (!tooltip) return;
  
  // Position tooltip below the cursor with offset so it doesn't block what cursor is pointing at
  const offsetX = 0; // Small horizontal offset
  const offsetY = 25; // Vertical offset below cursor
  
  tooltip.style.left = (event.clientX + offsetX) + 'px';
  tooltip.style.top = (event.clientY + offsetY) + 'px';
  
  // Ensure tooltip stays within viewport bounds
  const tooltipRect = tooltip.getBoundingClientRect();
  if (tooltipRect.right > window.innerWidth) {
    tooltip.style.left = (window.innerWidth - tooltipRect.width - 10) + 'px';
  }
  if (tooltipRect.left < 0) {
    tooltip.style.left = '10px';
  }
  if (tooltipRect.bottom > window.innerHeight) {
    tooltip.style.top = (event.clientY - tooltipRect.height - 15) + 'px';
  }
}

// Show cell tooltip
function showCellTooltip(event, row, col) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  
  // Check if tile exists
  if (!gameState.map[row] || !gameState.map[row][col]) {
    tooltip.style.display = 'none';
    return;
  }
  
  const tile = gameState.map[row][col];
  
  // Show ownership info for empty owned tiles
  if (tile.type === "empty") {
    if (tile.owned) {
      const playerName = gameState.playerName || 'Player';
      let html = `<strong>Empty Tile</strong><br>`;
      html += `<span style="color: #4CAF50; font-weight: bold;">✓ Owned by ${playerName}</span><br>`;
      html += `<span style="color: #4CAF50; font-size: 11px;">Protected from random events</span><br>`;
      html += `<span style="color: #FFD700; font-size: 11px;">⚡ +5% Production Boost (when building is placed)</span>`;
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      positionTooltip(event, tooltip);
    } else {
      tooltip.style.display = 'none';
    }
    return;
  }
  
  const building = buildingTypes[tile.type];
  
  if (!building) {
    tooltip.style.display = 'none';
    return;
  }
  
  const production = getBuildingProduction(tile.type, tile.level);
  
  // Calculate actual production with owned boost
  const ownedBoost = tile.owned ? 1.05 : 1.0;
  const actualProduction = {
    wood: production.wood * ownedBoost,
    stone: production.stone * ownedBoost,
    clay: production.clay * ownedBoost,
    iron: production.iron * ownedBoost,
    coal: production.coal * ownedBoost,
    bricks: production.bricks * ownedBoost,
    population: production.population * ownedBoost,
    capacity: production.capacity * ownedBoost
  };
  
  let html = `<strong>${building.displayName}</strong><br>`;
  html += `Level: ${tile.level}<br>`;
  
  // Show ownership information if tile is owned
  if (tile.owned) {
    const playerName = gameState.playerName || 'Player';
    html += `<br><span style="color: #4CAF50; font-weight: bold;">✓ Owned by ${playerName}</span><br>`;
  }
  
  // Helper function to format production with boost info
  const formatProductionTooltip = (baseValue, actualValue, label) => {
    if (baseValue <= 0) return '';
    let text = `${label}/sec: ${formatNumberWithDecimals(actualValue)}`;
    if (tile.owned && baseValue > 0) {
      text += ` <span style="color: #FFD700;">(+5%)</span>`;
    }
    return text + '<br>';
  };
  
  if (actualProduction.wood > 0) html += formatProductionTooltip(production.wood, actualProduction.wood, 'Wood');
  if (actualProduction.stone > 0) html += formatProductionTooltip(production.stone, actualProduction.stone, 'Stone');
  if (actualProduction.clay > 0) html += formatProductionTooltip(production.clay, actualProduction.clay, 'Clay');
  if (actualProduction.iron > 0) html += formatProductionTooltip(production.iron, actualProduction.iron, 'Iron');
  if (actualProduction.coal > 0) html += formatProductionTooltip(production.coal, actualProduction.coal, 'Coal');
  if (actualProduction.population > 0) html += formatProductionTooltip(production.population, actualProduction.population, 'Population');
  if (actualProduction.capacity > 0) {
    html += `Capacity: ${formatNumber(actualProduction.capacity)}`;
    if (tile.owned && production.capacity > 0) {
      html += ` <span style="color: #FFD700;">(+5%)</span>`;
    }
    html += '<br>';
  }
  
  // Special indicator for smelter - fuel requirement and speed boost
  if (tile.type === "smelter" && building.smeltClayWoodAmount) {
    html += `<br><span style="color: #8B4513; font-weight: bold;">🔥 Clay: ${building.smeltClayWoodAmount} <img src="images/wood-log.png" alt="Wood" style="width: 20px; height: 20px; vertical-align: middle;"> wood or 1 <img src="images/coal.png" alt="Coal" style="width: 20px; height: 20px; vertical-align: middle;"> coal (3 batches) | Iron: ${building.smeltIronWoodAmount} <img src="images/wood-log.png" alt="Wood" style="width: 20px; height: 20px; vertical-align: middle;"> wood or ${building.smeltIronCoalAmount} <img src="images/coal.png" alt="Coal" style="width: 20px; height: 20px; vertical-align: middle;"> coal per batch</span><br>`;
    if (tile.owned) {
      html += `<span style="color: #FFD700; font-weight: bold; font-size: 11px;">⚡ +5% Smelting Speed Boost Active</span><br>`;
    }
  }
  
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  
  // Position tooltip
  positionTooltip(event, tooltip);
}

function hideCellTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// Refresh expansion button text
function updateExpansionUI() {
  const expansionBtn = document.getElementById('expansion-btn');
  const expansionCostEl = document.getElementById('expansion-cost');
  if (expansionCostEl) {
    expansionCostEl.textContent = formatNumber(calculateRandomExpansionCost());
  }
  if (expansionBtn) {
    expansionBtn.disabled = gameState.resources.gold < calculateRandomExpansionCost();
    expansionBtn.title = expansionBtn.disabled ? 'Not enough gold for expansion (2-9 random tiles)' : 'Purchase 2-9 random tiles outside current boundaries';
  }
}

// Update UI
function updateUI() {
  // Update character indicator
  const charIndicator = document.getElementById('character-indicator');
  if (charIndicator && gameState.character) {
    const character = characterTypes[gameState.character];
    charIndicator.textContent = `${character.icon} Playing as ${character.name}`;
    charIndicator.style.display = 'block';
  } else if (charIndicator) {
    charIndicator.style.display = 'none';
  }
  
  // Update player indicator (upper right)
  updatePlayerIndicator();
  
  // Update resources
  const woodEl = document.getElementById('wood');
  const stoneEl = document.getElementById('stone');
  const clayEl = document.getElementById('clay');
  const ironEl = document.getElementById('iron');
  const goldEl = document.getElementById('gold');
  const bricksEl = document.getElementById('bricks');
  const ironBarsEl = document.getElementById('ironBars');
  const coalEl = document.getElementById('coal');
  const populationEl = document.getElementById('population');
  const capacityEl = document.getElementById('housingCapacity');
  
  if (woodEl) woodEl.textContent = formatNumber(gameState.resources.wood);
  if (stoneEl) stoneEl.textContent = formatNumber(gameState.resources.stone);
  if (clayEl) clayEl.textContent = formatNumber(gameState.resources.clay);
  if (ironEl) ironEl.textContent = formatNumber(gameState.resources.iron);
  if (goldEl) goldEl.textContent = formatNumber(gameState.resources.gold);
  
  // Refresh town center modal if open (for real-time quest progress updates)
  refreshTownCenterModalIfOpen();
  if (bricksEl) bricksEl.textContent = formatNumber(gameState.resources.bricks);
  if (ironBarsEl) ironBarsEl.textContent = formatNumber(gameState.resources.ironBars);
  if (coalEl) coalEl.textContent = formatNumber(gameState.resources.coal || 0);
  if (populationEl) populationEl.textContent = formatNumber(gameState.population.current);
  if (capacityEl) capacityEl.textContent = formatNumber(gameState.population.capacity);
  updateExpansionUI();
  
  // Update build menu buttons
  updateBuildMenu();
}

// Attach expansion button handler
function setupExpansionButton() {
  const expansionBtn = document.getElementById('expansion-btn');
  if (!expansionBtn) return;
  
  expansionBtn.addEventListener('click', () => {
    const success = buyRandomExpansion();
    if (!success) {
      updateUI();
    }
  });
  
  updateExpansionUI();
}

// Update build menu
// Check if a single requirement is met
function checkRequirement(requirement) {
  if (requirement.type === 'buildingCount') {
    return countBuildings(requirement.buildingType) >= requirement.amount;
  } else if (requirement.type === 'resource') {
    return (gameState.resources[requirement.resource] || 0) >= requirement.amount;
  } else if (requirement.type === 'population') {
    return gameState.population.current >= requirement.amount;
  }
  return false;
}

// Get progress percentage for a single requirement (0-100)
function getRequirementProgress(requirement) {
  if (requirement.type === 'buildingCount') {
    let count = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].type === requirement.buildingType) {
          count++;
        }
      }
    }
    return Math.min(100, (count / requirement.amount) * 100);
  } else if (requirement.type === 'resource') {
    const current = gameState.resources[requirement.resource] || 0;
    return Math.min(100, (current / requirement.amount) * 100);
  } else if (requirement.type === 'population') {
    return Math.min(100, (gameState.population.current / requirement.amount) * 100);
  }
  return 0;
}

function updateBuildMenu() {
  for (const [key, building] of Object.entries(buildingTypes)) {
    const btn = document.querySelector(`[data-building-type="${key}"]`);
    if (!btn) continue;
    
    // Hide buildings that require a different character
    if (building.requiredCharacter && gameState.character !== building.requiredCharacter) {
      btn.style.display = 'none';
      continue;
    } else {
      btn.style.display = 'block';
    }
    
    // Ensure building icon is present (front and center)
    const iconPath = buildingIcons[key];
    if (iconPath) {
      let buildingIcon = btn.querySelector('img.building-icon');
      if (!buildingIcon) {
        buildingIcon = document.createElement('img');
        buildingIcon.src = iconPath;
        buildingIcon.alt = building.displayName;
        buildingIcon.className = 'building-icon';
        // Insert icon at the beginning
        btn.insertBefore(buildingIcon, btn.firstChild);
      } else {
        // Ensure icon is at the beginning
        if (buildingIcon !== btn.firstChild) {
          btn.insertBefore(buildingIcon, btn.firstChild);
        }
      }
    }
    
    // Apply category-based colors
    const colors = getCategoryColors(building.category, key);
    btn.style.background = colors.gradient;
    btn.style.borderColor = colors.border;
    
    const cost = getBuildingCost(key, 1);
    const affordable = canAfford(cost);
    
    btn.disabled = !building.unlocked || !affordable;
    
    // Remove existing requirement display
    const existingReqs = btn.querySelector('.building-requirements');
    if (existingReqs) {
      existingReqs.remove();
    }
    
    if (!building.unlocked) {
      // Find the milestone quest that unlocks this building
      const unlockQuest = questDefinitions.find(q => q.unlocksBuilding === key);
      if (unlockQuest) {
        btn.title = `Complete milestone quest to unlock: ${unlockQuest.title}`;
        
        // Add requirement icons if quest has requirements
        // Place requirements after the building name (which comes after the icon)
        if (unlockQuest.requirements && unlockQuest.requirements.length > 0) {
          const reqContainer = document.createElement('div');
          reqContainer.className = 'building-requirements';
          reqContainer.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-top: 4px; padding: 4px; width: 100%;';
          
          // Filter out completed requirements
          const incompleteRequirements = unlockQuest.requirements.filter(req => !checkRequirement(req));
          
          // Calculate overall progress (only count incomplete requirements for display)
          let totalProgress = 0;
          unlockQuest.requirements.forEach(req => {
            totalProgress += getRequirementProgress(req);
          });
          const overallProgress = totalProgress / unlockQuest.requirements.length;
          
          // Add overall progress bar
          const progressBarContainer = document.createElement('div');
          progressBarContainer.style.cssText = 'width: 100%; position: relative; background: rgba(0,0,0,0.3); border-radius: 4px; height: 12px; overflow: hidden;';
          
          const progressBarFill = document.createElement('div');
          progressBarFill.style.cssText = `position: absolute; left: 0; top: 0; height: 100%; background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%); width: ${overallProgress}%; transition: width 0.3s ease; border-radius: 4px;`;
          
          const progressBarText = document.createElement('div');
          progressBarText.style.cssText = 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: white; font-weight: bold; z-index: 2; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);';
          progressBarText.textContent = `${Math.round(overallProgress)}%`;
          
          progressBarContainer.appendChild(progressBarFill);
          progressBarContainer.appendChild(progressBarText);
          reqContainer.appendChild(progressBarContainer);
          
          // Add individual requirement items (only show incomplete requirements)
          if (incompleteRequirements.length > 0) {
            const reqItemsContainer = document.createElement('div');
            reqItemsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; align-items: center;';
            
            incompleteRequirements.forEach(req => {
              const reqItem = document.createElement('div');
              reqItem.style.cssText = 'display: flex; align-items: center; gap: 2px; position: relative; padding: 2px;';
              
              // Create icon
              const icon = document.createElement('img');
              if (req.type === 'buildingCount') {
                icon.src = buildingIcons[req.buildingType] || '';
                icon.alt = buildingTypes[req.buildingType]?.displayName || '';
              } else if (req.type === 'resource') {
                icon.src = resourceIcons[req.resource] || '';
                icon.alt = req.resource;
              } else if (req.type === 'population') {
                icon.src = resourceIcons.population || '';
                icon.alt = 'Population';
              }
              icon.style.cssText = 'width: 20px; height: 20px; vertical-align: middle;';
              
              // Create amount text
              const amountText = document.createElement('span');
              amountText.textContent = req.amount;
              amountText.style.cssText = 'font-size: 11px; color: white; font-weight: bold;';
              
              reqItem.appendChild(icon);
              reqItem.appendChild(amountText);
              
              reqItemsContainer.appendChild(reqItem);
            });
            
            reqContainer.appendChild(reqItemsContainer);
          }
          
          // Append requirements at the end (after icon and name)
          btn.appendChild(reqContainer);
        }
      } else {
        btn.title = `Complete milestone quest to unlock ${building.displayName}`;
      }
    } else {
      btn.title = `${building.displayName} - Cost: ${cost.wood} wood${cost.stone > 0 ? `, ${cost.stone} stone` : ''}`;
    }
  }
}

// Get last used save slot (defaults to 1)
function getLastSaveSlot() {
  const lastSlot = localStorage.getItem('cityBuilderLastSlot');
  return lastSlot ? parseInt(lastSlot) : 1;
}

// Set last used save slot
function setLastSaveSlot(slot) {
  localStorage.setItem('cityBuilderLastSlot', slot.toString());
}

// Cycle to next save slot (1->2, 2->3, 3->1)
function cycleToNextSaveSlot() {
  const currentSlot = getLastSaveSlot();
  const nextSlot = currentSlot === 3 ? 1 : currentSlot + 1;
  setLastSaveSlot(nextSlot);
  return nextSlot;
}

// Save game (uses last saved slot)
function saveGame() {
  const lastSlot = getLastSaveSlot();
  gameState.timestamp = Date.now();
  
  // Save building unlock states
  if (!gameState.buildingUnlocks) {
    gameState.buildingUnlocks = {};
  }
  for (const [key, building] of Object.entries(buildingTypes)) {
    gameState.buildingUnlocks[key] = building.unlocked;
  }
  
  const slotKey = `cityBuilderSave_slot${lastSlot}`;
  localStorage.setItem(slotKey, JSON.stringify(gameState));
  setLastSaveSlot(lastSlot);
  updateSaveStatus();
  updateSaveSlots();
  // showMessage("Game saved!");
}

// Save game to specific slot
function saveGameSlot(slot) {
  gameState.timestamp = Date.now();
  
  // Save building unlock states
  if (!gameState.buildingUnlocks) {
    gameState.buildingUnlocks = {};
  }
  for (const [key, building] of Object.entries(buildingTypes)) {
    gameState.buildingUnlocks[key] = building.unlocked;
  }
  
  const slotKey = `cityBuilderSave_slot${slot}`;
  localStorage.setItem(slotKey, JSON.stringify(gameState));
  setLastSaveSlot(slot);
  updateSaveSlots();
  showMessage(`Game saved to slot ${slot}!`);
  hideLoadMenu();
}

// Delete game from specific slot
function deleteGameSlot(slot) {
  const slotKey = `cityBuilderSave_slot${slot}`;
  const saved = localStorage.getItem(slotKey);
  
  if (!saved) {
    showMessage("No save found in this slot.");
    return;
  }
  
  showConfirmation(`Are you sure you want to delete the save in slot ${slot}? This cannot be undone.`).then(confirmed => {
    if (confirmed) {
      localStorage.removeItem(slotKey);
      updateSaveSlots();
      showMessage(`Save slot ${slot} deleted.`);
    }
  });
}

// Load game from specific slot
function loadGameSlot(slot) {
  const slotKey = `cityBuilderSave_slot${slot}`;
  const saved = localStorage.getItem(slotKey);
  if (!saved) {
    showMessage("No save found in this slot.");
    return;
  }
  
  showConfirmation('Load this save? Current progress will be lost.').then(confirmed => {
    if (confirmed) {
      try {
        gameState = JSON.parse(saved);
        migrateSaveData();
        applyPlayerColor();
      updatePlayerIndicator();
      initializeQuests();
      calculateProduction();
      checkUnlocks();
      checkQuests();
      checkAllTownQuests(); // Check town quests on load
      renderGrid();
      updateUI();
      updateSaveStatus();
      updateQuestIndicator();
      initializeBuildMenu();
      updateBuildMenu();
      initializeResourceTooltips();
      setupExpansionButton();
      setupZoomControls();
      setLastSaveSlot(slot);
      updateSaveSlots();
      startGameLoop();
      hideLoadMenu();
      showMessage(`Game loaded from slot ${slot}!`);
      } catch (e) {
        console.error('Error loading game:', e);
        showMessage("Error loading save file.");
      }
    }
  });
}

// Load game (checks last used slot first, then old default save)
function loadGame() {
  const lastSlot = getLastSaveSlot();
  const slotKey = `cityBuilderSave_slot${lastSlot}`;
  let saved = localStorage.getItem(slotKey);
  let loadedFromOldSave = false;
  
  if (!saved) {
    saved = localStorage.getItem('cityBuilderSave');
    loadedFromOldSave = !!saved;
  }
  
  if (saved) {
    try {
      gameState = JSON.parse(saved);
      
      if (loadedFromOldSave) {
        setLastSaveSlot(1);
        localStorage.setItem('cityBuilderSave_slot1', saved);
        localStorage.removeItem('cityBuilderSave');
      }
      
      migrateSaveData();
      applyPlayerColor();
      updatePlayerIndicator();
      initializeQuests();
      calculateProduction();
      checkUnlocks();
      checkQuests();
      
      return true;
    } catch (e) {
      console.error('Error loading game:', e);
    }
  }
  return false;
}

// Reset game
function resetGame() {
  // Initialize upgrades object if it doesn't exist
  if (!gameState.upgrades) {
    gameState.upgrades = {
      woodProduction: false,
      stoneProduction: false,
      clayProduction: false,
      housingCapacity: false,
      smeltingSpeed: false
    };
  }
  showConfirmation('Are you sure you want to reset your game? This cannot be undone.').then(confirmed => {
    if (confirmed) {
      localStorage.removeItem('cityBuilderSave');
      // Cycle to next save slot for new game
      cycleToNextSaveSlot();
      gameState = {
      resources: { wood: 50, stone: 0, clay: 0, iron: 0, gold: 0, bricks: 0, ironBars: 0, coal: 0 },
      rates: { wps: 1, sps: 0, cps: 0, ips: 0, gps: 0, bps: 0 }, // Base 1 wps
      smelters: {},
      population: { current: 0, capacity: 0 },
      map: [],
      character: null, // Reset character selection
      playerColor: null, // Reset player color
      playerName: null, // Reset player name
      timestamp: Date.now(),
      upgrades: {
        woodProduction: false,
        stoneProduction: false,
        clayProduction: false,
        housingCapacity: false,
        smeltingSpeed: false
      },
      quests: [],
      merchantCooldowns: {
        wood: { totalTraded: 0, cooldownStart: null },
        stone: { totalTraded: 0, cooldownStart: null },
        clay: { totalTraded: 0, cooldownStart: null }
      }
    };
    resetBuildingUnlocks();
    initializeQuests();
    initializeGrid();
    calculateProduction();
    checkUnlocks();
    checkQuests();
    renderGrid();
    updateUI();
    updateSaveStatus();
    updateQuestIndicator();
    selectedBuildingType = null;
    selectedTile = null;
    updateBuildingSelection();
    updateTileInfo();
    // Show character selection screen
    showCharacterSelection();
    }
  });
}

// Update save status
function updateSaveStatus() {
  const saveStatusEl = document.getElementById('saveStatus');
  if (saveStatusEl && gameState.timestamp) {
    const saveDate = new Date(gameState.timestamp);
    saveStatusEl.textContent = `Last saved: ${saveDate.toLocaleString()}`;
  }
}

// Show load menu
function showLoadMenu() {
  const loadModal = document.getElementById('load-modal');
  if (loadModal) {
    loadModal.style.display = 'flex';
    updateSaveSlots();
  }
}

// Hide load menu
function hideLoadMenu() {
  const loadModal = document.getElementById('load-modal');
  if (loadModal) {
    loadModal.style.display = 'none';
  }
}

// Update save slots display
function updateSaveSlots() {
  const currentActiveSlot = getLastSaveSlot();
  
  for (let slot = 1; slot <= 3; slot++) {
    const slotKey = `cityBuilderSave_slot${slot}`;
    const saved = localStorage.getItem(slotKey);
    const slotInfo = document.getElementById(`slot-${slot}-info`);
    const slotElement = document.querySelector(`.save-slot[data-slot="${slot}"]`);
    const deleteBtn = document.querySelector(`.slot-delete-btn[data-slot="${slot}"]`);
    
    // Update active state
    if (slotElement) {
      if (slot === currentActiveSlot) {
        slotElement.classList.add('active-slot');
      } else {
        slotElement.classList.remove('active-slot');
      }
    }
    
    if (slotInfo) {
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.timestamp) {
            const saveDate = new Date(data.timestamp);
            slotInfo.textContent = `Saved: ${saveDate.toLocaleString()}`;
            if (slotElement) slotElement.classList.add('has-save');
            if (deleteBtn) deleteBtn.disabled = false;
          } else {
            slotInfo.textContent = 'Empty';
            if (slotElement) slotElement.classList.remove('has-save');
            if (deleteBtn) deleteBtn.disabled = true;
          }
        } catch (e) {
          slotInfo.textContent = 'Empty';
          if (slotElement) slotElement.classList.remove('has-save');
          if (deleteBtn) deleteBtn.disabled = true;
        }
      } else {
        slotInfo.textContent = 'Empty';
        if (slotElement) slotElement.classList.remove('has-save');
        if (deleteBtn) deleteBtn.disabled = true;
      }
    }
  }
}

// Export save to file
function exportSave() {
  gameState.timestamp = Date.now();
  const saveData = JSON.stringify(gameState, null, 2);
  const blob = new Blob([saveData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `city-builder-save-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMessage("Save file exported!");
}

// Import save from file
function importSave(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const loaded = JSON.parse(e.target.result);
      
      showConfirmation('Import this save? Current progress will be lost.').then(confirmed => {
        if (confirmed) {
          gameState = loaded;
          migrateSaveData();
          applyPlayerColor();
          updatePlayerIndicator();
          initializeQuests();
          calculateProduction();
          checkUnlocks();
          checkQuests();
          renderGrid();
          updateUI();
          updateSaveStatus();
          updateQuestIndicator();
          initializeBuildMenu();
          updateBuildMenu();
          initializeResourceTooltips();
          setupExpansionButton();
          setupZoomControls();
          updateSaveSlots();
          startGameLoop();
          showMessage("Save file imported!");
        }
      });
    } catch (e) {
      console.error('Error importing save:', e);
      showMessage("Error: Invalid save file.");
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset file input
}

// Show building button tooltip
function showBuildingTooltip(event, buildingType) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  
  const building = buildingTypes[buildingType];
  if (!building) return;
  
  // Building buttons always show level 1 (new placement)
  const level = 1;
  
  // Determine color based on building category
  let categoryColor = '#FFD700'; // Default gold
  if (building.category === 'farming') {
    categoryColor = '#4CAF50'; // Green
  } else if (building.category === 'wood') {
    categoryColor = '#8B4513'; // Brown
  } else if (building.category === 'stone') {
    // Check if it's an iron-related building
    if (buildingType === 'ironMine') {
      categoryColor = '#708090'; // Iron color
    } else {
      categoryColor = '#9E9E9E'; // Grey
    }
  }
  
  const cost = getBuildingCost(buildingType, level);
  const production = getBuildingProduction(buildingType, level);
  const affordable = canAfford(cost);
  
  let html = `<strong style="color: ${categoryColor};">${building.displayName}</strong><br>`;
  
  // Cost
  html += `<p style="margin: 3px 0;"><strong style="color: ${categoryColor};">Cost:</strong> `;
  html += `<span style="color: ${affordable ? '#4CAF50' : '#f44336'}">`;
    if (cost.wood > 0) {
      html += `<span style="font-size: 20px; font-weight: bold;">${formatNumber(cost.wood)}</span> <img src="images/wood-log.png" alt="Wood" style="width: 50px; height: 50px; vertical-align: middle;">`;
    }
    if (cost.bricks > 0) {
      if (cost.wood > 0) html += ` `;
      html += `<span style="font-size: 20px; font-weight: bold;">${formatNumber(cost.bricks)}</span> <img src="images/claybricks.png" alt="Bricks" style="width: 50px; height: 50px; vertical-align: middle;">`;
    }
    if (cost.stone > 0) {
      if (cost.wood > 0 || cost.bricks > 0) html += ` `;
      html += `<span style="font-size: 20px; font-weight: bold;">${formatNumber(cost.stone)}</span> <img src="images/rock.png" alt="Stone" style="width: 50px; height: 50px; vertical-align: middle;">`;
    }
    if (cost.clay > 0) {
      if (cost.wood > 0 || cost.bricks > 0 || cost.stone > 0) html += ` `;
      html += `<span style="font-size: 20px; font-weight: bold;">${formatNumber(cost.clay)}</span> <img src="images/clay.png" alt="Clay" style="width: 50px; height: 50px; vertical-align: middle;">`;
    }
    if (cost.iron > 0) {
      if (cost.wood > 0 || cost.bricks > 0 || cost.stone > 0 || cost.clay > 0) html += ` `;
      html += `<span style="font-size: 20px; font-weight: bold;">${formatNumber(cost.iron)}</span> <img src="images/iron.png" alt="Iron" style="width: 50px; height: 50px; vertical-align: middle;">`;
    }
    if (cost.gold > 0) {
      if (cost.wood > 0 || cost.bricks > 0 || cost.stone > 0 || cost.clay > 0 || cost.iron > 0) html += ` `;
      html += `<span style="font-size: 20px; font-weight: bold;">${formatNumber(cost.gold)}</span> <img src="images/gold.png" alt="Gold" style="width: 50px; height: 50px; vertical-align: middle;">`;
    }
  html += `</span></p>`;
  
  // Production/Benefits
  html += `<p style="margin: 3px 0;"><strong style="color: ${categoryColor};">Produces:</strong> `;
  let hasProduction = false;
    if (production.wood > 0) {
      html += `<span style="color: #8B4513; font-size: 18px; font-weight: bold;">${formatNumberWithDecimals(production.wood)} <img src="images/wood-log.png" alt="Wood" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
      hasProduction = true;
    }
    if (production.stone > 0) {
      if (hasProduction) html += `, `;
      html += `<span style="color: #9E9E9E; font-size: 18px; font-weight: bold;">${formatNumberWithDecimals(production.stone)} <img src="images/rock.png" alt="Stone" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
      hasProduction = true;
    }
    if (production.clay > 0) {
      if (hasProduction) html += `, `;
      html += `<span style="color: #8D6E63; font-size: 18px; font-weight: bold;">${formatNumberWithDecimals(production.clay)} <img src="images/clay.png" alt="Clay" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
      hasProduction = true;
    }
    if (production.iron > 0) {
      if (hasProduction) html += `, `;
      html += `<span style="color: #708090; font-size: 18px; font-weight: bold;">${formatNumberWithDecimals(production.iron)} <img src="images/iron.png" alt="Iron" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
      hasProduction = true;
    }
    if (production.coal > 0) {
      if (hasProduction) html += `, `;
      html += `<span style="color: #CCCCCC; font-size: 18px; font-weight: bold;">${formatNumberWithDecimals(production.coal)} <img src="images/coal.png" alt="Coal" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
      hasProduction = true;
    }
    if (production.population > 0) {
      if (hasProduction) html += `, `;
      html += `<span style="color: #4CAF50; font-size: 18px; font-weight: bold;">${formatNumberWithDecimals(production.population)} <img src="images/population.png" alt="Population" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
      hasProduction = true;
    }
  if (production.capacity > 0) {
    if (hasProduction) html += `, `;
    html += `<span style="color: #FF9800; font-size: 18px; font-weight: bold;">+${production.capacity} <img src="images/cabin.png" alt="Capacity" style="width: 35px; height:35px; vertical-align: middle;"></span>`;
    hasProduction = true;
  }
  if (!hasProduction) {
    html += `<span style="color: #888;">None</span>`;
  }
  html += `</p>`;
  
  // Special info for smelter - fuel requirement
  if (buildingType === "smelter" && building.smeltClayWoodAmount) {
    html += `<p style="margin: 3px 0; padding: 5px; background: rgba(139, 69, 19, 0.2); border-left: 3px solid #8B4513; border-radius: 3px;">`;
    html += `<strong style="color: #8B4513;">🔥 Fuel Required:</strong> `;
    html += `<span style="color: #8B4513; font-size: 18px; font-weight: bold;">Clay: ${building.smeltClayWoodAmount} <img src="images/wood-log.png" alt="Wood" style="width: 30px; height: 30px; vertical-align: middle;"> wood or 1 <img src="images/coal.png" alt="Coal" style="width: 30px; height: 30px; vertical-align: middle;"> coal (3 batches) | Iron: ${building.smeltIronWoodAmount} <img src="images/wood-log.png" alt="Wood" style="width: 30px; height: 30px; vertical-align: middle;"> wood or ${building.smeltIronCoalAmount} <img src="images/coal.png" alt="Coal" style="width: 30px; height: 30px; vertical-align: middle;"> coal per batch</span>`;
    html += `<br><span style="font-size: 12px; color: #aaa;">Converts ${building.smeltClayAmount} clay + ${building.smeltClayWoodAmount} wood (or 1 coal for 3 batches) → ${building.smeltBrickOutput} brick (${building.smeltClayTime/1000}s) | ${building.smeltIronAmount} iron + ${building.smeltIronWoodAmount} wood (or ${building.smeltIronCoalAmount} coal) → ${building.smeltIronBarOutput} iron bar (${building.smeltIronTime/1000}s)</span>`;
    html += `</p>`;
  }
  
    // Special info for base marker - claims surrounding tiles in 3x3 area
  if (buildingType === "baseMarker") {
    html += `<p style="margin: 3px 0; padding: 5px; background: rgba(156, 39, 176, 0.2); border-left: 3px solid #9C27B0; border-radius: 3px;">`;
    html += `<strong style="color: #9C27B0;">📍 Special Ability:</strong> `;
    html += `<span style="color: #9C27B0; font-size: 18px; font-weight: bold;">Claims all surrounding tiles in a 3x3 area, protecting them from random events</span>`;
    html += `</p>`;
  }
  
  // Character requirement
  if (building.requiredCharacter) {
    const charName = characterTypes[building.requiredCharacter]?.name || building.requiredCharacter;
    html += `<p style="margin: 3px 0; color: #FFD700;"><strong>Character:</strong> ${charName} only</p>`;
  }
  
  // Character bonus info
  if (gameState.character) {
    const character = characterTypes[gameState.character];
    if (gameState.character === 'farmer' && building.category === 'farming') {
      html += `<p style="margin: 3px 0; color: ${categoryColor};"><strong>Farmer Bonus:</strong> +50% production, +30% population growth</p>`;
    }
    if (gameState.character === 'miner' && building.category === 'stone') {
      const bonusColor = buildingType === 'ironMine' ? '#708090' : categoryColor;
      html += `<p style="margin: 3px 0; color: ${bonusColor};"><strong>Miner Bonus:</strong> +50% production, 20% discount</p>`;
    }
    if (gameState.character === 'farmer' && level === 1 && building.category === 'farming') {
      html += `<p style="margin: 3px 0; color: ${categoryColor};"><strong>Farmer Bonus:</strong> 20% discount on farm buildings</p>`;
    }
  }
  
  // Show milestone quest info if locked
  if (!building.unlocked) {
    const unlockQuest = questDefinitions.find(q => q.unlocksBuilding === buildingType);
    if (unlockQuest) {
      html += `<p style="margin: 3px 0; color: #ff9800;"><strong>To Unlock:</strong> Complete milestone quest "${unlockQuest.title}"</p>`;
    } else {
      html += `<p style="margin: 3px 0; color: #ff9800;"><strong>To Unlock:</strong> Complete milestone quest</p>`;
    }
  }
  
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  
  // Position tooltip
  positionTooltip(event, tooltip);
}

function hideBuildingTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// Initialize build menu buttons
function initializeBuildMenu() {
  for (const [key, building] of Object.entries(buildingTypes)) {
    const btn = document.querySelector(`[data-building-type="${key}"]`);
    if (btn) {
      // Add icon to button if it exists
      const iconPath = buildingIcons[key];
      if (iconPath && !btn.querySelector('img')) {
        const icon = document.createElement('img');
        icon.src = iconPath;
        icon.alt = building.displayName;
        icon.className = 'building-icon';
        btn.insertBefore(icon, btn.firstChild);
      }
      
      // Apply category-based colors
      const colors = getCategoryColors(building.category, key);
      btn.style.background = colors.gradient;
      btn.style.borderColor = colors.border;
      
      btn.addEventListener('click', () => selectBuildingType(key));
      btn.addEventListener('mouseenter', (e) => showBuildingTooltip(e, key));
      btn.addEventListener('mousemove', (e) => {
        const tooltip = document.getElementById('tooltip');
        if (tooltip && tooltip.style.display === 'block') {
          positionTooltip(e, tooltip);
        }
      });
      btn.addEventListener('mouseleave', hideBuildingTooltip);
    }
  }
}

// Main game loop
let lastAutoSave = Date.now();
let gameLoopInterval = null;
let merchantCooldownUpdateInterval = null;

function startGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
  }
  
  gameLoopInterval = setInterval(() => {
    // Check town quests periodically
    checkAllTownQuests();
    try {
      // Only run if game is initialized
      if (!gameState || !gameState.map || gameState.map.length === 0) {
        return;
      }
      
      // Check for expired events and boosts
      checkEventExpirations();
      
      // Update resources based on production
      if (gameState.rates) {
        gameState.resources.wood += gameState.rates.wps || 0;
        gameState.resources.stone += gameState.rates.sps || 0;
        gameState.resources.clay += gameState.rates.cps || 0;
        gameState.resources.iron += gameState.rates.ips || 0;
        gameState.resources.gold += gameState.rates.gps || 0;
        gameState.resources.bricks += gameState.rates.bps || 0;
        gameState.resources.coal += gameState.rates.coalps || 0;
      }
      
      // Update population
      calculateProduction();
      checkUnlocks();
      checkQuests();
      updateBuildMenu();
      updateUI();
      
      // Auto-save every 20 seconds
      const now = Date.now();
      if (now - lastAutoSave >= 20000) {
        saveGame();
        lastAutoSave = now;
      }
      
      // Update tile info panel if a smelter is selected (to show smelting progress)
      if (selectedTile) {
        const tile = gameState.map[selectedTile.row] && gameState.map[selectedTile.row][selectedTile.col];
        if (tile && tile.type === "smelter") {
          updateTileInfo();
        }
      }
    } catch (e) {
      console.error('Error in game loop:', e);
    }
  }, 1000);
}

// Show resource icon tooltip
function showResourceTooltip(event, resourceType) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  
  const resourceNames = {
    wood: 'Wood',
    stone: 'Stone',
    clay: 'Clay',
    iron: 'Iron',
    gold: 'Gold',
    bricks: 'Clay Bricks',
    ironBars: 'Iron Bars',
    coal: 'Coal'
  };
  
  const resourceIcons = {
    wood: 'images/wood-log.png',
    stone: 'images/rock.png',
    clay: 'images/clay.png',
    iron: 'images/iron.png',
    gold: 'images/gold.png',
    bricks: 'images/claybricks.png',
    ironBars: 'images/ironBar.webp',
    coal: 'images/coal.png'
  };
  
  const resourceColors = {
    wood: '#8B4513',
    stone: '#9E9E9E',
    clay: '#8D6E63',
    iron: '#708090',
    gold: '#FFD700',
    bricks: '#D32F2F',
    ironBars: '#708090',
    coal: '#CCCCCC'
  };
  
  const rateKeys = {
    wood: 'wps',
    stone: 'sps',
    clay: 'cps',
    iron: 'ips',
    gold: 'gps',
    bricks: 'bps',
    ironBars: null, // Iron bars don't have a production rate
    coal: 'coalps' // Coal per second
  };
  
  const resourceName = resourceNames[resourceType] || resourceType;
  const resourceIcon = resourceIcons[resourceType] || '';
  const resourceColor = resourceColors[resourceType] || '#ffffff';
  const rateKey = rateKeys[resourceType];
  const rate = rateKey ? (gameState.rates[rateKey] || 0) : 0;
  
  let html = `<strong>${resourceName}</strong><br>`;
  if (rateKey && rate > 0) {
     html += `<span style="font-size: 18px; color: ${resourceColor};">${formatNumberWithDecimals(rate)}</span> <img src="${resourceIcon}" alt="${resourceName}" style="width: 35px; height: 35px; vertical-align: middle;">/sec`;
  } else {
    // For resources without production rate (like iron bars), just show the icon
    html += `<img src="${resourceIcon}" alt="${resourceName}" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  
  // Position tooltip
  positionTooltip(event, tooltip);
}

function hideResourceTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// Initialize resource icon tooltips
function initializeResourceTooltips() {
  // Handle resource icons with data-resource attribute
  const resourceIcons = document.querySelectorAll('[data-resource]');
  resourceIcons.forEach(icon => {
    const resourceType = icon.getAttribute('data-resource');
    icon.addEventListener('mouseenter', (e) => showResourceTooltip(e, resourceType));
    icon.addEventListener('mousemove', (e) => {
      const tooltip = document.getElementById('tooltip');
      if (tooltip && tooltip.style.display === 'block') {
        positionTooltip(e, tooltip);
      }
    });
    icon.addEventListener('mouseleave', hideResourceTooltip);
  });
  
  // Handle resource number spans - show tooltip when hovering over the number
  const ironBarsSpan = document.getElementById('ironBars');
  if (ironBarsSpan) {
    ironBarsSpan.style.cursor = 'help';
    ironBarsSpan.addEventListener('mouseenter', (e) => showResourceTooltip(e, 'ironBars'));
    ironBarsSpan.addEventListener('mousemove', (e) => {
      const tooltip = document.getElementById('tooltip');
      if (tooltip && tooltip.style.display === 'block') {
        positionTooltip(e, tooltip);
      }
    });
    ironBarsSpan.addEventListener('mouseleave', hideResourceTooltip);
  }
  
  // Handle other icons with data-tooltip attribute (like population, capacity)
  const otherIcons = document.querySelectorAll('[data-tooltip]');
  otherIcons.forEach(icon => {
    // Skip if it also has data-resource (already handled above)
    if (!icon.hasAttribute('data-resource')) {
      const tooltipText = icon.getAttribute('data-tooltip');
      icon.addEventListener('mouseenter', (e) => {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip) return;
        tooltip.innerHTML = `<strong>${tooltipText}</strong>`;
        tooltip.style.display = 'block';
        positionTooltip(e, tooltip);
      });
      icon.addEventListener('mousemove', (e) => {
        const tooltip = document.getElementById('tooltip');
        if (tooltip && tooltip.style.display === 'block') {
          positionTooltip(e, tooltip);
        }
      });
      icon.addEventListener('mouseleave', hideResourceTooltip);
    }
  });
}

// Show character selection screen
function showCharacterSelection() {
  const selectionScreen = document.getElementById('character-selection');
  const mainGame = document.getElementById('main-game');
  
  // Reset color selection
  selectedColor = null;
  document.querySelectorAll('.color-option').forEach(option => {
    option.style.border = '3px solid rgba(255,255,255,0.3)';
    option.style.transform = 'scale(1)';
    option.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  });
  const colorText = document.getElementById('selected-color-text');
  if (colorText) {
    colorText.textContent = 'No color selected';
    colorText.style.opacity = '0.7';
  }
  
  // Reset name input
  const nameInput = document.getElementById('player-name-input');
  if (nameInput) {
    nameInput.value = '';
  }
  updatePlayerNamePreview();
  
  if (selectionScreen) {
    selectionScreen.style.display = 'flex';
  }
  if (mainGame) {
    mainGame.style.display = 'none';
  }
}

// Hide character selection and show main game
function hideCharacterSelection() {
  const selectionScreen = document.getElementById('character-selection');
  const mainGame = document.getElementById('main-game');
  
  if (selectionScreen) {
    selectionScreen.style.display = 'none';
  }
  if (mainGame) {
    mainGame.style.display = 'block';
  }
}

// Select color
function selectColor(color) {
  if (!playerColors[color]) {
    console.error('Invalid color:', color);
    return;
  }
  
  selectedColor = color;
  
  // Update visual selection
  document.querySelectorAll('.color-option').forEach(option => {
    option.style.border = '3px solid rgba(255,255,255,0.3)';
    option.style.transform = 'scale(1)';
  });
  
  const selectedOption = document.querySelector(`[data-color="${color}"]`);
  if (selectedOption) {
    selectedOption.style.border = '4px solid #FFD700';
    selectedOption.style.transform = 'scale(1.15)';
    selectedOption.style.boxShadow = '0 0 20px rgba(255,215,0,0.8)';
  }
  
  // Update text
  const colorText = document.getElementById('selected-color-text');
  if (colorText) {
    const colorNames = {
      red: 'Red',
      darkblue: 'Dark Blue',
      cyan: 'Cyan',
      yellow: 'Yellow',
      purple: 'Purple',
      green: 'Green',
      orange: 'Orange',
      pink: 'Pink'
    };
    colorText.textContent = `Selected: ${colorNames[color]}`;
    colorText.style.opacity = '1';
  }
}

// Update player name preview
function updatePlayerNamePreview() {
  const nameInput = document.getElementById('player-name-input');
  const previewText = document.getElementById('name-preview-text');
  
  if (!nameInput || !previewText) return;
  
  const name = nameInput.value.trim();
  if (name) {
    previewText.textContent = `Your name: ${name}`;
    previewText.style.opacity = '1';
  } else {
    previewText.textContent = 'Name will appear next to your character icon';
    previewText.style.opacity = '0.7';
  }
}

// Select character
function selectCharacter(characterType) {
  if (!characterTypes[characterType]) {
    console.error('Invalid character type:', characterType);
    return;
  }
  
  // Auto-select a color if none is chosen
  if (!selectedColor) {
    // Pick a random color from available colors
    const colorKeys = Object.keys(playerColors);
    const randomIndex = Math.floor(Math.random() * colorKeys.length);
    selectedColor = colorKeys[randomIndex];
    // Update the visual selection
    selectColor(selectedColor);
  }
  
  // Get player name from input field
  const nameInput = document.getElementById('player-name-input');
  const playerName = nameInput ? nameInput.value.trim() : '';
  
  // Use entered name or default to "Player"
  gameState.playerName = playerName || 'Player';
  
  gameState.character = characterType;
  gameState.playerColor = selectedColor;
  
  // Highlight selected character card
  const cards = document.querySelectorAll('.character-card');
  cards.forEach(card => {
    if (card.dataset.character === characterType) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
  
  // Hide selection screen and show main game
  hideCharacterSelection();
  
  // Initialize game if not already initialized
  const isNewGame = !gameState.map || gameState.map.length === 0;
  if (isNewGame) {
    resetBuildingUnlocks();
    // loadExternalQuests();
    initializeQuests();
    initializeGrid();
    // Cycle to next save slot for new game
    cycleToNextSaveSlot();
  }
  
  // Apply player color to UI
  applyPlayerColor();
  
  // Update player indicator
  updatePlayerIndicator();
  
  // Update UI to reflect character bonuses
  calculateProduction();
  checkUnlocks();
  checkQuests();
  renderGrid();
  updateUI();
  updateSaveStatus();
  updateQuestIndicator();
  initializeBuildMenu();
  updateBuildMenu();
  initializeResourceTooltips();
  setupExpansionButton();
  setupZoomControls();
  
  // Start the game loop
  startGameLoop();
  
  // Save the character selection
  saveGame();
}

// Update player indicator in upper right
function updatePlayerIndicator() {
  const playerIndicator = document.getElementById('player-indicator');
  if (!playerIndicator) return;
  
  if (gameState.character && gameState.playerColor) {
    const character = characterTypes[gameState.character];
    const color = playerColors[gameState.playerColor];
    const playerName = gameState.playerName || 'Player';
    
    // Update color dot
    const colorDot = playerIndicator.querySelector('.player-color-dot');
    if (colorDot) {
      colorDot.style.background = color;
    }
    
    // Update character text with player name
    const characterText = playerIndicator.querySelector('.player-character-text');
    if (characterText) {
      characterText.textContent = `${character.icon} ${playerName}`;
    }
    
    // Show indicator
    playerIndicator.style.display = 'flex';
  } else {
    // Hide indicator if no character/color selected
    playerIndicator.style.display = 'none';
  }
}

// Apply player color to UI elements
function applyPlayerColor() {
  if (!gameState.playerColor || !playerColors[gameState.playerColor]) {
    return; // No color selected or invalid color
  }
  
  const color = playerColors[gameState.playerColor];
  const root = document.documentElement;
  
  // Apply as CSS custom property for use throughout the UI
  root.style.setProperty('--player-color', color);
  
  // Apply to specific elements that should use player color
  // Character card selection only (tile selection stays gold)
  const style = document.createElement('style');
  style.id = 'player-color-styles';
  style.textContent = `
    .character-card.selected {
      border-color: ${color} !important;
      box-shadow: 0 0 20px ${color}80 !important;
    }
  `;
  
  // Remove old style if exists
  const oldStyle = document.getElementById('player-color-styles');
  if (oldStyle) oldStyle.remove();
  
  document.head.appendChild(style);
}

// Toggle edit mode
function toggleEditMode() {
  editMode = !editMode;
  tileBeingMoved = null;
  selectedBuildingType = null;
  selectedTile = null;
  
  const editBtn = document.getElementById('edit-mode-btn');
  const editText = editBtn ? editBtn.querySelector('.edit-text') : null;
  
  if (editBtn && editText) {
    if (editMode) {
      editText.textContent = 'Exit Edit Mode';
      editBtn.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
      showMessage("Edit mode enabled. Click a building to move it, then click an empty cell to place it.");
    } else {
      editText.textContent = 'Edit Mode';
      editBtn.style.background = '';
      showMessage("Edit mode disabled.");
    }
  }
  
  updateBuildingSelection();
  renderGrid();
  updateTileInfo();
}

// Move building from one position to another
function moveBuilding(fromRow, fromCol, toRow, toCol) {
  if (fromRow < 0 || fromRow >= GRID_SIZE || fromCol < 0 || fromCol >= GRID_SIZE) return false;
  if (toRow < 0 || toRow >= GRID_SIZE || toCol < 0 || toCol >= GRID_SIZE) return false;
  
  const fromTile = gameState.map[fromRow][fromCol];
  const toTile = gameState.map[toRow][toCol];
  
  if (fromTile.type === "empty" || toTile.type !== "empty") return false;
  
  // Cannot move town centers
  if (fromTile.type && fromTile.type.startsWith('townCenter_')) {
    showMessage("Cannot move Town Center!");
    return false;
  }
  
  // Cannot move from town-locked tiles
  if (fromTile.townId) {
    showMessage("Cannot move buildings from town-locked tiles!");
    return false;
  }
  
  // Cannot move to town-locked tiles
  if (toTile.townId) {
    showMessage("Cannot move buildings to town-locked tiles!");
    return false;
  }
  
  // Save building data
  const buildingType = fromTile.type;
  const buildingLevel = fromTile.level;
  
  // Handle special data (smelter data)
  let smelterData = null;
  if (buildingType === "smelter" && gameState.smelters) {
    const oldKey = `${fromRow}_${fromCol}`;
    smelterData = gameState.smelters[oldKey];
    if (smelterData) {
      delete gameState.smelters[oldKey];
    }
  }
  
  // Move building
  toTile.type = buildingType;
  toTile.level = buildingLevel;
  fromTile.type = "empty";
  fromTile.level = 0;
  
  // Restore special data at new location
  if (smelterData && buildingType === "smelter") {
    if (!gameState.smelters) {
      gameState.smelters = {};
    }
    const newKey = `${toRow}_${toCol}`;
    gameState.smelters[newKey] = smelterData;
  }
  
  // Check for town pattern after moving a building
  // This allows completing a town pattern by dragging a cabin or other building into position
  let patternFound = false;
  
  // Check all possible cabin center positions that could form a 3x3 pattern with the moved building
  const minRow = Math.max(1, toRow - 2);
  const maxRow = Math.min(GRID_SIZE - 2, toRow + 2);
  const minCol = Math.max(1, toCol - 2);
  const maxCol = Math.min(GRID_SIZE - 2, toCol + 2);
  
  console.log(`🔍 Checking for town patterns after moving ${buildingType} to (${toRow}, ${toCol})`);
  console.log(`   Scanning cabin centers from (${minRow}, ${minCol}) to (${maxRow}, ${maxCol})`);
  
  // Check all possible cabin center positions
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const tile = gameState.map[r][c];
      
      // Check if this position is a cabin (either existing or just moved here)
      const isCabin = (r === toRow && c === toCol && buildingType === "cabin") || 
                      (tile && tile.type === "cabin");
      
      if (isCabin && tile && !tile.townId) {
        console.log(`   Checking pattern with cabin center at (${r}, ${c})...`);
        const result = checkTownPattern(r, c);
        if (result >= 0) {
          console.log(`   ✅ Town pattern detected at (${r}, ${c}) with rotation ${result * 90}°`);
          patternFound = true;
          break; // Pattern found, no need to check other positions
        } else {
          console.log(`   ❌ No pattern match at (${r}, ${c})`);
        }
      }
    }
    if (patternFound) break; // Pattern found, no need to check other positions
  }
  
  // As a final comprehensive check, scan ALL cabins on the entire map
  if (!patternFound) {
    console.log(`   Performing comprehensive scan of all cabins on map...`);
    const patternsFound = checkAllCabinsForPatterns();
    if (patternsFound > 0) {
      console.log(`   ✅ Found ${patternsFound} town pattern(s) by comprehensive scan`);
      patternFound = true;
    } else {
      console.log(`   ❌ No patterns found in comprehensive scan`);
    }
  }
  
  calculateProduction();
  updateUI();
  updateTileInfo();
  
  return true;
}

// Swap two buildings
function swapBuildings(row1, col1, row2, col2) {
  if (row1 < 0 || row1 >= GRID_SIZE || col1 < 0 || col1 >= GRID_SIZE) return false;
  if (row2 < 0 || row2 >= GRID_SIZE || col2 < 0 || col2 >= GRID_SIZE) return false;
  
  const tile1 = gameState.map[row1][col1];
  const tile2 = gameState.map[row2][col2];
  
  if (tile1.type === "empty" || tile2.type === "empty") return false;
  
  // Save building data from both locations
  const buildingType1 = tile1.type;
  const buildingLevel1 = tile1.level;
  const buildingType2 = tile2.type;
  const buildingLevel2 = tile2.level;
  
  // Handle special data (smelter data) for both buildings
  let smelterData1 = null;
  let smelterData2 = null;
  
  if (buildingType1 === "smelter" && gameState.smelters) {
    const key1 = `${row1}_${col1}`;
    smelterData1 = gameState.smelters[key1];
    if (smelterData1) {
      delete gameState.smelters[key1];
    }
  }
  
  if (buildingType2 === "smelter" && gameState.smelters) {
    const key2 = `${row2}_${col2}`;
    smelterData2 = gameState.smelters[key2];
    if (smelterData2) {
      delete gameState.smelters[key2];
    }
  }
  
  // Swap buildings
  tile1.type = buildingType2;
  tile1.level = buildingLevel2;
  tile2.type = buildingType1;
  tile2.level = buildingLevel1;
  
  // Restore special data at new locations
  if (smelterData1 && buildingType1 === "smelter") {
    if (!gameState.smelters) {
      gameState.smelters = {};
    }
    const newKey1 = `${row2}_${col2}`;
    gameState.smelters[newKey1] = smelterData1;
  }
  
  if (smelterData2 && buildingType2 === "smelter") {
    if (!gameState.smelters) {
      gameState.smelters = {};
    }
    const newKey2 = `${row1}_${col1}`;
    gameState.smelters[newKey2] = smelterData2;
  }
  
  calculateProduction();
  updateUI();
  updateTileInfo();
  
  return true;
}

// Toggle shop window
function toggleShop() {
  toggleModal('shop-modal', updateShopUI);
}

// Initialize quests in gameState
function initializeQuests() {
  // Ensure quests is always an array
  if (!gameState.quests || !Array.isArray(gameState.quests)) {
    gameState.quests = [];
  }
  
  if (gameState.quests.length === 0) {
    // Initialize all quests
    gameState.quests = questDefinitions.map(quest => ({
      id: quest.id,
      completed: false,
      claimed: false
    }));
  } else {
    // Ensure all quests are in the array (for new quests added later)
    // Double-check it's still an array before using find
    if (!Array.isArray(gameState.quests)) {
      gameState.quests = [];
      gameState.quests = questDefinitions.map(quest => ({
        id: quest.id,
        completed: false,
        claimed: false
      }));
      return;
    }
    
    questDefinitions.forEach(questDef => {
      const existingQuest = gameState.quests.find(q => q.id === questDef.id);
      if (!existingQuest) {
        gameState.quests.push({
          id: questDef.id,
          completed: false,
          claimed: false
        });
      }
    });
  }
}

// Check quest progress
function checkQuests() {
  try {
    // Ensure quests is an array
    if (!gameState.quests || !Array.isArray(gameState.quests) || gameState.quests.length === 0) {
      initializeQuests();
    }
    
    if (!gameState.map || gameState.map.length === 0) {
      return; // Can't check quests if map isn't initialized
    }
    
    if (!questDefinitions || questDefinitions.length === 0) {
      return; // Quest definitions not loaded
    }
    
    // Double-check quests is an array before using find
    if (!Array.isArray(gameState.quests)) {
      gameState.quests = [];
      initializeQuests();
    }
    
    questDefinitions.forEach(questDef => {
      const quest = gameState.quests.find(q => q.id === questDef.id);
      if (quest && !quest.completed) {
        try {
          if (questDef.checkCondition && questDef.checkCondition()) {
            quest.completed = true;
            
            // Unlock building if this quest unlocks one
            if (questDef.unlocksBuilding && buildingTypes[questDef.unlocksBuilding]) {
              buildingTypes[questDef.unlocksBuilding].unlocked = true;
              updateBuildMenu();
              // Don't show popup for building unlock quests - just unlock silently
            } else {
              // Show completion popup only for quests that don't unlock buildings
              showQuestCompletionPopup(questDef);
            }
            
            updateQuestIndicator();
            // Update UI if quests modal is open
            const questsModal = document.getElementById('quests-modal');
            if (questsModal && questsModal.style.display === 'flex') {
              renderQuests();
            }
          }
        } catch (e) {
          console.error(`Error checking quest ${questDef.id}:`, e);
        }
      }
    });
  } catch (e) {
    console.error('Error in checkQuests:', e);
  }
}

// Claim quest reward
function claimQuestReward(questId) {
  // Ensure quests is an array
  if (!gameState.quests || !Array.isArray(gameState.quests)) {
    initializeQuests();
  }
  
  const quest = gameState.quests.find(q => q.id === questId);
  const questDef = questDefinitions.find(q => q.id === questId);
  
  if (!quest || !questDef) return;
  if (!quest.completed || quest.claimed) return;
  
  // Apply rewards
  Object.keys(questDef.reward).forEach(resource => {
    gameState.resources[resource] = (gameState.resources[resource] || 0) + questDef.reward[resource];
  });
  
  quest.claimed = true;
  updateUI();
  updateQuestIndicator();
  renderQuests();
  showMessage(`Quest reward claimed!`);
}

// Update quest indicator on button
function updateQuestIndicator() {
  const questsBtn = document.getElementById('quests-btn');
  if (!questsBtn) return;
  
  // Ensure quests is an array
  if (!gameState.quests || !Array.isArray(gameState.quests) || gameState.quests.length === 0) {
    const indicator = questsBtn.querySelector('.quest-indicator');
    if (indicator) indicator.remove();
    return;
  }
  
  const hasUnclaimedQuests = gameState.quests.some(q => q.completed && !q.claimed);
  
  if (hasUnclaimedQuests) {
    // Add red dot indicator
    let indicator = questsBtn.querySelector('.quest-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'quest-indicator';
      questsBtn.appendChild(indicator);
    }
  } else {
    // Remove indicator
    const indicator = questsBtn.querySelector('.quest-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
}

// Current quest tab (incomplete or completed)
let currentQuestTab = 'incomplete';

// Switch quest tab
function switchQuestTab(tab) {
  currentQuestTab = tab;
  
  // Update tab buttons
  const tabs = document.querySelectorAll('.quest-tab');
  tabs.forEach(t => {
    if (t.dataset.tab === tab) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
  
  // Re-render quests with the new filter
  renderQuests();
}

// Render quests in the modal
function renderQuests() {
  try {
    const questsBody = document.querySelector('.quests-body');
    if (!questsBody) {
      console.error('Quest body not found');
      return;
    }
    
    // Ensure quests is an array
    if (!gameState.quests || !Array.isArray(gameState.quests) || gameState.quests.length === 0) {
      initializeQuests();
    }
    
    if (!questDefinitions || questDefinitions.length === 0) {
      questsBody.innerHTML = '<p>No quests available.</p>';
      return;
    }
    
    // Double-check quests is an array before using find
    if (!Array.isArray(gameState.quests)) {
      gameState.quests = [];
      initializeQuests();
    }
    
    let html = '';
    let hasQuests = false;
    
    questDefinitions.forEach(questDef => {
      // Skip milestone quests that unlock buildings - they're handled automatically
      if (questDef.unlocksBuilding) {
        return;
      }
      
      const quest = gameState.quests.find(q => q.id === questDef.id);
      if (!quest) return;
      
      const isCompleted = quest.completed;
      const isClaimed = quest.claimed;
      
      // Filter based on current tab
      if (currentQuestTab === 'incomplete' && isCompleted) {
        return; // Skip completed quests in incomplete tab
      }
      if (currentQuestTab === 'completed' && !isCompleted) {
        return; // Skip incomplete quests in completed tab
      }
      
      hasQuests = true;
      
      html += `<div class="quest-item ${isCompleted ? 'quest-completed' : ''} ${isClaimed ? 'quest-claimed' : ''}">`;
      html += `<div class="quest-info">`;
      html += `<h3>${questDef.title}</h3>`;
      html += `<p>${questDef.description}</p>`;
      
      // Show rewards
      html += `<div class="quest-reward">`;
      html += `<strong>Reward: </strong>`;
      const rewardParts = [];
      
      // Show building unlock if this quest unlocks a building
      if (questDef.unlocksBuilding && buildingTypes[questDef.unlocksBuilding]) {
        const unlockedBuilding = buildingTypes[questDef.unlocksBuilding];
        const buildingIcon = buildingIcons[questDef.unlocksBuilding] || '';
        rewardParts.push(`Unlocks ${unlockedBuilding.displayName}${buildingIcon ? ` <img src="${buildingIcon}" alt="${unlockedBuilding.displayName}" style="width: 24px; height: 24px; vertical-align: middle;">` : ''}`);
      }
      
      // Show resource rewards
      Object.keys(questDef.reward).forEach(resource => {
        const amount = questDef.reward[resource];
        const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
        rewardParts.push(`${amount} ${resourceName}`);
      });
      
      html += rewardParts.join(', ');
      html += `</div>`;
      html += `</div>`;
      
      // Status and claim button
      if (isClaimed) {
        html += `<div class="quest-status">Claimed ✓</div>`;
      } else if (isCompleted) {
        html += `<button class="quest-claim-btn" onclick="claimQuestReward('${questDef.id}')">Claim Reward</button>`;
      } else {
        html += `<div class="quest-status">In Progress...</div>`;
      }
      
      html += `</div>`;
    });
    
    if (!hasQuests) {
      if (currentQuestTab === 'incomplete') {
        html = '<p style="text-align: center; color: #ccc; padding: 20px;">All quests completed! 🎉</p>';
      } else {
        html = '<p style="text-align: center; color: #ccc; padding: 20px;">No completed quests yet.</p>';
      }
    }
    
    questsBody.innerHTML = html;
  } catch (e) {
    console.error('Error rendering quests:', e);
    const questsBody = document.querySelector('.quests-body');
    if (questsBody) {
      questsBody.innerHTML = '<p>Error loading quests.</p>';
    }
  }
}

// Toggle settings modal
function toggleSettings() {
  toggleModal('settings-modal');
}

// Toggle book of buildings modal
function toggleBookOfBuildings() {
  toggleModal('book-of-buildings-modal', () => {
    renderBuildingCombos();
  });
}

// Render building combos in the book modal
function renderBuildingCombos() {
  const container = document.getElementById('building-combos-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Iterate through all building combos
  for (const comboKey in buildingCombos) {
    const combo = buildingCombos[comboKey];
    
    const comboCard = document.createElement('div');
    comboCard.style.cssText = 'background: rgba(0,0,0,0.3); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,215,0,0.3);';
    
    // Title
    const title = document.createElement('h3');
    title.textContent = combo.name;
    title.style.cssText = 'color: #FFD700; margin-bottom: 10px; font-size: 20px;';
    comboCard.appendChild(title);
    
    // Description
    const description = document.createElement('p');
    description.textContent = combo.description;
    description.style.cssText = 'color: #ddd; margin-bottom: 15px; line-height: 1.5;';
    comboCard.appendChild(description);
    
    // Pattern section
    const patternSection = document.createElement('div');
    patternSection.style.cssText = 'margin-bottom: 15px;';
    
    const patternTitle = document.createElement('h4');
    patternTitle.textContent = `Pattern (${combo.pattern.size}):`;
    patternTitle.style.cssText = 'color: #FFD700; margin-bottom: 10px; font-size: 16px;';
    patternSection.appendChild(patternTitle);
    
    // Center building
    const centerInfo = document.createElement('p');
    centerInfo.innerHTML = `<strong style="color: #fff;">Center:</strong> <span style="color: #ddd;">${combo.pattern.center}</span>`;
    centerInfo.style.cssText = 'margin-bottom: 10px; padding-left: 10px;';
    patternSection.appendChild(centerInfo);
    
    // Pattern grid visualization (simple list)
    const patternList = document.createElement('ul');
    patternList.style.cssText = 'list-style: none; padding: 0; margin: 10px 0; color: #ddd;';
    
    combo.pattern.buildings.forEach(building => {
      const listItem = document.createElement('li');
      listItem.style.cssText = 'padding: 5px 10px; border-left: 2px solid rgba(255,215,0,0.5); margin-bottom: 5px;';
      listItem.innerHTML = `<strong style="color: #fff;">${building.position}:</strong> ${building.building}`;
      patternList.appendChild(listItem);
    });
    
    patternSection.appendChild(patternList);
    comboCard.appendChild(patternSection);
    
    // Note
    if (combo.pattern.note) {
      const note = document.createElement('p');
      note.textContent = combo.pattern.note;
      note.style.cssText = 'color: #aaa; font-style: italic; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px;';
      comboCard.appendChild(note);
    }
    
    // Reward section
    const rewardSection = document.createElement('div');
    rewardSection.style.cssText = 'background: rgba(0,255,0,0.1); padding: 10px; border-radius: 5px; border: 1px solid rgba(0,255,0,0.3);';
    
    const rewardTitle = document.createElement('strong');
    rewardTitle.textContent = 'Reward: ';
    rewardTitle.style.cssText = 'color: #4CAF50;';
    rewardSection.appendChild(rewardTitle);
    
    const rewardText = document.createTextNode(combo.reward);
    rewardSection.appendChild(rewardText);
    
    comboCard.appendChild(rewardSection);
    container.appendChild(comboCard);
  }
  
  // If no combos exist, show a message
  if (Object.keys(buildingCombos).length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No building combos available yet.';
    emptyMessage.style.cssText = 'color: #aaa; text-align: center; padding: 20px;';
    container.appendChild(emptyMessage);
  }
}

// Toggle quests window
function toggleQuests() {
  toggleModal('quests-modal', () => {
    currentQuestTab = 'incomplete';
    document.querySelectorAll('.quest-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'incomplete');
    });
    renderQuests();
  });
}

// Open Town Center modal
let currentTownId = null;
let currentTownRow = null;
let currentTownCol = null;

function openTownCenterModal(townId, row, col) {
  currentTownId = townId;
  currentTownRow = row;
  currentTownCol = col;
  
  const town = gameState.towns[townId];
  if (!town) return;
  
  // Update modal title
  const titleEl = document.getElementById('town-center-title');
  if (titleEl) {
    titleEl.textContent = `Town Center (Level ${town.level})`;
  }
  
  // Update quest section with enhanced UI
  const questSectionEl = document.getElementById('town-quest-content');
  
  if (town.level >= 10) {
    if (questSectionEl) {
      questSectionEl.innerHTML = `
        <div class="quest-completed-badge" style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">🏆</div>
          <p style="color: #4CAF50; font-size: 18px; font-weight: bold;">Maximum Level Reached!</p>
          <p style="color: #aaa; margin-top: 5px;">Your town has reached its full potential.</p>
        </div>
        <div style="display: flex; gap: 10px; align-items: stretch; margin-top: 15px;">
          <div class="quest-status-badge" style="flex: 1; padding: 12px; border-radius: 8px; text-align: center; background: rgba(76, 175, 80, 0.2); border: 2px solid #4CAF50;">
            <div style="color: #4CAF50; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span style="font-size: 20px;">✅</span>
              <span>Maximum Level</span>
            </div>
          </div>
          <button class="shop-buy-btn" disabled style="flex: 1; padding: 12px; font-size: 14px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;">Maximum Level</button>
        </div>
      `;
    }
  } else {
    const questDef = townQuestDefinitions.find(q => q.level === town.level);
    if (questDef && questSectionEl) {
      const isCompleted = town.questsCompleted.includes(questDef.id);
      const canComplete = questDef.checkCondition();
      const progress = getQuestProgress(questDef);
      
      let html = '';
      
      // Quest title and description
      html += `<div class="quest-header" style="margin-bottom: 15px;">`;
      html += `<h4 style="color: #FFD700; margin-bottom: 5px; font-size: 16px;">Level ${town.level} Quest</h4>`;
      html += `<p style="color: #fff; font-size: 14px; margin: 0;">${questDef.description}</p>`;
      html += `</div>`;
      
      // Progress display
      if (progress && progress.type !== 'simple') {
        html += `<div class="quest-progress-container" style="margin-bottom: 15px;">`;
        
        // Progress bar
        html += `<div class="quest-progress-bar-container" style="background: rgba(0,0,0,0.3); border-radius: 10px; height: 30px; margin-bottom: 10px; overflow: hidden; position: relative;">`;
        html += `<div class="quest-progress-bar-fill" style="background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 100%); height: 100%; width: ${progress.percentage}%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px;">`;
        if (progress.percentage > 50) {
          html += `<span style="color: white; font-weight: bold; font-size: 12px;">${progress.percentage}%</span>`;
        }
        html += `</div>`;
        if (progress.percentage <= 50) {
          html += `<span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: white; font-weight: bold; font-size: 12px;">${progress.percentage}%</span>`;
        }
        html += `</div>`;
        
        // Progress details
        html += `<div class="quest-progress-details" style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">`;
        html += `<div style="display: flex; align-items: center; gap: 8px;">`;
        html += `<span style="font-size: 20px;">${progress.icon || '📋'}</span>`;
        html += `<span style="color: #fff; font-weight: bold;">${progress.current}</span>`;
        html += `<span style="color: #aaa;">/ ${progress.target} ${progress.details.unit || ''}</span>`;
        html += `</div>`;
        
        if (progress.buildingCapReward) {
          html += `<div style="color: #4CAF50; font-size: 12px;">+${questDef.buildingCapReward} Building Cap</div>`;
        }
        html += `</div>`;
        
        html += `</div>`;
      } else {
        // Simple quest without progress tracking
        html += `<div style="margin-bottom: 15px;">`;
        html += `<p style="color: #aaa; font-size: 13px;">Complete this quest to upgrade your town.</p>`;
        if (questDef.buildingCapReward) {
          html += `<div style="color: #4CAF50; font-size: 12px; margin-top: 5px;">Reward: +${questDef.buildingCapReward} Building Cap</div>`;
        }
        html += `</div>`;
      }
      
      // Status badge and upgrade button container
      html += `<div style="display: flex; gap: 10px; align-items: stretch;">`;
      
      // Status badge
      html += `<div class="quest-status-badge" style="flex: 1; padding: 12px; border-radius: 8px; text-align: center; `;
      if (isCompleted || canComplete) {
        html += `background: rgba(76, 175, 80, 0.2); border: 2px solid #4CAF50;`;
      } else {
        html += `background: rgba(255, 193, 7, 0.2); border: 2px solid #FFC107;`;
      }
      html += `">`;
      
      if (isCompleted || canComplete) {
        html += `<div style="color: #4CAF50; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">`;
        html += `<span style="font-size: 20px;">✅</span>`;
        html += `<span>Ready to Upgrade!</span>`;
        html += `</div>`;
      } else {
        html += `<div style="color: #FFC107; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">`;
        html += `<span style="font-size: 20px;">⏳</span>`;
        html += `<span>Quest in Progress</span>`;
        html += `</div>`;
      }
      
      html += `</div>`;
      
      // Upgrade button next to status badge
      const canUpgrade = isCompleted || canComplete;
      html += `<button class="shop-buy-btn" onclick="upgradeTownFromModal()" `;
      if (!canUpgrade) {
        html += `disabled `;
      }
      html += `style="flex: 1; padding: 12px; font-size: 14px; white-space: nowrap;`;
      if (canUpgrade) {
        html += `background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);`;
      }
      html += `">`;
      if (canUpgrade) {
        html += `⬆️ Upgrade Town`;
      } else {
        html += `Complete Quest First`;
      }
      html += `</button>`;
      
      html += `</div>`;
      
      questSectionEl.innerHTML = html;
    }
  }
  
  // Update merchants section
  const merchantsEl = document.getElementById('town-merchants-content');
  if (merchantsEl) {
    const availableMerchants = getAvailableMerchants(townId);
    if (availableMerchants.length === 0) {
      merchantsEl.innerHTML = '<p style="color: #aaa;">No merchants available yet. Complete quests to unlock merchants.</p>';
    } else {
      // Preserve slider values before regenerating HTML
      const preservedSliderValues = {};
      ['wood', 'stone', 'clay'].forEach(resource => {
        const sliderId = `merchant-${resource}-slider`;
        const existingSlider = document.getElementById(sliderId);
        if (existingSlider) {
          preservedSliderValues[resource] = parseInt(existingSlider.value) || 0;
        }
      });
      
      let html = '';
      availableMerchants.forEach(merchant => {
        html += `<div style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">`;
        html += `<h4 style="color: #FFD700; margin-bottom: 10px;">${merchant.name}</h4>`;
        merchant.trades.forEach(trade => {
          // Check if this is a slider-based resource trade (wood, stone, clay)
          if (trade.type === 'resource_trade' && trade.resource && ['wood', 'stone', 'clay'].includes(trade.resource)) {
            const resource = trade.resource;
            const exchangeRate = trade.exchangeRate || 10;
            const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
            const resourceImage = resource === 'wood' ? 'wood-log.png' : resource === 'stone' ? 'rock.png' : 'clay.png';
            
            // Use preserved value if available, otherwise 0
            const initialValue = preservedSliderValues[resource] || 0;
            
            html += `<div style="margin-bottom: 15px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 5px;">`;
            html += `<strong style="color: #FFD700;">Sell ${resourceName}</strong><br>`;
            html += `<span style="display: inline-flex; align-items: center; gap: 5px; margin: 5px 0; font-size: 12px; color: #aaa;">`;
            html += `<span style="display: inline-flex; align-items: center; gap: 3px;"><span style="font-weight: bold;">${exchangeRate}</span> <img src="images/${resourceImage}" alt="${resourceName}" style="width: 16px; height: 16px; vertical-align: middle;"></span>`;
            html += `<span>:</span>`;
            html += `<span style="display: inline-flex; align-items: center; gap: 3px;"><span style="font-weight: bold;">1</span> <img src="images/gold.png" alt="Gold" style="width: 16px; height: 16px; vertical-align: middle;"></span>`;
            html += `</span>`;
            
            html += `<div style="margin: 10px 0;">`;
            html += `<label for="merchant-${resource}-slider" style="display: block; margin-bottom: 8px; color: #fff; font-size: 13px;">`;
            html += `Amount: <span id="merchant-${resource}-amount">0</span> ${resource}`;
            html += `</label>`;
            html += `<div class="brick-slider-wrapper">`;
            html += `<div class="brick-slider-fill" id="merchant-${resource}-slider-fill"></div>`;
            html += `<input type="range" id="merchant-${resource}-slider" min="0" max="100" step="${exchangeRate}" value="${initialValue}" `;
            html += `oninput="updateMerchantResourceTrade('${resource}', ${exchangeRate}, this.value)">`;
            html += `</div>`;
            html += `</div>`;
            
            html += `<div class="shop-item-cost" style="margin: 10px 0;">`;
            html += `<span class="shop-cost-item">`;
            html += `<img src="images/${resourceImage}" alt="${resourceName}" style="width: 24px; height: 24px; vertical-align: middle;">`;
            html += `<span id="merchant-${resource}-cost-display">0</span>`;
            html += `</span>`;
            html += `<span style="margin: 0 10px;">→</span>`;
            html += `<span class="shop-cost-item">`;
            html += `<img src="images/gold.png" alt="Gold" style="width: 24px; height: 24px; vertical-align: middle;">`;
            html += `<span id="merchant-${resource}-gold-reward-display">0</span>`;
            html += `</span>`;
            html += `</div>`;
            
            html += `<div id="merchant-${resource}-cooldown-status" style="margin-top: 5px;"></div>`;
            html += `<button id="merchant-sell-${resource}-btn" class="shop-buy-btn" style="width: 100%; margin-top: 5px;" onclick="executeMerchantResourceTrade('${townId}', '${resource}', ${exchangeRate})">Sell</button>`;
            html += `</div>`;
          } else {
            // Regular trade button for non-slider trades
            html += `<div style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 3px;">`;
            html += `<strong>${trade.name}</strong><br>`;
            html += `<span style="font-size: 12px; color: #aaa;">${trade.description}</span>`;
            html += `<button class="shop-buy-btn" style="margin-top: 5px; width: 100%;" onclick="executeMerchantTrade('${townId}', '${trade.id}')">Trade</button>`;
            html += `</div>`;
          }
        });
        html += `</div>`;
      });
      merchantsEl.innerHTML = html;
      
      // Initialize merchant sliders after HTML is inserted, using preserved values
      requestAnimationFrame(() => {
        availableMerchants.forEach(merchant => {
          merchant.trades.forEach(trade => {
            if (trade.type === 'resource_trade' && trade.resource && ['wood', 'stone', 'clay'].includes(trade.resource)) {
              const preservedValue = preservedSliderValues[trade.resource];
              updateMerchantResourceTrade(trade.resource, trade.exchangeRate || 10, preservedValue);
            }
          });
        });
      });
    }
  }
  
  // Upgrade button is now part of the quest section HTML, no need to update separately
  
  // Show modal (don't toggle if already open)
  const modal = document.getElementById('town-center-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
  
  // Start cooldown update timer if not already running
  if (merchantCooldownUpdateInterval) {
    clearInterval(merchantCooldownUpdateInterval);
  }
  merchantCooldownUpdateInterval = setInterval(() => {
    // Update all merchant sliders to refresh cooldown displays
    if (currentTownId !== null) {
      const availableMerchants = getAvailableMerchants(currentTownId);
      availableMerchants.forEach(merchant => {
        merchant.trades.forEach(trade => {
          if (trade.type === 'resource_trade' && trade.resource && ['wood', 'stone', 'clay'].includes(trade.resource)) {
            const slider = document.getElementById(`merchant-${trade.resource}-slider`);
            if (slider) {
              updateMerchantResourceTrade(trade.resource, trade.exchangeRate || 10, slider.value);
            }
          }
        });
      });
    }
  }, 1000); // Update every second
}

function closeTownCenterModal() {
  toggleModal('town-center-modal');
  currentTownId = null;
  currentTownRow = null;
  currentTownCol = null;
  
  // Clear cooldown update timer
  if (merchantCooldownUpdateInterval) {
    clearInterval(merchantCooldownUpdateInterval);
    merchantCooldownUpdateInterval = null;
  }
}

// Refresh town center modal if it's currently open (for real-time updates)
function refreshTownCenterModalIfOpen() {
  if (currentTownId !== null && currentTownRow !== null && currentTownCol !== null) {
    const modal = document.getElementById('town-center-modal');
    if (modal && modal.style.display === 'flex') {
      openTownCenterModal(currentTownId, currentTownRow, currentTownCol);
    }
  }
}

// Current wandering trader event key
let currentTraderEventKey = null;
let traderUpdateInterval = null;

// Open wandering trader modal
function openWanderingTraderModal(eventKey) {
  const event = gameState.randomEvents[eventKey];
  if (!event || event.type !== 'wanderingTrader') {
    return;
  }
  
  currentTraderEventKey = eventKey;
  const contentEl = document.getElementById('wandering-trader-content');
  const timeRemainingEl = document.getElementById('trader-time-remaining');
  
  if (!contentEl || !timeRemainingEl) {
    return;
  }
  
  // Update time remaining
  const updateTimeRemaining = () => {
    const now = Date.now();
    const remaining = Math.max(0, event.expiresAt - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timeRemainingEl.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (remaining <= 0) {
      closeWanderingTraderModal();
      checkEventExpirations();
      renderGrid();
    }
  };
  
  updateTimeRemaining();
  
  // Clear existing interval
  if (traderUpdateInterval) {
    clearInterval(traderUpdateInterval);
  }
  
  // Update every second
  traderUpdateInterval = setInterval(updateTimeRemaining, 1000);
  
  // Build HTML content
  let html = '';
  
  // Rare Resources section
  html += '<h3 style="color: #FFD700; margin-top: 0; margin-bottom: 15px;">Rare Resources</h3>';
  const rareResources = ['buyIron', 'buyCoal', 'buyIronBars'];
  rareResources.forEach(tradeId => {
    const trade = wanderingTraderTrades[tradeId];
    if (!trade) return;
    
    html += '<div class="shop-item" style="margin-bottom: 15px;">';
    html += '<div class="shop-item-info">';
    html += `<h3>${trade.name}</h3>`;
    html += `<p style="color: #aaa; font-size: 13px;">${trade.description}</p>`;
    html += '<div class="shop-item-cost">';
    html += '<span class="shop-cost-item">';
    html += `<img src="images/gold.png" alt="Gold" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>${trade.cost.gold}</span>`;
    html += '</span>';
    html += '<span style="margin: 0 10px;">→</span>';
    html += '<span class="shop-cost-item">';
    const resourceName = Object.keys(trade.reward)[0];
    const resourceImage = resourceName === 'iron' ? 'iron.png' : resourceName === 'coal' ? 'coal.png' : 'ironBar.webp';
    html += `<img src="images/${resourceImage}" alt="${resourceName}" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>${trade.reward[resourceName]}</span>`;
    html += '</span>';
    html += '</div>';
    html += '</div>';
    html += `<button class="shop-buy-btn" onclick="executeTraderTrade('${tradeId}', '${eventKey}')">Purchase</button>`;
    html += '</div>';
  });
  
  // Temporary Boosts section
  html += '<h3 style="color: #FFD700; margin-top: 20px; margin-bottom: 15px;">Temporary Boosts (5 minutes)</h3>';
  const boosts = ['boostWood', 'boostStone', 'boostClay', 'boostIron'];
  boosts.forEach(tradeId => {
    const trade = wanderingTraderTrades[tradeId];
    if (!trade) return;
    
    html += '<div class="shop-item" style="margin-bottom: 15px;">';
    html += '<div class="shop-item-info">';
    html += `<h3>${trade.name}</h3>`;
    html += `<p style="color: #aaa; font-size: 13px;">${trade.description}</p>`;
    html += '<div class="shop-item-cost">';
    html += '<span class="shop-cost-item">';
    html += `<img src="images/gold.png" alt="Gold" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>${trade.cost.gold}</span>`;
    html += '</span>';
    html += '</div>';
    html += '</div>';
    html += `<button class="shop-buy-btn" onclick="executeTraderTrade('${tradeId}', '${eventKey}')">Purchase</button>`;
    html += '</div>';
  });
  
  // Permanent Upgrades section
  html += '<h3 style="color: #FFD700; margin-top: 20px; margin-bottom: 15px;">Permanent Upgrades</h3>';
  const upgrades = ['permanentWoodBoost', 'permanentStoneBoost'];
  upgrades.forEach(tradeId => {
    const trade = wanderingTraderTrades[tradeId];
    if (!trade) return;
    
    html += '<div class="shop-item" style="margin-bottom: 15px;">';
    html += '<div class="shop-item-info">';
    html += `<h3>${trade.name}</h3>`;
    html += `<p style="color: #aaa; font-size: 13px;">${trade.description}</p>`;
    html += '<div class="shop-item-cost">';
    html += '<span class="shop-cost-item">';
    html += `<img src="images/gold.png" alt="Gold" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>${trade.cost.gold}</span>`;
    html += '</span>';
    html += '</div>';
    html += '</div>';
    html += `<button class="shop-buy-btn" onclick="executeTraderTrade('${tradeId}', '${eventKey}')">Purchase</button>`;
    html += '</div>';
  });
  
  // Bargain Trades section
  html += '<h3 style="color: #FFD700; margin-top: 20px; margin-bottom: 15px;">Bargain Trades</h3>';
  const bargains = ['bargainWood', 'bargainStone', 'bargainClay'];
  bargains.forEach(tradeId => {
    const trade = wanderingTraderTrades[tradeId];
    if (!trade) return;
    
    html += '<div class="shop-item" style="margin-bottom: 15px;">';
    html += '<div class="shop-item-info">';
    html += `<h3>${trade.name}</h3>`;
    html += `<p style="color: #aaa; font-size: 13px;">${trade.description}</p>`;
    html += '<div class="shop-item-cost">';
    html += '<span class="shop-cost-item">';
    const resourceName = trade.resource;
    const resourceImage = resourceName === 'wood' ? 'wood-log.png' : resourceName === 'stone' ? 'rock.png' : 'clay.png';
    html += `<img src="images/${resourceImage}" alt="${resourceName}" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>${trade.cost[resourceName]}</span>`;
    html += '</span>';
    html += '<span style="margin: 0 10px;">→</span>';
    html += '<span class="shop-cost-item">';
    html += `<img src="images/gold.png" alt="Gold" style="width: 24px; height: 24px; vertical-align: middle;">`;
    html += `<span>${trade.reward.gold}</span>`;
    html += '</span>';
    html += '</div>';
    html += '</div>';
    html += `<button class="shop-buy-btn" onclick="executeTraderTrade('${tradeId}', '${eventKey}')">Trade</button>`;
    html += '</div>';
  });
  
  contentEl.innerHTML = html;
  
  // Show modal
  const modal = document.getElementById('wandering-trader-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// Close wandering trader modal
function closeWanderingTraderModal() {
  toggleModal('wandering-trader-modal');
  currentTraderEventKey = null;
  
  if (traderUpdateInterval) {
    clearInterval(traderUpdateInterval);
    traderUpdateInterval = null;
  }
}

// Execute trader trade
function executeTraderTrade(tradeId, eventKey) {
  const trade = wanderingTraderTrades[tradeId];
  if (!trade) {
    showMessage("Trade not found!");
    return;
  }
  
  const event = gameState.randomEvents[eventKey];
  if (!event || event.type !== 'wanderingTrader') {
    showMessage("Trader event not found!");
    return;
  }
  
  // Check if player can afford
  if (!canAfford(trade.cost)) {
    showMessage("Cannot afford this trade!");
    return;
  }
  
  // Deduct cost
  deductCost(trade.cost);
  
  // Handle different trade types
  if (trade.type === 'resource_purchase') {
    // Add resources
    for (const [resource, amount] of Object.entries(trade.reward)) {
      if (gameState.resources[resource] !== undefined) {
        gameState.resources[resource] += amount;
      }
    }
    showMessage(`Purchased ${Object.entries(trade.reward).map(([r, a]) => `${a} ${r}`).join(', ')}!`);
  } else if (trade.type === 'temporary_boost') {
    // Apply temporary boost
    const now = Date.now();
    const boostType = trade.reward.boost;
    gameState.temporaryBoosts[boostType] = {
      multiplier: trade.reward.multiplier,
      expiresAt: now + trade.reward.duration
    };
    showMessage(`Boost activated: ${trade.name}!`);
  } else if (trade.type === 'permanent_upgrade') {
    // Apply permanent upgrade
    if (trade.reward.permanentUpgrade) {
      const upgradeType = trade.reward.permanentUpgrade;
      if (upgradeType === 'woodProduction' || upgradeType === 'stoneProduction') {
        // Store trader-specific permanent upgrades separately
        if (!gameState.traderUpgrades) {
          gameState.traderUpgrades = {};
        }
        gameState.traderUpgrades[upgradeType] = true;
        showMessage(`Permanent upgrade applied: ${trade.name}!`);
      }
    }
  } else if (trade.type === 'bargain_trade') {
    // Bargain trade - sell resources for gold
    const resourceName = trade.resource;
    const resourceAmount = trade.cost[resourceName];
    
    if (gameState.resources[resourceName] < resourceAmount) {
      showMessage(`Not enough ${resourceName}!`);
      return;
    }
    
    gameState.resources[resourceName] -= resourceAmount;
    gameState.resources.gold += trade.reward.gold;
    showMessage(`Sold ${resourceAmount} ${resourceName} for ${trade.reward.gold} gold!`);
  }
  
  updateUI();
  
  // Refresh modal if still open
  if (currentTraderEventKey === eventKey) {
    openWanderingTraderModal(eventKey);
  }
}

function upgradeTownFromModal() {
  if (currentTownId) {
    if (levelUpTown(currentTownId)) {
      // Refresh modal
      openTownCenterModal(currentTownId, currentTownRow, currentTownCol);
    }
  }
}

function executeMerchantTrade(townId, tradeId) {
  const town = gameState.towns[townId];
  if (!town) return;
  
  // Find the merchant and trade
  let trade = null;
  let merchant = null;
  
  for (const merchantId of town.merchantUnlocks) {
    const m = merchantDefinitions[merchantId];
    if (m) {
      const t = m.trades.find(tr => tr.id === tradeId);
      if (t) {
        trade = t;
        merchant = m;
        break;
      }
    }
  }
  
  if (!trade) {
    showMessage("Trade not found!");
    return;
  }
  
  // Check if player can afford
  if (!canAfford(trade.cost)) {
    showMessage("Cannot afford this trade!");
    return;
  }
  
  // Execute trade
  deductCost(trade.cost);
  
  // Apply reward
  if (trade.type === 'resource_trade') {
    for (const [resource, amount] of Object.entries(trade.reward)) {
      if (!gameState.resources.hasOwnProperty(resource)) {
        gameState.resources[resource] = 0;
      }
      gameState.resources[resource] += amount;
    }
    showMessage(`Trade completed! Received ${Object.entries(trade.reward).map(([r, a]) => `${a} ${r}`).join(', ')}.`);
  } else if (trade.type === 'boost') {
    // TODO: Implement boost system if needed
    showMessage(`Boost activated: ${trade.name}`);
  } else if (trade.type === 'upgrade') {
    // TODO: Implement discount system if needed
    showMessage(`Upgrade applied: ${trade.name}`);
  } else if (trade.type === 'permanent_upgrade') {
    if (trade.reward.permanentUpgrade) {
      // Apply permanent upgrade
      showMessage(`Permanent upgrade applied: ${trade.name}`);
    } else if (trade.reward.extraBuildingCap) {
      gameState.globalBuildingCap += trade.reward.extraBuildingCap;
      showMessage(`Building capacity increased by ${trade.reward.extraBuildingCap}!`);
    }
  }
  
  updateUI();
  
  // Refresh modal
  if (currentTownId === townId) {
    openTownCenterModal(townId, currentTownRow, currentTownCol);
  }
}

// Show quest completion popup
function showQuestCompletionPopup(questDef) {
  const popup = document.getElementById('quest-completion-popup');
  const titleEl = document.getElementById('quest-completion-title');
  const descEl = document.getElementById('quest-completion-description');
  const rewardEl = document.getElementById('quest-completion-reward-text');
  
  if (!popup || !titleEl || !descEl || !rewardEl) return;
  
  // Set quest information
  titleEl.textContent = questDef.title;
  descEl.textContent = questDef.description;
  
  // Format rewards
  const rewardParts = [];
  
  // Show building unlock if this quest unlocks a building
  if (questDef.unlocksBuilding && buildingTypes[questDef.unlocksBuilding]) {
    const unlockedBuilding = buildingTypes[questDef.unlocksBuilding];
    const buildingIcon = buildingIcons[questDef.unlocksBuilding] || '';
    rewardParts.push(`Unlocks ${unlockedBuilding.displayName}${buildingIcon ? ` <img src="${buildingIcon}" alt="${unlockedBuilding.displayName}" style="width: 24px; height: 24px; vertical-align: middle;">` : ''}`);
  }
  
  // Show resource rewards
  Object.keys(questDef.reward).forEach(resource => {
    const amount = questDef.reward[resource];
    const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
    rewardParts.push(`${amount} ${resourceName}`);
  });
  
  rewardEl.innerHTML = rewardParts.join(', ');
  
  // Show popup
  popup.style.display = 'flex';
  
  // Auto-close after 5 seconds if not manually closed
  setTimeout(() => {
    if (popup.style.display === 'flex') {
      closeQuestCompletionPopup();
    }
  }, 5000);
}

// Close quest completion popup and claim reward
function closeQuestCompletionPopup() {
  const popup = document.getElementById('quest-completion-popup');
  if (popup) {
    const titleEl = document.getElementById('quest-completion-title');
    if (titleEl) {
      const questTitle = titleEl.textContent;
      // Find the quest by title and claim its reward
      const questDef = questDefinitions.find(q => q.title === questTitle);
      if (questDef) {
        claimQuestReward(questDef.id);
      }
    }
    popup.style.display = 'none';
  }
}

// Update brick trade display
// Generic resource trade update function
function updateResourceTrade(resourceName, exchangeRate, step, amount) {
  // Handle brick/bricks naming inconsistency
  const sliderId = resourceName === 'bricks' ? 'brick-slider' : `${resourceName}-slider`;
  const amountId = resourceName === 'bricks' ? 'brick-amount' : `${resourceName}-amount`;
  const costDisplayId = resourceName === 'bricks' ? 'brick-cost-display' : `${resourceName}-cost-display`;
  // For bricks, use 'gold-reward-display' for backward compatibility, otherwise use resource-specific ID
  const rewardDisplayId = resourceName === 'bricks' ? 'gold-reward-display' : `${resourceName}-gold-reward-display`;
  const fillBarId = resourceName === 'bricks' ? 'brick-slider-fill' : `${resourceName}-slider-fill`;
  const sellBtnId = resourceName === 'bricks' ? 'sell-bricks-btn' : `sell-${resourceName}-btn`;
  
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  
  const maxResource = Math.floor(gameState.resources[resourceName] || 0);
  
  // If player has less than exchange rate, disable slider
  if (maxResource < exchangeRate) {
    slider.disabled = true;
    slider.min = 0;
    slider.max = exchangeRate;
    slider.value = 0;
    
    const fillBar = document.getElementById(fillBarId);
    if (fillBar) {
      fillBar.style.width = '0%';
    }
    
    const amountEl = document.getElementById(amountId);
    const costEl = document.getElementById(costDisplayId);
    const rewardEl = document.getElementById(rewardDisplayId);
    if (amountEl) amountEl.textContent = '0';
    if (costEl) costEl.textContent = '0';
    if (rewardEl) rewardEl.textContent = '0';
    
    const sellBtn = document.getElementById(sellBtnId);
    if (sellBtn) {
      // Only update disabled state if it actually changed to prevent flashing
      if (!sellBtn.disabled) {
        sellBtn.disabled = true;
      }
      sellBtn.title = `Not enough ${resourceName} (need ${exchangeRate}, have ${maxResource})`;
    }
    return;
  }
  
  // Player has enough, enable slider
  const maxSliderValue = Math.floor(maxResource / step) * step;
  
  const currentValue = parseInt(amount || slider.value || 0);
  const roundedValue = Math.round(currentValue / step) * step;
  const resourceAmount = Math.max(0, Math.min(roundedValue, maxSliderValue));
  
  slider.disabled = false;
  slider.min = 0;
  slider.max = maxSliderValue;
  
  const progress = maxSliderValue > 0 ? (resourceAmount / maxSliderValue) * 100 : 0;
  
  slider.value = resourceAmount;
  
  requestAnimationFrame(() => {
    slider.value = resourceAmount;
    const fillBar = document.getElementById(fillBarId);
    if (fillBar) {
      fillBar.style.width = `${progress}%`;
    }
  });
  
  const fillBar = document.getElementById(fillBarId);
  if (fillBar) {
    fillBar.style.width = `${progress}%`;
  }
  
  const goldReward = Math.floor(resourceAmount / exchangeRate);
  
  const amountEl = document.getElementById(amountId);
  const costEl = document.getElementById(costDisplayId);
  const rewardEl = document.getElementById(rewardDisplayId);
  if (amountEl) amountEl.textContent = resourceAmount;
  if (costEl) costEl.textContent = resourceAmount;
  if (rewardEl) rewardEl.textContent = goldReward;
  
  const sellBtn = document.getElementById(sellBtnId);
  if (sellBtn) {
    const canAfford = resourceAmount > 0 && gameState.resources[resourceName] >= resourceAmount;
    const shouldBeDisabled = !canAfford;
    
    // Only update disabled state if it actually changed to prevent flashing
    if (sellBtn.disabled !== shouldBeDisabled) {
      sellBtn.disabled = shouldBeDisabled;
    }
    
    if (resourceAmount === 0) {
      sellBtn.title = `Select an amount of ${resourceName} to sell`;
    } else if (!canAfford) {
      sellBtn.title = `Not enough ${resourceName} (need ${resourceAmount}, have ${maxResource})`;
    } else {
      sellBtn.title = `Sell ${resourceAmount} ${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} for ${goldReward} Gold Coin${goldReward !== 1 ? 's' : ''}`;
    }
  }
}

function updateBrickTrade(amount) {
  updateResourceTrade('bricks', 5, 5, amount);
}

function updateWoodTrade(amount) {
  updateResourceTrade('wood', 10, 10, amount);
}

function updateStoneTrade(amount) {
  updateResourceTrade('stone', 10, 10, amount);
}

function updateClayTrade(amount) {
  updateResourceTrade('clay', 10, 10, amount);
}

// Update shop UI to reflect current resources
function updateShopUI() {
  // Update brick slider (wood, stone, and clay moved to merchant menu)
  const brickSlider = document.getElementById('brick-slider');
  if (brickSlider) {
    updateBrickTrade(brickSlider.value);
  }
  
  // Update upgrade buttons
  const upgrades = [
    { id: 'upgrade-wood-btn', key: 'woodProduction', cost: 100 },
    { id: 'upgrade-stone-btn', key: 'stoneProduction', cost: 100 },
    { id: 'upgrade-clay-btn', key: 'clayProduction', cost: 100 },
    { id: 'upgrade-housing-btn', key: 'housingCapacity', cost: 100 },
    { id: 'upgrade-smelting-btn', key: 'smeltingSpeed', cost: 100 }
  ];
  
  upgrades.forEach(upgrade => {
    const btn = document.getElementById(upgrade.id);
    if (btn) {
      const purchased = gameState.upgrades[upgrade.key];
      const canAfford = gameState.resources.gold >= upgrade.cost;
      
      if (purchased) {
        btn.disabled = true;
        btn.textContent = 'Purchased';
        btn.title = 'Already purchased';
      } else {
        btn.disabled = !canAfford;
        btn.textContent = 'Purchase';
        if (!canAfford) {
          btn.title = `Not enough gold (need ${upgrade.cost}, have ${Math.floor(gameState.resources.gold)})`;
        } else {
          btn.title = `Purchase for ${upgrade.cost} gold`;
        }
      }
    }
  });
}

// Generic resource sell function
function sellResourceForGold(resourceName, exchangeRate, displayName) {
  const sliderId = `${resourceName}-slider`;
  const slider = document.getElementById(sliderId);
  const resourceAmount = slider ? parseInt(slider.value) : 0;
  
  if (resourceAmount <= 0) {
    if (typeof showMessage === 'function') {
      showMessage(`Please select an amount of ${displayName.toLowerCase()} to sell.`);
    }
    return;
  }
  
  const goldReward = Math.floor(resourceAmount / exchangeRate);
  
  if (gameState.resources[resourceName] >= resourceAmount) {
    gameState.resources[resourceName] -= resourceAmount;
    gameState.resources.gold += goldReward;
    if (typeof updateUI === 'function') {
      updateUI();
    }
    if (typeof updateShopUI === 'function') {
      updateShopUI();
    }
    if (typeof showMessage === 'function') {
      showMessage(`Sold ${resourceAmount} ${displayName} for ${goldReward} Gold Coin${goldReward !== 1 ? 's' : ''}!`);
    }
  } else {
    if (typeof showMessage === 'function') {
      showMessage(`Not enough ${displayName.toLowerCase()}! Need ${resourceAmount} ${displayName.toLowerCase()}, have ${Math.floor(gameState.resources[resourceName])}.`);
    }
  }
}

// Sell bricks for gold
function sellBricksForGold() {
  sellResourceForGold('bricks', 5, 'Clay Bricks');
}

// Sell wood for gold
function sellWoodForGold() {
  sellResourceForGold('wood', 10, 'Wood');
}

// Sell stone for gold
function sellStoneForGold() {
  sellResourceForGold('stone', 10, 'Stone');
}

// Sell clay for gold
function sellClayForGold() {
  sellResourceForGold('clay', 10, 'Clay');
}

// Merchant-specific resource trade update function
function updateMerchantResourceTrade(resourceName, exchangeRate, amount) {
  const sliderId = `merchant-${resourceName}-slider`;
  const amountId = `merchant-${resourceName}-amount`;
  const costDisplayId = `merchant-${resourceName}-cost-display`;
  const rewardDisplayId = `merchant-${resourceName}-gold-reward-display`;
  const fillBarId = `merchant-${resourceName}-slider-fill`;
  const sellBtnId = `merchant-sell-${resourceName}-btn`;
  
  const slider = document.getElementById(sliderId);
  if (!slider) return;
  
  // Ensure gameState and resources exist
  if (!gameState || !gameState.resources) {
    console.error('updateMerchantResourceTrade: gameState.resources is not available');
    return;
  }
  
  // Get resource value - access it directly using bracket notation
  // resourceName should be 'wood', 'stone', or 'clay'
  // Access resources object property directly to ensure we get the correct value
  let resourceValue = gameState.resources[resourceName];
  
  // If accessing via bracket notation fails, try direct property access as fallback
  if (resourceValue === undefined && resourceName === 'stone' && 'stone' in gameState.resources) {
    resourceValue = gameState.resources.stone;
  } else if (resourceValue === undefined && resourceName === 'wood' && 'wood' in gameState.resources) {
    resourceValue = gameState.resources.wood;
  } else if (resourceValue === undefined && resourceName === 'clay' && 'clay' in gameState.resources) {
    resourceValue = gameState.resources.clay;
  }
  
  // Convert to number and ensure it's valid (handle undefined, null, or NaN)
  const maxResource = Math.floor((resourceValue !== undefined && resourceValue !== null && !isNaN(resourceValue)) 
    ? Number(resourceValue) 
    : 0);
  
  // If player has less than exchange rate, disable slider
  if (maxResource < exchangeRate) {
    slider.disabled = true;
    slider.min = 0;
    slider.max = exchangeRate;
    slider.value = 0;
    
    const fillBar = document.getElementById(fillBarId);
    if (fillBar) {
      fillBar.style.width = '0%';
    }
    
    const amountEl = document.getElementById(amountId);
    const costEl = document.getElementById(costDisplayId);
    const rewardEl = document.getElementById(rewardDisplayId);
    if (amountEl) amountEl.textContent = '0';
    if (costEl) costEl.textContent = '0';
    if (rewardEl) rewardEl.textContent = '0';
    
    const sellBtn = document.getElementById(sellBtnId);
    if (sellBtn) {
      // Only update disabled state if it actually changed to prevent flashing
      if (!sellBtn.disabled) {
        sellBtn.disabled = true;
      }
      sellBtn.title = `Not enough ${resourceName} (need ${exchangeRate}, have ${maxResource})`;
    }
    return;
  }
  
  // Check cooldown status
  const cooldownStatus = getMerchantCooldownStatus(resourceName);
  
  // Calculate max slider value based on available resources AND cooldown limit
  // Cooldown limits to 100 units total, so we need to round down the remaining amount to the nearest exchange rate multiple
  const maxResourceByCooldown = cooldownStatus.canTrade 
    ? Math.floor(cooldownStatus.remainingTradeAmount / exchangeRate) * exchangeRate 
    : 0;
  const maxResourceByAvailable = Math.floor(maxResource / exchangeRate) * exchangeRate;
  
  // Player has enough, but check cooldown status
  let maxSliderValue;
  if (!cooldownStatus.canTrade) {
    // On cooldown - disable slider
    maxSliderValue = 0;
    slider.disabled = true;
  } else {
    // Not on cooldown - limit by both available resources and remaining trade amount
    // Take the minimum of what's available and what the cooldown allows
    maxSliderValue = Math.min(maxResourceByAvailable, maxResourceByCooldown);
    slider.disabled = maxSliderValue < exchangeRate;
  }
  
  // Preserve current slider value if amount is not provided or is undefined
  // Only use the provided amount if it's explicitly passed (not undefined)
  let currentValue;
  if (amount !== undefined && amount !== null) {
    currentValue = parseInt(amount);
  } else {
    // Preserve existing slider value
    currentValue = parseInt(slider.value) || 0;
  }
  
  const roundedValue = Math.round(currentValue / exchangeRate) * exchangeRate;
  // Clamp to both maxSliderValue and remaining trade amount (already rounded in maxSliderValue, but double-check)
  const maxByRemainingTrade = cooldownStatus.canTrade 
    ? Math.floor(cooldownStatus.remainingTradeAmount / exchangeRate) * exchangeRate 
    : 0;
  const resourceAmount = Math.max(0, Math.min(roundedValue, maxSliderValue, maxByRemainingTrade));
  
  slider.min = 0;
  slider.max = maxSliderValue;
  
  const progress = maxSliderValue > 0 ? (resourceAmount / maxSliderValue) * 100 : 0;
  
  slider.value = resourceAmount;
  
  requestAnimationFrame(() => {
    slider.value = resourceAmount;
    const fillBar = document.getElementById(fillBarId);
    if (fillBar) {
      fillBar.style.width = `${progress}%`;
    }
  });
  
  const fillBar = document.getElementById(fillBarId);
  if (fillBar) {
    fillBar.style.width = `${progress}%`;
  }
  
  const goldReward = Math.floor(resourceAmount / exchangeRate);
  
  const amountEl = document.getElementById(amountId);
  const costEl = document.getElementById(costDisplayId);
  const rewardEl = document.getElementById(rewardDisplayId);
  if (amountEl) amountEl.textContent = resourceAmount;
  if (costEl) costEl.textContent = resourceAmount;
  if (rewardEl) rewardEl.textContent = goldReward;
  
  const sellBtn = document.getElementById(sellBtnId);
  if (sellBtn) {
    const canAfford = resourceAmount > 0 && gameState.resources[resourceName] >= resourceAmount;
    const canTrade = cooldownStatus.canTrade && resourceAmount > 0;
    const shouldBeDisabled = !canAfford || !canTrade;
    
    // Only update disabled state if it actually changed to prevent flashing
    if (sellBtn.disabled !== shouldBeDisabled) {
      sellBtn.disabled = shouldBeDisabled;
    }
    
    // Update button title with cooldown info
    if (!cooldownStatus.canTrade) {
      if (cooldownStatus.isOnCooldown) {
        const totalSeconds = Math.floor(cooldownStatus.remainingCooldown / 1000);
        const minutesRemaining = Math.floor(totalSeconds / 60);
        const secondsRemaining = totalSeconds % 60;
        sellBtn.title = `This trader is on cooldown! Wait ${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')} before trading ${resourceName} again.`;
      } else {
        sellBtn.title = `This trader has reached the 100 unit limit and is on cooldown. Wait 5 minutes.`;
      }
    } else if (resourceAmount === 0) {
      sellBtn.title = `Select an amount of ${resourceName} to sell (${cooldownStatus.remainingTradeAmount}/100 remaining before cooldown)`;
    } else if (!canAfford) {
      sellBtn.title = `Not enough ${resourceName} (need ${resourceAmount}, have ${maxResource})`;
    } else {
      sellBtn.title = `Sell ${resourceAmount} ${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} for ${goldReward} Gold Coin${goldReward !== 1 ? 's' : ''} (${cooldownStatus.remainingTradeAmount - resourceAmount}/100 remaining)`;
    }
  }
  
  // Update cooldown status display
  const cooldownStatusId = `merchant-${resourceName}-cooldown-status`;
  const cooldownStatusEl = document.getElementById(cooldownStatusId);
  if (cooldownStatusEl) {
    if (!cooldownStatus.canTrade) {
      if (cooldownStatus.isOnCooldown) {
        const totalSeconds = Math.floor(cooldownStatus.remainingCooldown / 1000);
        const minutesRemaining = Math.floor(totalSeconds / 60);
        const secondsRemaining = totalSeconds % 60;
        cooldownStatusEl.innerHTML = `<div style="color: #FF9800; font-size: 12px; margin-top: 5px;">⏱️ Cooldown: ${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')} remaining</div>`;
      } else {
        cooldownStatusEl.innerHTML = `<div style="color: #FF9800; font-size: 12px; margin-top: 5px;">⏱️ Cooldown: 5:00 remaining</div>`;
      }
    } else {
      cooldownStatusEl.innerHTML = `<div style="color: #4CAF50; font-size: 12px; margin-top: 5px;">✓ ${cooldownStatus.remainingTradeAmount}/100 units available before cooldown</div>`;
    }
  }
}

// Check merchant cooldown status for a resource
function getMerchantCooldownStatus(resourceName) {
  if (!gameState.merchantCooldowns || !gameState.merchantCooldowns[resourceName]) {
    // Initialize if missing
    if (!gameState.merchantCooldowns) gameState.merchantCooldowns = {};
    if (!gameState.merchantCooldowns[resourceName]) {
      gameState.merchantCooldowns[resourceName] = { totalTraded: 0, cooldownStart: null };
    }
  }
  
  const cooldown = gameState.merchantCooldowns[resourceName];
  const COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  const MAX_TRADE_AMOUNT = 100;
  
  // Reset cooldown if it has expired
  if (cooldown.cooldownStart !== null) {
    const timeSinceCooldown = Date.now() - cooldown.cooldownStart;
    if (timeSinceCooldown >= COOLDOWN_DURATION) {
      cooldown.totalTraded = 0;
      cooldown.cooldownStart = null;
    }
  }
  
  const remainingCooldown = cooldown.cooldownStart ? Math.max(0, COOLDOWN_DURATION - (Date.now() - cooldown.cooldownStart)) : 0;
  const remainingTradeAmount = Math.max(0, MAX_TRADE_AMOUNT - cooldown.totalTraded);
  const isOnCooldown = remainingCooldown > 0;
  
  return {
    totalTraded: cooldown.totalTraded,
    remainingTradeAmount: remainingTradeAmount,
    isOnCooldown: isOnCooldown,
    remainingCooldown: remainingCooldown,
    canTrade: !isOnCooldown && remainingTradeAmount > 0
  };
}

// Execute merchant resource trade (with slider)
function executeMerchantResourceTrade(townId, resourceName, exchangeRate) {
  const sliderId = `merchant-${resourceName}-slider`;
  const slider = document.getElementById(sliderId);
  const resourceAmount = slider ? parseInt(slider.value) : 0;
  
  if (resourceAmount <= 0) {
    if (typeof showMessage === 'function') {
      showMessage(`Please select an amount of ${resourceName} to sell.`);
    }
    return;
  }
  
  // Check cooldown status
  const cooldownStatus = getMerchantCooldownStatus(resourceName);
  
  if (!cooldownStatus.canTrade) {
    if (cooldownStatus.isOnCooldown) {
      const totalSeconds = Math.floor(cooldownStatus.remainingCooldown / 1000);
      const minutesRemaining = Math.floor(totalSeconds / 60);
      const secondsRemaining = totalSeconds % 60;
      if (typeof showMessage === 'function') {
        showMessage(`This trader is on cooldown! Please wait ${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')} before trading ${resourceName} again.`);
      }
    } else {
      if (typeof showMessage === 'function') {
        showMessage(`This trader has already accepted 100 ${resourceName} and is on cooldown. Please wait 5 minutes.`);
      }
    }
    return;
  }
  
  // Check if this trade would exceed the 100 unit limit
  if (resourceAmount > cooldownStatus.remainingTradeAmount) {
    if (typeof showMessage === 'function') {
      showMessage(`You can only trade ${cooldownStatus.remainingTradeAmount} more ${resourceName} before the 5-minute cooldown.`);
    }
    return;
  }
  
  const goldReward = Math.floor(resourceAmount / exchangeRate);
  
  if (gameState.resources[resourceName] >= resourceAmount) {
    // Execute trade
    gameState.resources[resourceName] -= resourceAmount;
    gameState.resources.gold += goldReward;
    
    // Update cooldown tracking
    const cooldown = gameState.merchantCooldowns[resourceName];
    cooldown.totalTraded += resourceAmount;
    
    // Start cooldown if we've reached 100 units
    if (cooldown.totalTraded >= 100) {
      cooldown.cooldownStart = Date.now();
      if (typeof showMessage === 'function') {
        showMessage(`Sold ${resourceAmount} ${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} for ${goldReward} Gold Coin${goldReward !== 1 ? 's' : ''}! This trader has reached the 100 unit limit and is now on a 5-minute cooldown.`);
      }
    } else {
      if (typeof showMessage === 'function') {
        showMessage(`Sold ${resourceAmount} ${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} for ${goldReward} Gold Coin${goldReward !== 1 ? 's' : ''}! (${cooldown.totalTraded}/100 traded before cooldown)`);
      }
    }
    
    if (typeof updateUI === 'function') {
      updateUI();
    }
    if (typeof refreshTownCenterModalIfOpen === 'function') {
      refreshTownCenterModalIfOpen();
    }
  } else {
    if (typeof showMessage === 'function') {
      const resourceDisplayName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);
      showMessage(`Not enough ${resourceDisplayName.toLowerCase()}! Need ${resourceAmount} ${resourceDisplayName.toLowerCase()}, have ${Math.floor(gameState.resources[resourceName])}.`);
    }
  }
}

// Purchase upgrade
function purchaseUpgrade(upgradeKey, cost) {
  if (gameState.upgrades[upgradeKey]) {
    showMessage('Upgrade already purchased!');
    return;
  }
  
  if (gameState.resources.gold < cost) {
    showMessage(`Not enough gold! Need ${cost} gold.`);
    return;
  }
  
  gameState.resources.gold -= cost;
  gameState.upgrades[upgradeKey] = true;
  
  // Recalculate production to apply the upgrade
  calculateProduction();
  updateUI();
  updateShopUI();
  
  const upgradeNames = {
    woodProduction: 'Wood Production Boost',
    stoneProduction: 'Stone Production Boost',
    clayProduction: 'Clay Production Boost',
    housingCapacity: 'Housing Capacity Boost',
    smeltingSpeed: 'Smelting Speed Boost'
  };
  
  showMessage(`${upgradeNames[upgradeKey]} purchased!`);
}

// Close modals when clicking outside
window.addEventListener('click', (event) => {
  const shopModal = document.getElementById('shop-modal');
  const townCenterModal = document.getElementById('town-center-modal');
  const shopContent = document.querySelector('.shop-content');
  if (shopModal && event.target === shopModal) {
    shopModal.style.display = 'none';
  }
  
  // Close town center modal when clicking outside
  if (townCenterModal && event.target === townCenterModal) {
    closeTownCenterModal();
  }
  
  // Close quests modal when clicking outside
  const questsModal = document.getElementById('quests-modal');
  const questsContent = document.querySelector('.quests-content');
  if (questsModal && event.target === questsModal) {
    questsModal.style.display = 'none';
  }
  
  // Close load menu when clicking outside
  const loadModal = document.getElementById('load-modal');
  if (loadModal && event.target === loadModal) {
    loadModal.style.display = 'none';
  }
  
  // Close book of buildings modal when clicking outside
  const bookModal = document.getElementById('book-of-buildings-modal');
  if (bookModal && event.target === bookModal) {
    bookModal.style.display = 'none';
  }
});

// Track Shift key state for multiple building placement
// Setup zoom controls
function setupZoomControls() {
  const gridWrapper = document.getElementById('grid-wrapper');
  if (!gridWrapper) return;
  
  // Initialize zoom level if not set
  if (!gameState.zoomLevel) {
    gameState.zoomLevel = 1.0;
  }
  
  // Mouse wheel zoom (only with Ctrl/Cmd to allow normal scrolling)
  gridWrapper.addEventListener('wheel', (e) => {
    // Only zoom if Ctrl/Cmd key is held, otherwise allow normal scrolling
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    }
    // If Ctrl/Cmd is not held, allow normal scrolling (don't preventDefault)
  }, { passive: false });
  
  // Initialize zoom display and apply zoom
  updateZoomDisplay();
  applyZoom();
}

window.addEventListener('keydown', (e) => {
  // Only handle zoom if not typing in an input
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    // Zoom shortcuts
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
      return;
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
      return;
    } else if (e.key === '0' && !e.shiftKey) {
      e.preventDefault();
      resetZoom();
      return;
    }
  }
  
  if (e.key === 'Shift' && !shiftHeld) {
    shiftHeld = true;
  }
  
  // Close menus and exit edit mode when Escape is pressed
  if (e.key === 'Escape') {
    const questCompletionPopup = document.getElementById('quest-completion-popup');
    const shopModal = document.getElementById('shop-modal');
    const questsModal = document.getElementById('quests-modal');
    const loadModal = document.getElementById('load-modal');
    const settingsModal = document.getElementById('settings-modal');
    const townCenterModal = document.getElementById('town-center-modal');
    
    // Close quest completion popup first (highest priority)
    if (questCompletionPopup && questCompletionPopup.style.display === 'flex') {
      closeQuestCompletionPopup();
      return;
    }
    
    // Close shop if it's open
    if (shopModal && shopModal.style.display === 'flex') {
      shopModal.style.display = 'none';
      return;
    }
    
    // Close quests if it's open
    if (questsModal && questsModal.style.display === 'flex') {
      questsModal.style.display = 'none';
      return;
    }
    
    // Close town center modal if it's open
    if (townCenterModal && townCenterModal.style.display === 'flex') {
      closeTownCenterModal();
      return;
    }
    
    // Close load menu if it's open
    if (loadModal && loadModal.style.display === 'flex') {
      loadModal.style.display = 'none';
      return;
    }
    
    // Toggle settings modal
    if (settingsModal) {
      if (settingsModal.style.display === 'none' || settingsModal.style.display === '') {
        settingsModal.style.display = 'flex';
      } else {
        settingsModal.style.display = 'none';
      }
      return;
    }
    
    // Exit edit mode if active
    if (editMode) {
      editMode = false;
      tileBeingMoved = null;
      selectedBuildingType = null;
      selectedTile = null;
      
      const editBtn = document.getElementById('edit-mode-btn');
      const editText = editBtn ? editBtn.querySelector('.edit-text') : null;
      
      if (editBtn && editText) {
        editText.textContent = 'Edit Mode';
        editBtn.style.background = '';
        showMessage("Edit mode disabled.");
      }
      
      renderGrid();
      updateUI();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' && shiftHeld) {
    shiftHeld = false;
    // Clear building selection when Shift is released
    if (selectedBuildingType) {
      selectedBuildingType = null;
      updateBuildingSelection();
      showMessage("Multiple placement mode ended.");
    }
  }
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load quests from JSON before initializing game
    await loadQuestsFromJson();
    
    const loaded = loadGame();
    
    if (!loaded) {
      initializeGrid();
    }
    
    // Ensure quests are initialized and is an array
    if (!gameState.quests || !Array.isArray(gameState.quests)) {
      gameState.quests = [];
    }
    initializeQuests();
    
    // Check if character is selected
    if (!gameState.character) {
      showCharacterSelection();
    } else {
      hideCharacterSelection();
      applyPlayerColor();
      updatePlayerIndicator();
      // Calculate production and unlocks on initialization
      calculateProduction();
      checkUnlocks();
      checkQuests();
      renderGrid();
      updateUI();
      updateSaveStatus();
      updateQuestIndicator();
      initializeBuildMenu();
      updateBuildMenu();
      initializeResourceTooltips();
      setupExpansionButton();
      setupZoomControls();
      updateSaveSlots();
      startGameLoop();
    }
  } catch (e) {
    console.error('Error initializing game:', e);
    showMessage('Error loading game. Please refresh the page.');
  }
});




// ======================================================
// SIMPLE IN-BROWSER TEST HARNESS
// ======================================================

function runTests() {
  const results = [];

  function logResult(name, pass, actual, expected) {
    const status = pass ? "✅ PASS" : "❌ FAIL";
    const message = `${status} | ${name} | actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`;
    results.push({ name, pass, actual, expected });
    console[pass ? "log" : "error"](message);
  }

  function assertEqual(name, actual, expected) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    logResult(name, pass, actual, expected);
  }

  function assertClose(name, actual, expected, epsilon = 1e-6) {
    const pass = Math.abs(actual - expected) <= epsilon;
    logResult(name, pass, actual, expected);
  }

  function resetStateForTests() {
    // Reset the parts of gameState that matter for logic tests
    gameState.character = null;
    gameState.upgrades = {
      woodProduction: false,
      stoneProduction: false,
      clayProduction: false,
      housingCapacity: false,
      smeltingSpeed: false
    };
    gameState.resources = {
      wood: 50,
      stone: 0,
      clay: 0,
      iron: 0,
      gold: 0,
      bricks: 0,
      ironBars: 0,
      coal: 0
    };
    gameState.population.current = 0;
    gameState.population.capacity = 0;
    initializeGrid();
  }

  console.log("====== RUNNING TESTS ======");

  // ---------------------------
  // 1) formatNumber tests
  // ---------------------------
  assertEqual("formatNumber(999, 0)", formatNumber(999, 0), "999");
  assertEqual("formatNumber(1500, 1)", formatNumber(1500, 1), "1.5k");
  assertEqual("formatNumber(1500000, 2)", formatNumber(1500000, 2), "1.50M");
  assertEqual("formatNumber(2000000000, 1)", formatNumber(2000000000, 1), "2.0B");

  // ---------------------------
  // 2) getBuildingProduction base values
  // ---------------------------
  resetStateForTests();
  let prod = getBuildingProduction("lumberMill", 1);
  assertClose("lumberMill lvl1 wood", prod.wood, 0.6);
  assertClose("lumberMill lvl1 stone", prod.stone, 0);

  prod = getBuildingProduction("quarry", 1);
  assertClose("quarry lvl1 stone", prod.stone, 0.3);

  // Level-scaling check (productionGrowthFactor)
  const lvl2Factor = Math.pow(buildingTypes.lumberMill.productionGrowthFactor, 1); // level - 1
  prod = getBuildingProduction("lumberMill", 2);
  assertClose("lumberMill lvl2 wood scaling",
    prod.wood,
    0.6 * lvl2Factor
  );

  // ---------------------------
  // 3) Character bonuses in getBuildingProduction
  // ---------------------------
  resetStateForTests();
  gameState.character = "miner";
  prod = getBuildingProduction("quarry", 1);
  // base stone 0.3 * 1.5 miningProductionMultiplier
  assertClose("miner stone bonus (quarry)",
    prod.stone,
    0.3 * characterTypes.miner.miningProductionMultiplier
  );

  resetStateForTests();
  gameState.character = "farmer";
  prod = getBuildingProduction("advancedFarm", 1);
  // base pop 1.0 * 1.5 farmingProductionMultiplier * 1.3 populationMultiplier
  const expectedFarmerPop =
    buildingTypes.advancedFarm.baseProduction.population *
    characterTypes.farmer.farmingProductionMultiplier *
    characterTypes.farmer.populationMultiplier;
  assertClose("farmer population bonus (advancedFarm)", prod.population, expectedFarmerPop);

  // ---------------------------
  // 4) getBuildingCost + character discounts
  // ---------------------------
  resetStateForTests();
  let cost = getBuildingCost("tepee", 1);
  assertEqual("tepee lvl1 cost wood", cost.wood, buildingTypes.tepee.baseCost.wood);
  assertEqual("tepee lvl1 cost stone", cost.stone, buildingTypes.tepee.baseCost.stone || 0);

  // Farmer discount on farming buildings (level 1 only)
  resetStateForTests();
  gameState.character = "farmer";
  cost = getBuildingCost("farm", 1);
  const baseFarmCostWood = buildingTypes.farm.baseCost.wood;
  const farmerDiscount = characterTypes.farmer.buildDiscount;
  assertEqual("farmer farm lvl1 wood cost",
    cost.wood,
    Math.floor(baseFarmCostWood * farmerDiscount)
  );

  // Miner discount on stone buildings (all levels)
  resetStateForTests();
  gameState.character = "miner";
  const quarryBaseWood = buildingTypes.quarry.baseCost.wood || 0;
  const quarryFactorLvl2 = Math.pow(buildingTypes.quarry.costGrowthFactor, 2 - 1);
  const expectedQuarryLvl2Wood = Math.floor(quarryBaseWood * quarryFactorLvl2 * characterTypes.miner.upgradeDiscount);

  cost = getBuildingCost("quarry", 2);
  assertEqual("miner quarry lvl2 wood cost", cost.wood, expectedQuarryLvl2Wood);

  // ---------------------------
  // 5) calculateProduction integration test
  // ---------------------------
  resetStateForTests();

  // Place a few simple buildings
  gameState.map[0][0] = { type: "lumberMill", level: 1 }; // +0.6 wood
  gameState.map[0][1] = { type: "quarry", level: 1 };     // +0.3 stone
  gameState.map[0][2] = { type: "tepee", level: 1 };      // +3 capacity

  calculateProduction();

  assertClose("calculateProduction wps (base 1 + lumberMill)",
    gameState.rates.wps,
    1 + 0.6
  );
  assertClose("calculateProduction sps (quarry only)",
    gameState.rates.sps,
    0.3
  );
  assertClose("calculateProduction capacity (tepee)",
    gameState.population.capacity,
    buildingTypes.tepee.baseProduction.capacity
  );

  console.log("====== TESTS FINISHED ======");
  const failed = results.filter(r => !r.pass).length;
  console.log(`Summary: ${results.length - failed} passed, ${failed} failed.`);
  return results;
}

// Make it easy to call from the console
window.runTests = runTests;
window.runTests = runTests;
