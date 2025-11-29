// Grid size
const GRID_SIZE = 15;

// Game state
let gameState = {
  resources: {
    wood: 50,
    stone: 0,
    clay: 0,
    iron: 0,
    gold: 0,
    bricks: 0,
    ironBars: 0
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
  character: null, // "miner" | "farmer" | null
  timestamp: Date.now(),
  upgrades: {
    woodProduction: false, // +20% wood production
    stoneProduction: false, // +20% stone production
    clayProduction: false, // +20% clay production
    housingCapacity: false, // +20% housing capacity
    smeltingSpeed: false // +20% smelting speed
  },
  quests: [] // Array of quest progress: [{id, completed, claimed}]
};

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

// Edit mode state
let editMode = false;
let tileBeingMoved = null; // {row, col, type, level}

// Shift key state for multiple building placement
let shiftHeld = false;

// Quest definitions
const questDefinitions = [
  {
    id: 'first_shelter',
    title: 'A Place to Sleep',
    description: 'Build 1 Tepee to start housing your population.',
    checkCondition: () => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].type === 'tepee') {
            return true;
          }
        }
      }
      return false;
    },
    reward: { wood: 20 }
  },
  {
    id: 'basic_sustenance',
    title: 'Feeding the Tribe',
    description: 'Build 1 Farm.',
    checkCondition: () => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].type === 'farm') {
            return true;
          }
        }
      }
      return false;
    },
    reward: { stone: 20 }
  },
  {
    id: 'timber',
    title: 'Timber Production',
    description: 'Reach a wood production rate of 5 per second.',
    checkCondition: () => gameState.rates.wps >= 5,
    reward: { wood: 50 }
  },
  {
    id: 'growing_community',
    title: 'Growing Community',
    description: 'Reach a total population of 10.',
    checkCondition: () => gameState.population.current >= 10,
    reward: { stone: 50 }
  },
  {
    id: 'stone_age',
    title: 'The Stone Age',
    description: 'Build a Quarry to start gathering stone.',
    checkCondition: () => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].type === 'quarry') {
            return true;
          }
        }
      }
      return false;
    },
    reward: { clay: 30 }
  },
  {
    id: 'expansion',
    title: 'Better Buildings',
    description: 'Upgrade any building to Level 2.',
    checkCondition: () => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].level >= 2) {
            return true;
          }
        }
      }
      return false;
    },
    reward: { wood: 50, stone: 50 }
  },
  {
    id: 'clay_industry',
    title: 'Mud to Materials',
    description: 'Build a Clay Pool and reach 100 stored Clay.',
    checkCondition: () => {
      let hasClayPool = false;
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].type === 'clayPool') {
            hasClayPool = true;
            break;
          }
        }
        if (hasClayPool) break;
      }
      return hasClayPool && gameState.resources.clay >= 100;
    },
    reward: { iron: 20 }
  },
  {
    id: 'firing_up',
    title: 'Industrialization',
    description: 'Build a Smelter.',
    checkCondition: () => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].type === 'smelter') {
            return true;
          }
        }
      }
      return false;
    },
    reward: { wood: 20 }
  },
  {
    id: 'master_smelter',
    title: 'Heavy Industry',
    description: 'Produce a total of 20 Clay Bricks.',
    checkCondition: () => gameState.resources.bricks >= 20,
    reward: { gold: 5 }
  },
  {
    id: 'urban_living',
    title: 'Modern Living',
    description: 'Build a Brick House.',
    checkCondition: () => {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (gameState.map[row] && gameState.map[row][col] && gameState.map[row][col].type === 'brickHouse') {
            return true;
          }
        }
      }
      return false;
    },
    reward: { gold: 100 }
  }
];

// Building type definitions
const buildingTypes = {
  tepee: {
    displayName: "Tepee",
    category: "housing",
    baseCost: { wood: 20, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, population: 0, capacity: 3 },
    productionGrowthFactor: 1.4,
    maxLevel: null, // Infinite
    unlocked: true
  },
  farm: {
    displayName: "Farm",
    category: "farming",
    baseCost: { wood: 20, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, population: 0.4, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: true
  },
  lumberMill: {
    displayName: "Lumber Mill",
    category: "wood",
    baseCost: { wood: 35, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0.6, stone: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: true
  },
  quarry: {
    displayName: "Quarry",
    category: "stone",
    baseCost: { wood: 40, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0.3, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: true
  },
  clayPool: {
    displayName: "Clay Pool",
    category: "stone",
    baseCost: { wood: 30, stone: 15 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, clay: 0.4, iron: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: true
  },
  ironMine: {
    displayName: "Iron Mine",
    category: "stone",
    baseCost: { wood: 50, stone: 30 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0.5, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: true
  },
  cabin: {
    displayName: "Cabin",
    category: "housing",
    baseCost: { wood: 50, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, population: 0, capacity: 8 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: false,
    unlockCondition: { type: "population", threshold: 10 }
  },
  advancedFarm: {
    displayName: "Advanced Farm",
    category: "farming",
    baseCost: { wood: 60, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, population: 1.0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: false,
    unlockCondition: { type: "buildingCount", buildingType: "farm", threshold: 3 },
    requiredCharacter: "farmer" // Farmer-only building
  },
  advancedLumberMill: {
    displayName: "Advanced Lumber Mill",
    category: "wood",
    baseCost: { wood: 80, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 1.8, stone: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: false,
    unlockCondition: { type: "wps", threshold: 2 }
  },
  deepMine: {
    displayName: "Deep Mine",
    category: "stone",
    baseCost: { wood: 100, stone: 20 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0.8, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: false,
    unlockCondition: { type: "stone", threshold: 50 },
    requiredCharacter: "miner" // Miner-only building
  },
  oreRefinery: {
    displayName: "Ore Refinery",
    category: "stone",
    baseCost: { wood: 150, stone: 50 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 1.5, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: false,
    unlockCondition: { type: "buildingCount", buildingType: "deepMine", threshold: 1 },
    requiredCharacter: "miner" // Miner-only building
  },
  orchard: {
    displayName: "Orchard",
    category: "farming",
    baseCost: { wood: 120, stone: 0 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, population: 2.0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: false,
    unlockCondition: { type: "buildingCount", buildingType: "advancedFarm", threshold: 1 },
    requiredCharacter: "farmer" // Farmer-only building
  },
  smelter: {
    displayName: "Smelter",
    category: "production",
    baseCost: { wood: 60, stone: 20 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: true,
    smeltClayTime: 5000, // 5 seconds in milliseconds
    smeltIronTime: 10000, // 10 seconds in milliseconds
    smeltClayAmount: 2, // Amount of clay per smelt batch
    smeltIronAmount: 10, // Amount of iron per smelt batch
    smeltWoodAmount: 10, // Amount of wood fuel per smelt batch
    smeltBrickOutput: 1, // Bricks produced per batch
    smeltIronBarOutput: 1 // Iron bars produced per batch
  },
  brickHouse: {
    displayName: "Brick House",
    category: "housing",
    baseCost: { wood: 30, bricks: 40 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 12 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: false,
    unlockCondition: { type: "buildingCount", buildingType: "smelter", threshold: 1 }
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
  smelter: 'images/kiln.png'
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
  gameState.map = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    gameState.map[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      gameState.map[row][col] = {
        type: "empty",
        level: 0
      };
    }
  }
}

// Calculate production for a building at a given level
function getBuildingProduction(buildingType, level) {
  const building = buildingTypes[buildingType];
  if (!building || level < 1) return { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, gold: 0, population: 0, capacity: 0 };
  
  const factor = Math.pow(building.productionGrowthFactor, level - 1);
  let production = {
    wood: (building.baseProduction.wood || 0) * factor,
    stone: (building.baseProduction.stone || 0) * factor,
    clay: (building.baseProduction.clay || 0) * factor,
    iron: (building.baseProduction.iron || 0) * factor,
    bricks: (building.baseProduction.bricks || 0) * factor,
    gold: (building.baseProduction.gold || 0) * factor,
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
  
  return production;
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
  let totalPopulation = 0;
  let totalCapacity = 0;
  
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const tile = gameState.map[row][col];
      if (tile.type !== "empty") {
        // Handle smelter processing
        if (tile.type === "smelter") {
          processSmelter(row, col, tile.level);
        }
        
        const production = getBuildingProduction(tile.type, tile.level);
        totalWood += production.wood;
        totalStone += production.stone;
        totalClay += production.clay;
        totalIron += production.iron;
        totalBricks += production.bricks;
        totalGold += production.gold;
        totalPopulation += production.population;
        totalCapacity += production.capacity;
      }
    }
  }
  
  // Apply housing capacity upgrade
  if (gameState.upgrades.housingCapacity) {
    totalCapacity *= 1.2;
  }
  
  gameState.rates.wps = totalWood;
  gameState.rates.sps = totalStone;
  gameState.rates.cps = totalClay;
  gameState.rates.ips = totalIron;
  gameState.rates.bps = totalBricks;
  gameState.rates.gps = totalGold;
  gameState.population.capacity = totalCapacity;
  
  // Update population (capped by capacity)
  gameState.population.current = Math.min(
    gameState.population.current + totalPopulation,
    gameState.population.capacity
  );
}

// Process smelter conversion (clay -> bricks or iron -> iron bars)
function processSmelter(row, col, level) {
  // Safety check for map bounds and tile type
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) {
    return;
  }
  
  const tile = gameState.map[row][col];
  if (tile.type !== "smelter") {
    return;
  }
  
  // Ensure smelters object exists
  if (!gameState.smelters) {
    gameState.smelters = {};
  }
  
  const smelterKey = `${row}_${col}`;
  if (!gameState.smelters[smelterKey]) {
    gameState.smelters[smelterKey] = { 
      queue: [], // Array of {type: 'clay'|'iron'} objects (max 10)
      smeltingStartTime: null,
      readyOutput: { bricks: 0, ironBars: 0 }
    };
  }
  
  const smelter = gameState.smelters[smelterKey];
  // Ensure all fields exist (for old saves)
  if (!smelter.queue) {
    // Migrate old format to new queue format
    smelter.queue = [];
    if (smelter.mineralType && smelter.amount > 0) {
      for (let i = 0; i < smelter.amount; i++) {
        smelter.queue.push({ type: smelter.mineralType });
      }
    }
  }
  if (smelter.smeltingStartTime === undefined) smelter.smeltingStartTime = null;
  if (!smelter.readyOutput) smelter.readyOutput = { bricks: 0, ironBars: 0 };
  if (smelter.readyOutput.bricks === undefined) smelter.readyOutput.bricks = 0;
  if (smelter.readyOutput.ironBars === undefined) smelter.readyOutput.ironBars = 0;
  
  const building = buildingTypes.smelter;
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
    
    if (elapsedTime >= smeltTime) {
      // Smelting complete! Add output and process next batch
      if (currentBatch.type === 'clay') {
        smelter.readyOutput.bricks += building.smeltBrickOutput;
      } else if (currentBatch.type === 'iron') {
        smelter.readyOutput.ironBars += building.smeltIronBarOutput;
      }
      
      // Remove completed batch from queue
      smelter.queue.shift();
      
      // If there's more to smelt, start next batch
      if (smelter.queue.length > 0) {
        smelter.smeltingStartTime = now; // Start next batch immediately
      } else {
        // No more to smelt, reset
        smelter.smeltingStartTime = null;
      }
    }
  }
}

// Load mineral to smelter (loads exactly one batch worth, up to 10 total)
function loadMineralToSmelter(row, col, mineralType) {
  // Safety check for map bounds
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) {
    return false;
  }
  
  // Ensure smelters object exists
  if (!gameState.smelters) {
    gameState.smelters = {};
  }
  
  const smelterKey = `${row}_${col}`;
  if (!gameState.smelters[smelterKey]) {
    gameState.smelters[smelterKey] = { 
      mineralType: null,
      amount: 0, // Amount of current mineral type stored (max 10)
      smeltingStartTime: null,
      readyOutput: { bricks: 0, ironBars: 0 }
    };
  }
  
  const smelter = gameState.smelters[smelterKey];
  const tile = gameState.map[row][col];
  if (tile.type !== "smelter") return false;
  
  const building = buildingTypes.smelter;
  const maxStorage = 10; // Can hold up to 10 batches
  
  // Migrate old format if needed
  if (!smelter.queue) {
    smelter.queue = [];
    if (smelter.mineralType && smelter.amount > 0) {
      for (let i = 0; i < smelter.amount; i++) {
        smelter.queue.push({ type: smelter.mineralType });
      }
    }
  }
  
  // Check if storage is full
  if (smelter.queue.length >= maxStorage) {
    return false; // Storage is full
  }
  
  // Check resources based on mineral type
  if (mineralType === 'clay') {
    if (gameState.resources.clay < building.smeltClayAmount || gameState.resources.wood < building.smeltWoodAmount) {
      return false; // Not enough resources
    }
    // Consume resources
    gameState.resources.clay -= building.smeltClayAmount;
    gameState.resources.wood -= building.smeltWoodAmount;
    // Add to queue
    smelter.queue.push({ type: 'clay' });
    // Start smelting if not already smelting
    if (smelter.smeltingStartTime === null) {
      smelter.smeltingStartTime = Date.now();
    }
    return true;
  } else if (mineralType === 'iron') {
    if (gameState.resources.iron < building.smeltIronAmount || gameState.resources.wood < building.smeltWoodAmount) {
      return false; // Not enough resources
    }
    // Consume resources
    gameState.resources.iron -= building.smeltIronAmount;
    gameState.resources.wood -= building.smeltWoodAmount;
    // Add to queue
    smelter.queue.push({ type: 'iron' });
    // Start smelting if not already smelting
    if (smelter.smeltingStartTime === null) {
      smelter.smeltingStartTime = Date.now();
    }
    return true;
  }
  
  return false;
}

// Remove a batch from smelter and refund resources
function removeBatchFromSmelter(row, col) {
  // Safety check for map bounds
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) {
    return false;
  }
  
  // Ensure smelters object exists
  if (!gameState.smelters) {
    gameState.smelters = {};
  }

  const smelterKey = `${row}_${col}`;
  if (!gameState.smelters || !gameState.smelters[smelterKey]) {
    return false;
  }

  const smelter = gameState.smelters[smelterKey];
  const tile = gameState.map[row][col];
  if (tile.type !== "smelter") return false;
  
  // Migrate old format if needed
  if (!smelter.queue) {
    smelter.queue = [];
    if (smelter.mineralType && smelter.amount > 0) {
      for (let i = 0; i < smelter.amount; i++) {
        smelter.queue.push({ type: smelter.mineralType });
      }
    }
  }
  
  // Can't remove if nothing is stored
  if (smelter.queue.length <= 0) {
    return false;
  }
  
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
    gameState.resources.wood += building.smeltWoodAmount;
  } else if (batchToRemove.type === 'iron') {
    gameState.resources.iron += building.smeltIronAmount;
    gameState.resources.wood += building.smeltWoodAmount;
  }
  
  // If no more batches, reset
  if (smelter.queue.length === 0 && smelter.smeltingStartTime === null) {
    // Already empty, nothing to reset
  }
  
  return true;
}

// Harvest all ready output from smelter
function harvestSmelter(row, col) {
  // Safety check for map bounds
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) {
    return { bricks: 0, ironBars: 0 };
  }
  
  // Ensure smelters object exists
  if (!gameState.smelters) {
    gameState.smelters = {};
  }

  const smelterKey = `${row}_${col}`;
  if (!gameState.smelters || !gameState.smelters[smelterKey]) {
    return { bricks: 0, ironBars: 0 };
  }

  const smelter = gameState.smelters[smelterKey];
  if (!smelter.readyOutput) {
    smelter.readyOutput = { bricks: 0, ironBars: 0 };
  }
  
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

// Check unlock conditions
function checkUnlocks() {
  for (const [key, building] of Object.entries(buildingTypes)) {
    // Check character requirement first
    if (building.requiredCharacter && gameState.character !== building.requiredCharacter) {
      building.unlocked = false;
      continue;
    }
    
    if (building.unlocked || !building.unlockCondition) continue;
    
    const condition = building.unlockCondition;
    let unlocked = false;
    
    switch (condition.type) {
      case "population":
        unlocked = gameState.population.current >= condition.threshold;
        break;
      case "wps":
        unlocked = gameState.rates.wps >= condition.threshold;
        break;
      case "stone":
        unlocked = gameState.resources.stone >= condition.threshold;
        break;
      case "buildingCount":
        let count = 0;
        for (let row = 0; row < GRID_SIZE; row++) {
          for (let col = 0; col < GRID_SIZE; col++) {
            if (gameState.map[row][col].type === condition.buildingType) {
              count++;
            }
          }
        }
        unlocked = count >= condition.threshold;
        break;
    }
    
    if (unlocked) {
      building.unlocked = true;
    }
  }
}

// Place building on grid
function placeBuilding(row, col, buildingType) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return false;
  
  // Ensure grid is initialized
  if (!gameState.map || !gameState.map[row] || !gameState.map[row][col]) {
    initializeGrid();
  }
  
  const tile = gameState.map[row][col];
  if (tile.type !== "empty") return false;
  
  const building = buildingTypes[buildingType];
  if (!building || !building.unlocked) return false;
  
  // Check character requirement
  if (building.requiredCharacter && gameState.character !== building.requiredCharacter) {
    return false;
  }
  
  const cost = getBuildingCost(buildingType, 1);
  // Check if player has enough resources
  if (gameState.resources.wood < (cost.wood || 0) || 
      gameState.resources.stone < (cost.stone || 0) ||
      gameState.resources.clay < (cost.clay || 0) ||
      gameState.resources.iron < (cost.iron || 0) ||
      gameState.resources.bricks < (cost.bricks || 0)) {
    return false;
  }

  // Deduct resources
  gameState.resources.wood -= cost.wood || 0;
  gameState.resources.stone -= cost.stone || 0;
  gameState.resources.clay -= cost.clay || 0;
  gameState.resources.iron -= cost.iron || 0;
  gameState.resources.bricks -= cost.bricks || 0;
  
  // Place building
  tile.type = buildingType;
  tile.level = 1;
  
  // Initialize smelter storage if it's a smelter
  if (buildingType === "smelter") {
    // Ensure smelters object exists
    if (!gameState.smelters) {
      gameState.smelters = {};
    }
    const smelterKey = `${row}_${col}`;
    gameState.smelters[smelterKey] = { 
      mineralType: null,
      amount: 0,
      smeltingStartTime: null,
      readyOutput: { bricks: 0, ironBars: 0 }
    };
  }
  
  calculateProduction();
  checkUnlocks();
  checkQuests();
  updateBuildMenu();
  renderGrid();
  updateUI();
  
  return true;
}

// Upgrade building
function upgradeBuilding(row, col) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return false;
  
  const tile = gameState.map[row][col];
  if (tile.type === "empty") return false;
  
  const building = buildingTypes[tile.type];
  if (!building) return false;
  
  // Check max level
  if (building.maxLevel && tile.level >= building.maxLevel) return false;
  
  const nextLevel = tile.level + 1;
  const cost = getBuildingCost(tile.type, nextLevel);
  
  // Check if player has enough resources
  if (gameState.resources.wood < (cost.wood || 0) || 
      gameState.resources.stone < (cost.stone || 0) ||
      gameState.resources.clay < (cost.clay || 0) ||
      gameState.resources.iron < (cost.iron || 0) ||
      gameState.resources.bricks < (cost.bricks || 0)) {
    return false;
  }
  
  // Deduct resources
  gameState.resources.wood -= cost.wood || 0;
  gameState.resources.stone -= cost.stone || 0;
  gameState.resources.clay -= cost.clay || 0;
  gameState.resources.iron -= cost.iron || 0;
  gameState.resources.bricks -= cost.bricks || 0;
  
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
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return false;
  
  const tile = gameState.map[row][col];
  if (tile.type === "empty") return false;
  
  // Refund 50% of total cost
  const totalCost = getTotalBuildingCost(tile.type, tile.level);
  const refund = {
    wood: Math.floor((totalCost.wood || 0) * 0.5),
    stone: Math.floor((totalCost.stone || 0) * 0.5),
    clay: Math.floor((totalCost.clay || 0) * 0.5),
    iron: Math.floor((totalCost.iron || 0) * 0.5),
    bricks: Math.floor((totalCost.bricks || 0) * 0.5)
  };
  
  gameState.resources.wood += refund.wood;
  gameState.resources.stone += refund.stone;
  gameState.resources.clay += refund.clay;
  gameState.resources.iron += refund.iron;
  gameState.resources.bricks += refund.bricks;
  
  // Remove smelter storage if it's a smelter
  if (tile.type === "smelter" && gameState.smelters) {
    const smelterKey = `${row}_${col}`;
    delete gameState.smelters[smelterKey];
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

// Render grid
function renderGrid() {
  const gridContainer = document.getElementById('grid-container');
  if (!gridContainer) return;
  
  gridContainer.innerHTML = '';
  gridContainer.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      const tile = gameState.map[row][col];
      
      if (tile.type !== "empty") {
        cell.classList.add(`cell-${tile.type}`);
        cell.setAttribute('data-level', tile.level);
    } else {
        cell.classList.add('cell-empty');
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
  
  // Edit mode: move buildings
  if (editMode) {
    if (tileBeingMoved) {
      // Placing the building at new location
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
    // Select tile for info panel
    selectedTile = { row, col };
    renderGrid();
    updateTileInfo();
  } else if (selectedBuildingType && tile.type !== "empty") {
    // Clear selection and show tile info
    selectedBuildingType = null;
    updateBuildingSelection();
    selectedTile = { row, col };
    renderGrid();
    updateTileInfo();
  } else if (!selectedBuildingType && tile.type === "empty") {
    // Clear tile selection if clicking empty with no building selected
    selectedTile = null;
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
  
  // Preserve the control buttons section
  const controlsSection = infoPanel.querySelector('.tile-info-controls');
  
  if (!selectedTile) {
    infoPanel.innerHTML = '<p>Select a building to place or click on a placed building to view details.</p>';
    // Restore control buttons
    if (controlsSection) {
      infoPanel.appendChild(controlsSection);
    }
    return;
  }
  
  const tile = gameState.map[selectedTile.row][selectedTile.col];
  
  if (tile.type === "empty") {
    infoPanel.innerHTML = '<p>Empty tile. Select a building type to place here.</p>';
    // Restore control buttons
    if (controlsSection) {
      infoPanel.appendChild(controlsSection);
    }
    return;
  }
  
  const building = buildingTypes[tile.type];
  const production = getBuildingProduction(tile.type, tile.level);
  const upgradeCost = getBuildingCost(tile.type, tile.level + 1);
  const canUpgrade = building.maxLevel === null || tile.level < building.maxLevel;
  const canAffordUpgrade = gameState.resources.wood >= (upgradeCost.wood || 0) && 
                          gameState.resources.stone >= (upgradeCost.stone || 0) &&
                          gameState.resources.clay >= (upgradeCost.clay || 0) &&
                          gameState.resources.iron >= (upgradeCost.iron || 0) &&
                          gameState.resources.bricks >= (upgradeCost.bricks || 0);
  
  let html = `<h3>${building.displayName} (Level ${tile.level})</h3>`;
  html += `<p><strong>Production per second:</strong></p>`;
  if (production.wood > 0) html += `<p>Wood: ${production.wood.toFixed(2)}</p>`;
  if (production.stone > 0) html += `<p>Stone: ${production.stone.toFixed(2)}</p>`;
  if (production.clay > 0) html += `<p>Clay: ${production.clay.toFixed(2)}</p>`;
  if (production.iron > 0) html += `<p>Iron: ${production.iron.toFixed(2)}</p>`;
  if (production.bricks > 0) html += `<p>Clay Bricks: ${production.bricks.toFixed(2)}</p>`;
  if (production.population > 0) html += `<p>Population: ${production.population.toFixed(2)}</p>`;
  if (production.capacity > 0) html += `<p>Capacity: ${production.capacity}</p>`;
  
  // Special handling for smelter
  if (tile.type === "smelter") {
    // Ensure smelters object exists
    if (!gameState.smelters) {
      gameState.smelters = {};
    }
    const smelterKey = `${selectedTile.row}_${selectedTile.col}`;
    const smelterData = gameState.smelters[smelterKey] || {};
    // Migrate old format if needed
    if (!smelterData.queue) {
      smelterData.queue = [];
      if (smelterData.mineralType && smelterData.amount > 0) {
        for (let i = 0; i < smelterData.amount; i++) {
          smelterData.queue.push({ type: smelterData.mineralType });
        }
      }
    }
    // Ensure all fields exist with defaults (for old saves)
    const smelter = {
      queue: smelterData.queue || [],
      smeltingStartTime: smelterData.smeltingStartTime || null,
      readyOutput: smelterData.readyOutput || { bricks: 0, ironBars: 0 }
    };
    if (!smelter.readyOutput.bricks) smelter.readyOutput.bricks = 0;
    if (!smelter.readyOutput.ironBars) smelter.readyOutput.ironBars = 0;
    const building = buildingTypes.smelter;
    const maxStorage = 10;
    
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
    const canLoadClay = smelter.queue.length < maxStorage && gameState.resources.clay >= building.smeltClayAmount && gameState.resources.wood >= building.smeltWoodAmount;
    const canLoadIron = smelter.queue.length < maxStorage && gameState.resources.iron >= building.smeltIronAmount && gameState.resources.wood >= building.smeltWoodAmount;
    
    html += `<hr style="margin: 15px 0; border-color: rgba(255,255,255,0.2);">`;
    html += `<p style="padding: 8px; background: rgba(139, 69, 19, 0.2); border-left: 3px solid #8B4513; border-radius: 3px; margin: 10px 0;">`;
    html += `<strong style="color: #8B4513;">🔥 Fuel:</strong> `;
    html += `<span style="color: #8B4513; font-weight: bold;">${building.smeltWoodAmount} <img src="images/wood-log.png" alt="Wood" style="width: 25px; height: 25px; vertical-align: middle;"> wood per batch</span>`;
    html += `</p>`;
    
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
      const totalTimeSeconds = Math.ceil(smeltTime / 1000);
      const elapsedSeconds = Math.floor((Date.now() - smelter.smeltingStartTime) / 1000);
      const inputIcon = currentBatch.type === 'clay' ? 'images/clay.png' : 'images/iron.png';
      const outputIcon = currentBatch.type === 'clay' ? 'images/claybricks.png' : 'images/ironBar.webp';
      const inputAlt = currentBatch.type === 'clay' ? 'Clay' : 'Iron';
      const outputAlt = currentBatch.type === 'clay' ? 'Bricks' : 'Iron Bars';
      html += `<p><strong>Smelting:</strong> <img src="${inputIcon}" alt="${inputAlt}" style="width: 40px; height: 40px; vertical-align: middle; margin: 0 5px;"> → <img src="${outputIcon}" alt="${outputAlt}" style="width: 40px; height: 40px; vertical-align: middle; margin: 0 5px;"> ${smeltingProgress.toFixed(0)}% (${smeltingTimeLeft}s remaining / ${totalTimeSeconds}s total)</p>`;
      html += `<div style="background: rgba(255,255,255,0.2); border-radius: 4px; height: 25px; margin: 5px 0; position: relative; overflow: hidden;">`;
      html += `<div style="background: ${smelter.mineralType === 'clay' ? '#8B4513' : '#708090'}; height: 100%; width: ${smeltingProgress}%; border-radius: 4px; transition: width 0.3s;"></div>`;
      html += `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-size: 12px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${smeltingTimeLeft}s / ${totalTimeSeconds}s</div>`;
      html += `</div>`;
    } else if (smelter.amount > 0 && smelter.smeltingStartTime === null) {
      // Has resources but not smelting (shouldn't happen, but handle it)
      html += `<p style="color: #FF6B6B;">Ready to start smelting ${smelter.mineralType}...</p>`;
    }
    
    // Ready output
    if (totalReady > 0) {
      html += `<p><strong>Ready to Harvest:</strong></p>`;
      if (smelter.readyOutput.bricks > 0) {
        html += `<p>Bricks: ${smelter.readyOutput.bricks.toFixed(0)}</p>`;
      }
      if (smelter.readyOutput.ironBars > 0) {
        html += `<p>Iron Bars: ${smelter.readyOutput.ironBars.toFixed(0)}</p>`;
      }
    }
    
    // Harvest button
    html += `<button id="harvest-smelter-btn" style="margin: 10px 0; width: 100%; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 5px;" ${totalReady <= 0 ? 'disabled' : ''}>`;
    html += `Harvest `;
    if (smelter.readyOutput.bricks > 0 && smelter.readyOutput.ironBars > 0) {
      html += `${smelter.readyOutput.bricks} <img src="images/claybricks.png" alt="Bricks" style="width: 30px; height: 30px; vertical-align: middle;">`;
      html += `${smelter.readyOutput.ironBars} <img src="images/ironBar.webp" alt="Iron Bars" style="width: 30px; height: 30px; vertical-align: middle;">`;
    } else if (smelter.readyOutput.bricks > 0) {
      html += `${smelter.readyOutput.bricks} <img src="images/claybricks.png" alt="Bricks" style="width: 30px; height: 30px; vertical-align: middle;">`;
    } else if (smelter.readyOutput.ironBars > 0) {
      html += `${smelter.readyOutput.ironBars} <img src="images/ironBar.webp" alt="Iron Bars" style="width: 30px; height: 30px; vertical-align: middle;">`;
    } else {
      html += `(Nothing Ready)`;
    }
    html += `</button>`;
  }
  
  if (canUpgrade) {
    html += `<p><strong>Upgrade Cost:</strong></p>`;
    let costStr = [];
    if (upgradeCost.wood > 0) costStr.push(`${upgradeCost.wood} Wood`);
    if (upgradeCost.stone > 0) costStr.push(`${upgradeCost.stone} Stone`);
    if (upgradeCost.clay > 0) costStr.push(`${upgradeCost.clay} Clay`);
    if (upgradeCost.iron > 0) costStr.push(`${upgradeCost.iron} Iron`);
    if (upgradeCost.bricks > 0) costStr.push(`${upgradeCost.bricks} Bricks`);
    html += `<p>${costStr.join(' | ')}</p>`;
    html += `<button id="upgrade-btn" ${!canAffordUpgrade ? 'disabled' : ''}><img src="images/upgrade.png" alt="Upgrade" style="width: 30px; height: 30px; vertical-align: middle; margin-right: 5px;"> Upgrade</button>`;
    } else {
    html += `<p>Max level reached</p>`;
  }
  
  html += `<button id="remove-btn"><img src="images/sell.png" alt="Sell" style="width: 30px; height: 30px; vertical-align: middle; margin-right: 5px;">50% refund</button>`;
  
  infoPanel.innerHTML = html;
  
  // Restore control buttons if they exist
  if (controlsSection) {
    infoPanel.appendChild(controlsSection);
  }
  
  // Add event listeners for batch icons (clickable to remove)
  const batchIcons = document.querySelectorAll('.batch-icon');
  batchIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (selectedTile) {
        const smelterKey = `${selectedTile.row}_${selectedTile.col}`;
        const smelter = gameState.smelters[smelterKey];
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
              gameState.resources.wood += building.smeltWoodAmount;
            } else if (batchToRemove.type === 'iron') {
              gameState.resources.iron += building.smeltIronAmount;
              gameState.resources.wood += building.smeltWoodAmount;
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
    removeBtn.addEventListener('click', () => {
      if (confirm('Remove this building? You will receive 50% refund.')) {
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
  
  const tile = gameState.map[row][col];
  
  if (tile.type === "empty") {
    tooltip.style.display = 'none';
    return;
  }
  
  const building = buildingTypes[tile.type];
  
  if (!building) {
    tooltip.style.display = 'none';
    return;
  }
  
  const production = getBuildingProduction(tile.type, tile.level);
  
  let html = `<strong>${building.displayName}</strong><br>`;
  html += `Level: ${tile.level}<br>`;
  if (production.wood > 0) html += `Wood/sec: ${production.wood.toFixed(2)}<br>`;
  if (production.stone > 0) html += `Stone/sec: ${production.stone.toFixed(2)}<br>`;
  if (production.clay > 0) html += `Clay/sec: ${production.clay.toFixed(2)}<br>`;
  if (production.iron > 0) html += `Iron/sec: ${production.iron.toFixed(2)}<br>`;
  if (production.population > 0) html += `Population/sec: ${production.population.toFixed(2)}<br>`;
  if (production.capacity > 0) html += `Capacity: ${production.capacity}<br>`;
  
  // Special indicator for smelter - wood fuel requirement
  if (tile.type === "smelter" && building.smeltWoodAmount) {
    html += `<br><span style="color: #8B4513; font-weight: bold;">🔥 ${building.smeltWoodAmount} <img src="images/wood-log.png" alt="Wood" style="width: 20px; height: 20px; vertical-align: middle;"> wood per batch</span><br>`;
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
  
  // Update resources
  const woodEl = document.getElementById('wood');
  const stoneEl = document.getElementById('stone');
  const clayEl = document.getElementById('clay');
  const ironEl = document.getElementById('iron');
  const goldEl = document.getElementById('gold');
  const bricksEl = document.getElementById('bricks');
  const ironBarsEl = document.getElementById('ironBars');
  const populationEl = document.getElementById('population');
  const capacityEl = document.getElementById('housingCapacity');
  
  if (woodEl) woodEl.textContent = Math.floor(gameState.resources.wood);
  if (stoneEl) stoneEl.textContent = Math.floor(gameState.resources.stone);
  if (clayEl) clayEl.textContent = Math.floor(gameState.resources.clay);
  if (ironEl) ironEl.textContent = Math.floor(gameState.resources.iron);
  if (goldEl) goldEl.textContent = Math.floor(gameState.resources.gold);
  if (bricksEl) bricksEl.textContent = Math.floor(gameState.resources.bricks);
  if (ironBarsEl) ironBarsEl.textContent = Math.floor(gameState.resources.ironBars);
  if (populationEl) populationEl.textContent = Math.floor(gameState.population.current);
  if (capacityEl) capacityEl.textContent = Math.floor(gameState.population.capacity);
  
  // Update build menu buttons
  updateBuildMenu();
}

// Update build menu
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
    
    // Apply category-based colors
    const colors = getCategoryColors(building.category, key);
    btn.style.background = colors.gradient;
    btn.style.borderColor = colors.border;
    
    const cost = getBuildingCost(key, 1);
    const canAfford = gameState.resources.wood >= (cost.wood || 0) && 
                     gameState.resources.stone >= (cost.stone || 0) &&
                     gameState.resources.clay >= (cost.clay || 0) &&
                     gameState.resources.iron >= (cost.iron || 0) &&
                     gameState.resources.bricks >= (cost.bricks || 0);
    
    btn.disabled = !building.unlocked || !canAfford;
    
    if (!building.unlocked && building.unlockCondition) {
      const condition = building.unlockCondition;
      let tooltipText = `Unlock: `;
      switch (condition.type) {
        case "population":
          tooltipText += `${condition.threshold} population`;
          break;
        case "wps":
          tooltipText += `${condition.threshold} wood/sec`;
          break;
        case "stone":
          tooltipText += `${condition.threshold} stone`;
          break;
        case "buildingCount":
          tooltipText += `${condition.threshold} ${condition.buildingType}s`;
          break;
      }
      btn.title = tooltipText;
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
  
  if (confirm(`Are you sure you want to delete the save in slot ${slot}? This cannot be undone.`)) {
    localStorage.removeItem(slotKey);
    updateSaveSlots();
    showMessage(`Save slot ${slot} deleted.`);
  }
}

// Load game from specific slot
function loadGameSlot(slot) {
  const slotKey = `cityBuilderSave_slot${slot}`;
  const saved = localStorage.getItem(slotKey);
  if (!saved) {
    showMessage("No save found in this slot.");
    return;
  }
  
  if (confirm('Load this save? Current progress will be lost.')) {
    try {
      const loaded = JSON.parse(saved);
      gameState = loaded;
      
      // Ensure all required fields exist
      if (!gameState.character) gameState.character = null;
      if (!gameState.resources.ironBars) gameState.resources.ironBars = 0;
      
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
        
        // Check if this is old format (has clay/iron fields)
        if (smelter.hasOwnProperty('clay') || smelter.hasOwnProperty('iron')) {
          // Convert old format to new queue format
          const newSmelter = {
            queue: [], // Convert old storage to queue
            smeltingStartTime: smelter.smeltingStartTime || null,
            readyOutput: {
              bricks: smelter.bricks || 0,
              ironBars: smelter.ironBars || 0
            }
          };
          // If there was stored material, add it to queue
          if (smelter.smeltingType && smelter.amount > 0) {
            for (let i = 0; i < smelter.amount; i++) {
              newSmelter.queue.push({ type: smelter.smeltingType });
            }
          }
          gameState.smelters[key] = newSmelter;
        } else {
          // Ensure new format fields exist (migrate to queue if needed)
          if (!smelter.hasOwnProperty('queue')) {
            smelter.queue = [];
            if (smelter.mineralType && smelter.amount > 0) {
              for (let i = 0; i < smelter.amount; i++) {
                smelter.queue.push({ type: smelter.mineralType });
              }
            }
          }
          if (!smelter.hasOwnProperty('smeltingStartTime')) smelter.smeltingStartTime = null;
          if (!smelter.hasOwnProperty('readyOutput')) smelter.readyOutput = { bricks: 0, ironBars: 0 };
          if (!smelter.readyOutput.bricks) smelter.readyOutput.bricks = 0;
          if (!smelter.readyOutput.ironBars) smelter.readyOutput.ironBars = 0;
        }
      }
      
      if (!gameState.map || gameState.map.length === 0) {
        initializeGrid();
      }
      
      // Migrate old "house" to "tepee" and "brickKiln" to "smelter"
      if (gameState.map && gameState.map.length > 0) {
        for (let row = 0; row < gameState.map.length; row++) {
          for (let col = 0; col < gameState.map[row].length; col++) {
            if (gameState.map[row][col].type === "house") {
              gameState.map[row][col].type = "tepee";
            }
            if (gameState.map[row][col].type === "brickKiln") {
              gameState.map[row][col].type = "smelter";
            }
          }
        }
      }
      
      // Ensure quests field exists (for old saves)
      if (!gameState.quests) {
        gameState.quests = [];
      }
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
}

// Load game (checks last used slot first, then old default save)
function loadGame() {
  // First try to load from last used slot
  const lastSlot = getLastSaveSlot();
  const slotKey = `cityBuilderSave_slot${lastSlot}`;
  let saved = localStorage.getItem(slotKey);
  let loadedFromOldSave = false;
  
  // If no save in last slot, try old default save for backward compatibility
  if (!saved) {
    saved = localStorage.getItem('cityBuilderSave');
    loadedFromOldSave = !!saved;
  }
  
  if (saved) {
    try {
      const loaded = JSON.parse(saved);
      gameState = loaded;
      
      // If loaded from old default save, migrate to slot 1 and set as last slot
      if (loadedFromOldSave) {
        setLastSaveSlot(1);
        const slot1Key = `cityBuilderSave_slot1`;
        localStorage.setItem(slot1Key, saved);
        localStorage.removeItem('cityBuilderSave');
      }
      
      // Ensure character field exists (for old saves)
      if (!gameState.character) {
        gameState.character = null;
      }
      // Ensure ironBars field exists (for old saves)
      if (!gameState.resources.ironBars) {
        gameState.resources.ironBars = 0;
      }
      
      // Migrate old "kilns" to "smelters"
      if (gameState.kilns && !gameState.smelters) {
        gameState.smelters = gameState.kilns;
        delete gameState.kilns;
      }
      // Ensure smelters field exists (for old saves) and migrate old smelter data
      if (!gameState.smelters) {
        gameState.smelters = {};
      }
      // Migrate old smelter data to new format
      for (const key in gameState.smelters) {
        const smelter = gameState.smelters[key];
        if (!smelter) continue;
        
        // Check if this is old format (has clay/iron fields)
        if (smelter.hasOwnProperty('clay') || smelter.hasOwnProperty('iron')) {
          // Convert old format to new queue format
          const newSmelter = {
            queue: [], // Convert old storage to queue
            smeltingStartTime: smelter.smeltingStartTime || null,
            readyOutput: {
              bricks: smelter.bricks || 0,
              ironBars: smelter.ironBars || 0
            }
          };
          // If there was stored material, add it to queue
          if (smelter.smeltingType && smelter.amount > 0) {
            for (let i = 0; i < smelter.amount; i++) {
              newSmelter.queue.push({ type: smelter.smeltingType });
            }
          }
          gameState.smelters[key] = newSmelter;
        } else {
          // Ensure new format fields exist (migrate to queue if needed)
          if (!smelter.hasOwnProperty('queue')) {
            smelter.queue = [];
            if (smelter.mineralType && smelter.amount > 0) {
              for (let i = 0; i < smelter.amount; i++) {
                smelter.queue.push({ type: smelter.mineralType });
              }
            }
          }
          if (!smelter.hasOwnProperty('smeltingStartTime')) smelter.smeltingStartTime = null;
          if (!smelter.hasOwnProperty('readyOutput')) smelter.readyOutput = { bricks: 0, ironBars: 0 };
          if (!smelter.readyOutput.bricks) smelter.readyOutput.bricks = 0;
          if (!smelter.readyOutput.ironBars) smelter.readyOutput.ironBars = 0;
        }
      }
      
      // Ensure map is initialized
      if (!gameState.map || gameState.map.length === 0) {
        initializeGrid();
      }
      
      // Migrate old "house" buildings to "tepee" and "brickKiln" to "smelter"
      if (gameState.map && gameState.map.length > 0) {
        for (let row = 0; row < gameState.map.length; row++) {
          for (let col = 0; col < gameState.map[row].length; col++) {
            if (gameState.map[row][col].type === "house") {
              gameState.map[row][col].type = "tepee";
            }
            if (gameState.map[row][col].type === "brickKiln") {
              gameState.map[row][col].type = "smelter";
            }
          }
        }
      }
      
      // Ensure upgrades field exists (for old saves)
      if (!gameState.upgrades) {
        gameState.upgrades = {
          woodProduction: false,
          stoneProduction: false,
          clayProduction: false,
          housingCapacity: false,
          smeltingSpeed: false
        };
      }
      
      // Ensure quests field exists (for old saves)
      if (!gameState.quests) {
        gameState.quests = [];
      }
      initializeQuests();
      
      // Recompute derived values
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
  if (confirm('Are you sure you want to reset your game? This cannot be undone.')) {
    localStorage.removeItem('cityBuilderSave');
    // Cycle to next save slot for new game
    cycleToNextSaveSlot();
    gameState = {
      resources: { wood: 50, stone: 0, clay: 0, iron: 0, gold: 0, bricks: 0, ironBars: 0 },
      rates: { wps: 1, sps: 0, cps: 0, ips: 0, gps: 0, bps: 0 }, // Base 1 wps
      smelters: {},
      population: { current: 0, capacity: 0 },
      map: [],
      character: null, // Reset character selection
      timestamp: Date.now(),
      upgrades: {
        woodProduction: false,
        stoneProduction: false,
        clayProduction: false,
        housingCapacity: false,
        smeltingSpeed: false
      },
      quests: []
    };
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
      
      if (confirm('Import this save? Current progress will be lost.')) {
        gameState = loaded;
        
        // Ensure all required fields exist
        if (!gameState.character) gameState.character = null;
        if (!gameState.resources.ironBars) gameState.resources.ironBars = 0;
        
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
          
          // Check if this is old format (has clay/iron fields)
          if (smelter.hasOwnProperty('clay') || smelter.hasOwnProperty('iron')) {
            // Convert old format to new queue format
            const newSmelter = {
              queue: [], // Convert old storage to queue
              smeltingStartTime: smelter.smeltingStartTime || null,
              readyOutput: {
                bricks: smelter.bricks || 0,
                ironBars: smelter.ironBars || 0
              }
            };
            // If there was stored material, add it to queue
            if (smelter.smeltingType && smelter.amount > 0) {
              for (let i = 0; i < smelter.amount; i++) {
                newSmelter.queue.push({ type: smelter.smeltingType });
              }
            }
            gameState.smelters[key] = newSmelter;
          } else {
            // Ensure new format fields exist (migrate to queue if needed)
            if (!smelter.hasOwnProperty('queue')) {
              smelter.queue = [];
              if (smelter.mineralType && smelter.amount > 0) {
                for (let i = 0; i < smelter.amount; i++) {
                  smelter.queue.push({ type: smelter.mineralType });
                }
              }
            }
            if (!smelter.hasOwnProperty('smeltingStartTime')) smelter.smeltingStartTime = null;
            if (!smelter.hasOwnProperty('readyOutput')) smelter.readyOutput = { bricks: 0, ironBars: 0 };
            if (!smelter.readyOutput.bricks) smelter.readyOutput.bricks = 0;
            if (!smelter.readyOutput.ironBars) smelter.readyOutput.ironBars = 0;
          }
        }
        
        if (!gameState.map || gameState.map.length === 0) {
          initializeGrid();
        }
        
        // Migrate old "house" to "tepee" and "brickKiln" to "smelter"
        if (gameState.map && gameState.map.length > 0) {
          for (let row = 0; row < gameState.map.length; row++) {
            for (let col = 0; col < gameState.map[row].length; col++) {
              if (gameState.map[row][col].type === "house") {
                gameState.map[row][col].type = "tepee";
              }
              if (gameState.map[row][col].type === "brickKiln") {
                gameState.map[row][col].type = "smelter";
              }
            }
          }
        }
        
        // Ensure quests field exists and is an array
        if (!gameState.quests || !Array.isArray(gameState.quests)) {
          gameState.quests = [];
        }
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
        updateSaveSlots();
        startGameLoop();
        showMessage("Save file imported!");
      }
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
  const canAfford = gameState.resources.wood >= (cost.wood || 0) && 
                   gameState.resources.stone >= (cost.stone || 0) &&
                   gameState.resources.clay >= (cost.clay || 0) &&
                   gameState.resources.iron >= (cost.iron || 0) &&
                   gameState.resources.bricks >= (cost.bricks || 0);
  
  let html = `<strong style="color: ${categoryColor};">${building.displayName}</strong><br>`;
  
  // Cost
  html += `<p style="margin: 3px 0;"><strong style="color: ${categoryColor};">Cost:</strong> `;
  html += `<span style="color: ${canAfford ? '#4CAF50' : '#f44336'}">`;
  if (cost.wood > 0) {
    html += `<span style="font-size: 20px; font-weight: bold;">${cost.wood}</span> <img src="images/wood-log.png" alt="Wood" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  if (cost.bricks > 0) {
    if (cost.wood > 0) html += ` `;
    html += `<span style="font-size: 20px; font-weight: bold;">${cost.bricks}</span> <img src="images/claybricks.png" alt="Bricks" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  if (cost.stone > 0) {
    if (cost.wood > 0 || cost.bricks > 0) html += ` `;
    html += `<span style="font-size: 20px; font-weight: bold;">${cost.stone}</span> <img src="images/rock.png" alt="Stone" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  if (cost.clay > 0) {
    if (cost.wood > 0 || cost.bricks > 0 || cost.stone > 0) html += ` `;
    html += `<span style="font-size: 20px; font-weight: bold;">${cost.clay}</span> <img src="images/clay.png" alt="Clay" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  if (cost.iron > 0) {
    if (cost.wood > 0 || cost.bricks > 0 || cost.stone > 0 || cost.clay > 0) html += ` `;
    html += `<span style="font-size: 20px; font-weight: bold;">${cost.iron}</span> <img src="images/iron.png" alt="Iron" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  html += `</span></p>`;
  
  // Production/Benefits
  html += `<p style="margin: 3px 0;"><strong style="color: ${categoryColor};">Produces:</strong> `;
  let hasProduction = false;
  if (production.wood > 0) {
    html += `<span style="color: #8B4513; font-size: 18px; font-weight: bold;">${production.wood.toFixed(2)} <img src="images/wood-log.png" alt="Wood" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
    hasProduction = true;
  }
  if (production.stone > 0) {
    if (hasProduction) html += `, `;
    html += `<span style="color: #9E9E9E; font-size: 18px; font-weight: bold;">${production.stone.toFixed(2)} <img src="images/rock.png" alt="Stone" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
    hasProduction = true;
  }
  if (production.clay > 0) {
    if (hasProduction) html += `, `;
    html += `<span style="color: #8D6E63; font-size: 18px; font-weight: bold;">${production.clay.toFixed(2)} <img src="images/clay.png" alt="Clay" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
    hasProduction = true;
  }
  if (production.iron > 0) {
    if (hasProduction) html += `, `;
    html += `<span style="color: #708090; font-size: 18px; font-weight: bold;">${production.iron.toFixed(2)} <img src="images/iron.png" alt="Iron" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
    hasProduction = true;
  }
  if (production.population > 0) {
    if (hasProduction) html += `, `;
    html += `<span style="color: #4CAF50; font-size: 18px; font-weight: bold;">${production.population.toFixed(2)} <img src="images/population.png" alt="Population" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
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
  
  // Special info for smelter - wood fuel requirement
  if (buildingType === "smelter" && building.smeltWoodAmount) {
    html += `<p style="margin: 3px 0; padding: 5px; background: rgba(139, 69, 19, 0.2); border-left: 3px solid #8B4513; border-radius: 3px;">`;
    html += `<strong style="color: #8B4513;">🔥 Fuel Required:</strong> `;
    html += `<span style="color: #8B4513; font-size: 18px; font-weight: bold;">${building.smeltWoodAmount} <img src="images/wood-log.png" alt="Wood" style="width: 30px; height: 30px; vertical-align: middle;"> per batch</span>`;
    html += `<br><span style="font-size: 12px; color: #aaa;">Converts ${building.smeltClayAmount} clay + ${building.smeltWoodAmount} wood → ${building.smeltBrickOutput} brick (${building.smeltClayTime/1000}s) | ${building.smeltIronAmount} iron + ${building.smeltWoodAmount} wood → ${building.smeltIronBarOutput} iron bar (${building.smeltIronTime/1000}s)</span>`;
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
  
  // Unlock condition if locked
  if (!building.unlocked && building.unlockCondition) {
    const condition = building.unlockCondition;
    html += `<p style="margin: 3px 0; color: #ff9800;"><strong>To Unlock:</strong> `;
    switch (condition.type) {
      case "population":
        html += `${condition.threshold} pop`;
        break;
      case "wps":
        html += `${condition.threshold} W/s`;
        break;
      case "stone":
        html += `${condition.threshold} stone`;
        break;
      case "buildingCount":
        html += `${condition.threshold} ${condition.buildingType}s`;
        break;
    }
    html += `</p>`;
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

function startGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
  }
  
  gameLoopInterval = setInterval(() => {
    try {
      // Only run if game is initialized
      if (!gameState || !gameState.map || gameState.map.length === 0) {
        return;
      }
      
      // Update resources based on production
      if (gameState.rates) {
        gameState.resources.wood += gameState.rates.wps || 0;
        gameState.resources.stone += gameState.rates.sps || 0;
        gameState.resources.clay += gameState.rates.cps || 0;
        gameState.resources.iron += gameState.rates.ips || 0;
        gameState.resources.gold += gameState.rates.gps || 0;
        gameState.resources.bricks += gameState.rates.bps || 0;
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
    ironBars: 'Iron Bars'
  };
  
  const resourceIcons = {
    wood: 'images/wood-log.png',
    stone: 'images/rock.png',
    clay: 'images/clay.png',
    iron: 'images/iron.png',
    gold: 'images/gold.png',
    bricks: 'images/claybricks.png',
    ironBars: 'images/ironBar.webp'
  };
  
  const resourceColors = {
    wood: '#8B4513',
    stone: '#9E9E9E',
    clay: '#8D6E63',
    iron: '#708090',
    gold: '#FFD700',
    bricks: '#D32F2F',
    ironBars: '#708090'
  };
  
  const rateKeys = {
    wood: 'wps',
    stone: 'sps',
    clay: 'cps',
    iron: 'ips',
    gold: 'gps',
    bricks: 'bps',
    ironBars: null // Iron bars don't have a production rate
  };
  
  const resourceName = resourceNames[resourceType] || resourceType;
  const resourceIcon = resourceIcons[resourceType] || '';
  const resourceColor = resourceColors[resourceType] || '#ffffff';
  const rateKey = rateKeys[resourceType];
  const rate = rateKey ? (gameState.rates[rateKey] || 0) : 0;
  
  let html = `<strong>${resourceName}</strong><br>`;
  if (rateKey && rate > 0) {
    html += `<span style="font-size: 18px; color: ${resourceColor};">${rate.toFixed(2)}</span> <img src="${resourceIcon}" alt="${resourceName}" style="width: 35px; height: 35px; vertical-align: middle;">/sec`;
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

// Select character
function selectCharacter(characterType) {
  if (!characterTypes[characterType]) {
    console.error('Invalid character type:', characterType);
    return;
  }
  
  gameState.character = characterType;
  
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
    initializeQuests();
    initializeGrid();
    // Cycle to next save slot for new game
    cycleToNextSaveSlot();
  }
  
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
  
  // Start the game loop
  startGameLoop();
  
  // Save the character selection
  saveGame();
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
  const shopModal = document.getElementById('shop-modal');
  if (shopModal) {
    if (shopModal.style.display === 'none' || shopModal.style.display === '') {
      shopModal.style.display = 'flex';
      updateShopUI();
    } else {
      shopModal.style.display = 'none';
    }
  }
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
            updateQuestIndicator();
            // Show completion popup
            showQuestCompletionPopup(questDef);
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

// Toggle quests window
function toggleQuests() {
  const questsModal = document.getElementById('quests-modal');
  if (questsModal) {
    if (questsModal.style.display === 'none' || questsModal.style.display === '') {
      questsModal.style.display = 'flex';
      // Reset to incomplete tab when opening
      currentQuestTab = 'incomplete';
      const tabs = document.querySelectorAll('.quest-tab');
      tabs.forEach(t => {
        if (t.dataset.tab === 'incomplete') {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      renderQuests();
    } else {
      questsModal.style.display = 'none';
    }
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
  Object.keys(questDef.reward).forEach(resource => {
    const amount = questDef.reward[resource];
    const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);
    rewardParts.push(`${amount} ${resourceName}`);
  });
  rewardEl.textContent = rewardParts.join(', ');
  
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
function updateBrickTrade(amount) {
  const slider = document.getElementById('brick-slider');
  if (!slider) return;
  
  // Always update slider max based on available bricks (rounded down to nearest 5)
  const maxBricks = Math.floor(gameState.resources.bricks);
  const maxSliderValue = Math.max(5, Math.floor(maxBricks / 5) * 5); // Round down to nearest 5
  slider.max = maxSliderValue;
  
  // Ensure current value doesn't exceed max
  const brickAmount = Math.min(parseInt(amount || slider.value), maxSliderValue);
  slider.value = brickAmount;
  
  // Update slider filled portion (green trail)
  const progress = maxSliderValue > 0 ? (brickAmount / maxSliderValue) * 100 : 0;
  const fillBar = document.getElementById('brick-slider-fill');
  if (fillBar) {
    fillBar.style.width = `${progress}%`;
  }
  
  const goldReward = Math.floor(brickAmount / 5);
  
  document.getElementById('brick-amount').textContent = brickAmount;
  document.getElementById('brick-cost-display').textContent = brickAmount;
  document.getElementById('gold-reward-display').textContent = goldReward;
  
  // Update button state
  const sellBricksBtn = document.getElementById('sell-bricks-btn');
  if (sellBricksBtn) {
    const canAfford = gameState.resources.bricks >= brickAmount;
    sellBricksBtn.disabled = !canAfford;
    if (!canAfford) {
      sellBricksBtn.title = `Not enough bricks (need ${brickAmount}, have ${Math.floor(gameState.resources.bricks)})`;
    } else {
      sellBricksBtn.title = `Sell ${brickAmount} Clay Bricks for ${goldReward} Gold Coin${goldReward !== 1 ? 's' : ''}`;
    }
  }
}

// Update shop UI to reflect current resources
function updateShopUI() {
  const slider = document.getElementById('brick-slider');
  if (slider) {
    // Update the slider max first, then update the trade display
    updateBrickTrade(slider.value);
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

// Sell bricks for gold
function sellBricksForGold() {
  const slider = document.getElementById('brick-slider');
  const brickAmount = slider ? parseInt(slider.value) : 5;
  const goldReward = Math.floor(brickAmount / 5);
  
  if (gameState.resources.bricks >= brickAmount) {
    gameState.resources.bricks -= brickAmount;
    gameState.resources.gold += goldReward;
    updateUI();
    updateShopUI();
    showMessage(`Sold ${brickAmount} Clay Bricks for ${goldReward} Gold Coin${goldReward !== 1 ? 's' : ''}!`);
  } else {
    showMessage(`Not enough bricks! Need ${brickAmount} bricks, have ${Math.floor(gameState.resources.bricks)}.`);
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

// Close shop when clicking outside
window.addEventListener('click', (event) => {
  const shopModal = document.getElementById('shop-modal');
  const shopContent = document.querySelector('.shop-content');
  if (shopModal && event.target === shopModal) {
    shopModal.style.display = 'none';
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
});

// Track Shift key state for multiple building placement
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift' && !shiftHeld) {
    shiftHeld = true;
  }
  
  // Close menus and exit edit mode when Escape is pressed
  if (e.key === 'Escape') {
    const shopModal = document.getElementById('shop-modal');
    const questsModal = document.getElementById('quests-modal');
    const loadModal = document.getElementById('load-modal');
    
    // Close shop if it's open
    if (shopModal && shopModal.style.display === 'flex') {
      shopModal.style.display = 'none';
    }
    
    // Close quests if it's open
    if (questsModal && questsModal.style.display === 'flex') {
      questsModal.style.display = 'none';
    }
    
    // Close load menu if it's open
    if (loadModal && loadModal.style.display === 'flex') {
      loadModal.style.display = 'none';
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
window.addEventListener('DOMContentLoaded', () => {
  try {
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
      updateSaveSlots();
      startGameLoop();
    }
  } catch (e) {
    console.error('Error initializing game:', e);
    alert('Error loading game. Please refresh the page.');
  }
});
