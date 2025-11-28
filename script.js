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
    bricks: 0
  },
  rates: {
    wps: 1, // Base 1 wps
    sps: 0, // Stone per second
    cps: 0, // Clay per second
    ips: 0, // Iron per second
    gps: 0, // Gold per second
    bps: 0 // Bricks per second
  },
  kilns: {}, // Store kiln data: {row_col: {clay: amount, bricks: amount, smeltingStartTime: timestamp, smeltingAmount: amount}}
  population: {
    current: 0,
    capacity: 0
  },
  map: [],
  character: null, // "miner" | "farmer" | null
  timestamp: Date.now()
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

// Building type definitions
const buildingTypes = {
  house: {
    displayName: "House",
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
  brickKiln: {
    displayName: "Brick Kiln",
    category: "production",
    baseCost: { wood: 60, stone: 20 },
    costGrowthFactor: 1.5,
    baseProduction: { wood: 0, stone: 0, clay: 0, iron: 0, bricks: 0, population: 0, capacity: 0 },
    productionGrowthFactor: 1.4,
    maxLevel: null,
    unlocked: true,
    smeltTime: 10000, // 10 seconds in milliseconds
    smeltClayAmount: 10, // Amount of clay per smelt batch
    smeltBrickOutput: 5, // Bricks produced per batch
    maxClayStorage: 100
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
    unlockCondition: { type: "buildingCount", buildingType: "brickKiln", threshold: 1 }
  }
};

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
        // Handle kiln processing
        if (tile.type === "brickKiln") {
          processKiln(row, col, tile.level);
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

// Process kiln conversion (clay -> bricks)
function processKiln(row, col, level) {
  // Ensure kilns object exists
  if (!gameState.kilns) {
    gameState.kilns = {};
  }
  
  const kilnKey = `${row}_${col}`;
  if (!gameState.kilns[kilnKey]) {
    gameState.kilns[kilnKey] = { clay: 0, bricks: 0, smeltingStartTime: null, smeltingAmount: 0 };
  }
  
  const kiln = gameState.kilns[kilnKey];
  const building = buildingTypes.brickKiln;
  const smeltTime = building.smeltTime;
  const smeltClayAmount = building.smeltClayAmount;
  const smeltBrickOutput = building.smeltBrickOutput;
  
  const now = Date.now();
  
  // Check if a smelting batch is complete
  if (kiln.smeltingStartTime !== null) {
    const elapsedTime = now - kiln.smeltingStartTime;
    if (elapsedTime >= smeltTime) {
      // Smelting complete! Add bricks and reset smelting state
      kiln.bricks += smeltBrickOutput;
      kiln.smeltingStartTime = null;
      kiln.smeltingAmount = 0;
    }
  }
  
  // Start a new smelting batch if we have enough clay and aren't already smelting
  if (kiln.smeltingStartTime === null && kiln.clay >= smeltClayAmount) {
    kiln.clay -= smeltClayAmount;
    kiln.smeltingStartTime = now;
    kiln.smeltingAmount = smeltClayAmount;
  }
}

// Add clay to kiln
function addClayToKiln(row, col, amount) {
  // Ensure kilns object exists
  if (!gameState.kilns) {
    gameState.kilns = {};
  }
  
  const kilnKey = `${row}_${col}`;
  if (!gameState.kilns[kilnKey]) {
    gameState.kilns[kilnKey] = { clay: 0, bricks: 0, smeltingStartTime: null, smeltingAmount: 0 };
  }
  
  const kiln = gameState.kilns[kilnKey];
  const tile = gameState.map[row][col];
  if (tile.type !== "brickKiln") return false;
  
  const building = buildingTypes.brickKiln;
  const factor = Math.pow(building.productionGrowthFactor, tile.level - 1);
  const maxStorage = building.maxClayStorage * factor;
  
  // Calculate available space (current clay + clay being smelted)
  const totalClayUsed = kiln.clay + (kiln.smeltingAmount || 0);
  const availableSpace = maxStorage - totalClayUsed;
  const amountToAdd = Math.min(amount, availableSpace, gameState.resources.clay);
  
  if (amountToAdd > 0) {
    kiln.clay += amountToAdd;
    gameState.resources.clay -= amountToAdd;
    return true;
  }
  return false;
}

// Harvest bricks from kiln
function harvestBricksFromKiln(row, col) {
  // Ensure kilns object exists
  if (!gameState.kilns) {
    gameState.kilns = {};
  }
  
  const kilnKey = `${row}_${col}`;
  if (!gameState.kilns || !gameState.kilns[kilnKey]) return false;
  
  const kiln = gameState.kilns[kilnKey];
  if (kiln.bricks > 0) {
    const bricksToHarvest = kiln.bricks;
    gameState.resources.bricks += bricksToHarvest;
    kiln.bricks = 0;
    return bricksToHarvest;
  }
  return false;
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
  
  // Initialize kiln storage if it's a brick kiln
  if (buildingType === "brickKiln") {
    // Ensure kilns object exists
    if (!gameState.kilns) {
      gameState.kilns = {};
    }
    const kilnKey = `${row}_${col}`;
    gameState.kilns[kilnKey] = { clay: 0, bricks: 0, smeltingStartTime: null, smeltingAmount: 0 };
  }
  
  calculateProduction();
  checkUnlocks();
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
  
  // Remove kiln storage if it's a brick kiln
  if (tile.type === "brickKiln" && gameState.kilns) {
    const kilnKey = `${row}_${col}`;
    delete gameState.kilns[kilnKey];
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
      
      // Add click handler
      cell.addEventListener('click', () => handleCellClick(row, col));
      
      // Add hover tooltip
      cell.addEventListener('mouseenter', (e) => showCellTooltip(e, row, col));
      cell.addEventListener('mouseleave', hideCellTooltip);
      
      gridContainer.appendChild(cell);
    }
  }
}

// Handle cell click
function handleCellClick(row, col) {
  const tile = gameState.map[row][col];
  
  if (selectedBuildingType && tile.type === "empty") {
    // Try to place building
    if (!placeBuilding(row, col, selectedBuildingType)) {
      showMessage("Not enough resources.");
    } else {
      // Clear building selection after placing
      selectedBuildingType = null;
      updateBuildingSelection();
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
  if (selectedBuildingType === buildingType) {
    // Deselect if clicking same building
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
    infoPanel.innerHTML = '<p>Empty tile. Select a building type to place here.</p>';
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
  
  // Special handling for brick kiln
  if (tile.type === "brickKiln") {
    // Ensure kilns object exists
    if (!gameState.kilns) {
      gameState.kilns = {};
    }
    const kilnKey = `${selectedTile.row}_${selectedTile.col}`;
    const kiln = gameState.kilns[kilnKey] || { clay: 0, bricks: 0, smeltingStartTime: null, smeltingAmount: 0 };
    const building = buildingTypes.brickKiln;
    const factor = Math.pow(building.productionGrowthFactor, tile.level - 1);
    const maxStorage = building.maxClayStorage * factor;
    
    // Calculate smelting progress
    let smeltingProgress = 0;
    let smeltingTimeLeft = 0;
    if (kiln.smeltingStartTime !== null) {
      const now = Date.now();
      const elapsed = now - kiln.smeltingStartTime;
      const smeltTime = building.smeltTime;
      smeltingProgress = Math.min(100, (elapsed / smeltTime) * 100);
      smeltingTimeLeft = Math.max(0, Math.ceil((smeltTime - elapsed) / 1000));
    }
    
    html += `<hr style="margin: 15px 0; border-color: rgba(255,255,255,0.2);">`;
    html += `<p><strong>Kiln Storage:</strong></p>`;
    const totalClayUsed = kiln.clay + (kiln.smeltingAmount || 0);
    html += `<p>Clay: ${kiln.clay.toFixed(1)} / ${maxStorage.toFixed(0)}`;
    if (kiln.smeltingAmount > 0) {
      html += ` (${kiln.smeltingAmount} smelting)`;
    }
    html += `</p>`;
    html += `<p>Ready Bricks: ${kiln.bricks.toFixed(1)}</p>`;
    
    // Show smelting progress
    if (kiln.smeltingStartTime !== null) {
      html += `<p><strong>Smelting:</strong> ${smeltingProgress.toFixed(0)}% (${smeltingTimeLeft}s remaining)</p>`;
      html += `<div style="background: rgba(255,255,255,0.2); border-radius: 4px; height: 20px; margin: 5px 0;">`;
      html += `<div style="background: #FF9800; height: 100%; width: ${smeltingProgress}%; border-radius: 4px; transition: width 0.3s;"></div>`;
      html += `</div>`;
    }
    
    html += `<button id="add-clay-btn" style="margin: 5px 0;" ${gameState.resources.clay <= 0 ? 'disabled' : ''}>Add 10 Clay</button>`;
    html += `<button id="harvest-bricks-btn" style="margin: 5px 0;" ${kiln.bricks <= 0 ? 'disabled' : ''}>Harvest ${kiln.bricks > 0 ? Math.floor(kiln.bricks) : 0} Bricks</button>`;
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
  
  // Add kiln management event listeners
  const addClayBtn = document.getElementById('add-clay-btn');
  if (addClayBtn) {
    addClayBtn.addEventListener('click', () => {
      if (addClayToKiln(selectedTile.row, selectedTile.col, 10)) {
        updateTileInfo();
        updateUI();
        showMessage("Added clay to kiln.");
      } else {
        showMessage("Cannot add clay: insufficient clay or kiln is full.");
      }
    });
  }
  
  const harvestBricksBtn = document.getElementById('harvest-bricks-btn');
  if (harvestBricksBtn) {
    harvestBricksBtn.addEventListener('click', () => {
      // Ensure kilns object exists
      if (!gameState.kilns) {
        gameState.kilns = {};
      }
      const kilnKey = `${selectedTile.row}_${selectedTile.col}`;
      const kiln = gameState.kilns[kilnKey] || { bricks: 0 };
      const bricksToHarvest = kiln.bricks;
      const harvested = harvestBricksFromKiln(selectedTile.row, selectedTile.col);
      if (harvested) {
        updateTileInfo();
        updateUI();
        showMessage(`Harvested ${bricksToHarvest.toFixed(1)} bricks!`);
      } else {
        showMessage("No bricks to harvest.");
      }
    });
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
  const production = getBuildingProduction(tile.type, tile.level);
  
  let html = `<strong>${building.displayName}</strong><br>`;
  html += `Level: ${tile.level}<br>`;
  if (production.wood > 0) html += `Wood/sec: ${production.wood.toFixed(2)}<br>`;
  if (production.stone > 0) html += `Stone/sec: ${production.stone.toFixed(2)}<br>`;
  if (production.clay > 0) html += `Clay/sec: ${production.clay.toFixed(2)}<br>`;
  if (production.iron > 0) html += `Iron/sec: ${production.iron.toFixed(2)}<br>`;
  if (production.population > 0) html += `Population/sec: ${production.population.toFixed(2)}<br>`;
  if (production.capacity > 0) html += `Capacity: ${production.capacity}<br>`;
  
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  
  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
  tooltip.style.top = (rect.bottom + 10) + 'px';
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
  const populationEl = document.getElementById('population');
  const capacityEl = document.getElementById('housingCapacity');
  
  if (woodEl) woodEl.textContent = Math.floor(gameState.resources.wood);
  if (stoneEl) stoneEl.textContent = Math.floor(gameState.resources.stone);
  if (clayEl) clayEl.textContent = Math.floor(gameState.resources.clay);
  if (ironEl) ironEl.textContent = Math.floor(gameState.resources.iron);
  if (goldEl) goldEl.textContent = Math.floor(gameState.resources.gold);
  if (bricksEl) bricksEl.textContent = Math.floor(gameState.resources.bricks);
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
    
    const cost = getBuildingCost(key, 1);
    const canAfford = gameState.resources.wood >= cost.wood && 
                     gameState.resources.stone >= cost.stone;
    
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

// Save game
function saveGame() {
  gameState.timestamp = Date.now();
  localStorage.setItem('cityBuilderSave', JSON.stringify(gameState));
  updateSaveStatus();
}

// Load game
function loadGame() {
  const saved = localStorage.getItem('cityBuilderSave');
  if (saved) {
    try {
      const loaded = JSON.parse(saved);
      gameState = loaded;
      
      // Ensure character field exists (for old saves)
      if (!gameState.character) {
        gameState.character = null;
      }
      
      // Ensure kilns field exists (for old saves) and migrate old kiln data
      if (!gameState.kilns) {
        gameState.kilns = {};
      }
      // Migrate old kiln data to new format
      for (const key in gameState.kilns) {
        const kiln = gameState.kilns[key];
        if (kiln && !kiln.hasOwnProperty('smeltingStartTime')) {
          kiln.smeltingStartTime = null;
          kiln.smeltingAmount = 0;
        }
      }
      
      // Ensure map is initialized
      if (!gameState.map || gameState.map.length === 0) {
        initializeGrid();
      }
      
      // Recompute derived values
      calculateProduction();
      checkUnlocks();
      
      return true;
    } catch (e) {
      console.error('Error loading game:', e);
    }
  }
  return false;
}

// Reset game
function resetGame() {
  if (confirm('Are you sure you want to reset your game? This cannot be undone.')) {
    localStorage.removeItem('cityBuilderSave');
    gameState = {
      resources: { wood: 50, stone: 0, clay: 0, iron: 0, gold: 0, bricks: 0 },
      rates: { wps: 1, sps: 0, cps: 0, ips: 0, gps: 0, bps: 0 }, // Base 1 wps
      kilns: {},
      population: { current: 0, capacity: 0 },
      map: [],
      character: null, // Reset character selection
      timestamp: Date.now()
    };
    initializeGrid();
    calculateProduction();
    checkUnlocks();
    renderGrid();
    updateUI();
    updateSaveStatus();
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

// Show building button tooltip
function showBuildingTooltip(event, buildingType) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  
  const building = buildingTypes[buildingType];
  if (!building) return;
  
  // Building buttons always show level 1 (new placement)
  const level = 1;
  
  const cost = getBuildingCost(buildingType, level);
  const production = getBuildingProduction(buildingType, level);
  const canAfford = gameState.resources.wood >= cost.wood && 
                   gameState.resources.stone >= cost.stone;
  
  let html = `<strong>${building.displayName}</strong><br>`;
  
  // Cost
  html += `<p style="margin: 3px 0;"><strong>Cost:</strong> `;
  html += `<span style="color: ${canAfford ? '#4CAF50' : '#f44336'}">`;
  if (cost.wood > 0) {
    html += `<span style="font-size: 20px; font-weight: bold;">${cost.wood}</span> <img src="images/wood-log.png" alt="Wood" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  if (cost.stone > 0) {
    if (cost.wood > 0) html += ` `;
    html += `<span style="font-size: 20px; font-weight: bold;">${cost.stone}</span> <img src="images/rock.png" alt="Stone" style="width: 50px; height: 50px; vertical-align: middle;">`;
  }
  html += `</span></p>`;
  
  // Production/Benefits
  html += `<p style="margin: 3px 0;"><strong>Produces:</strong> `;
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
    html += `<span style="color: #424242; font-size: 18px; font-weight: bold;">${production.iron.toFixed(2)} <img src="images/iron.png" alt="Iron" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
    hasProduction = true;
  }
  if (production.population > 0) {
    if (hasProduction) html += `, `;
    html += `<span style="color: #4CAF50; font-size: 18px; font-weight: bold;">${production.population.toFixed(2)} <img src="images/population.png" alt="Population" style="width: 35px; height: 35px; vertical-align: middle;">/s</span>`;
    hasProduction = true;
  }
  if (production.capacity > 0) {
    if (hasProduction) html += `, `;
    html += `<span style="color: #FF9800; font-size: 18px; font-weight: bold;">+${production.capacity} <img src="images/house.png" alt="Capacity" style="width: 35px; height:35px; vertical-align: middle;"></span>`;
    hasProduction = true;
  }
  if (!hasProduction) {
    html += `<span style="color: #888;">None</span>`;
  }
  html += `</p>`;
  
  // Character requirement
  if (building.requiredCharacter) {
    const charName = characterTypes[building.requiredCharacter]?.name || building.requiredCharacter;
    html += `<p style="margin: 3px 0; color: #FFD700;"><strong>Character:</strong> ${charName} only</p>`;
  }
  
  // Character bonus info
  if (gameState.character) {
    const character = characterTypes[gameState.character];
    if (gameState.character === 'farmer' && building.category === 'farming') {
      html += `<p style="margin: 3px 0; color: #4CAF50;"><strong>Farmer Bonus:</strong> +50% production, +30% population growth</p>`;
    }
    if (gameState.character === 'miner' && building.category === 'stone') {
      html += `<p style="margin: 3px 0; color: #4CAF50;"><strong>Miner Bonus:</strong> +50% production, 20% discount</p>`;
    }
    if (gameState.character === 'farmer' && level === 1 && building.category === 'farming') {
      html += `<p style="margin: 3px 0; color: #4CAF50;"><strong>Farmer Bonus:</strong> 20% discount on farm buildings</p>`;
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
  
  const rect = event.target.getBoundingClientRect();
  // Position tooltip to the right of the button (since buttons are on the left)
  let leftPos = rect.right + 10;
  // If tooltip would go off screen, position it to the left instead
  if (leftPos + 200 > window.innerWidth) {
    leftPos = rect.left - 220;
  }
  tooltip.style.left = leftPos + 'px';
  tooltip.style.top = (rect.top + rect.height / 2 - tooltip.offsetHeight / 2) + 'px';
  
  // Ensure tooltip stays on screen
  if (parseInt(tooltip.style.top) < 10) {
    tooltip.style.top = '10px';
  }
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
      btn.addEventListener('click', () => selectBuildingType(key));
      btn.addEventListener('mouseenter', (e) => showBuildingTooltip(e, key));
      btn.addEventListener('mouseleave', hideBuildingTooltip);
    }
  }
}

// Main game loop
let lastAutoSave = Date.now();
setInterval(() => {
  // Update resources based on production
  gameState.resources.wood += gameState.rates.wps;
  gameState.resources.stone += gameState.rates.sps;
  gameState.resources.clay += gameState.rates.cps;
  gameState.resources.iron += gameState.rates.ips;
  gameState.resources.gold += gameState.rates.gps;
  gameState.resources.bricks += gameState.rates.bps;
  
  // Update population
  calculateProduction();
  checkUnlocks();
  
  // Auto-save every 20 seconds
  const now = Date.now();
  if (now - lastAutoSave >= 20000) {
    saveGame();
    lastAutoSave = now;
  }

  updateUI();
  
  // Update tile info panel if a kiln is selected (to show smelting progress)
  if (selectedTile) {
    const tile = gameState.map[selectedTile.row] && gameState.map[selectedTile.row][selectedTile.col];
    if (tile && tile.type === "brickKiln") {
      updateTileInfo();
    }
  }
  
  // Only re-render grid if needed (unlocks might have changed button states)
  // Grid visual updates happen on user interaction
}, 1000);

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
    bricks: 'Clay Bricks'
  };
  
  const resourceIcons = {
    wood: 'images/wood-log.png',
    stone: 'images/rock.png',
    clay: 'images/clay.png',
    iron: 'images/iron.png',
    gold: 'images/gold.png',
    bricks: 'images/claybricks.png'
  };
  
  const resourceColors = {
    wood: '#8B4513',
    stone: '#9E9E9E',
    clay: '#8D6E63',
    iron: '#708090',
    gold: '#FFD700',
    bricks: '#D32F2F'
  };
  
  const rateKeys = {
    wood: 'wps',
    stone: 'sps',
    clay: 'cps',
    iron: 'ips',
    gold: 'gps',
    bricks: 'bps'
  };
  
  const resourceName = resourceNames[resourceType] || resourceType;
  const resourceIcon = resourceIcons[resourceType] || '';
  const resourceColor = resourceColors[resourceType] || '#ffffff';
  const rateKey = rateKeys[resourceType];
  const rate = gameState.rates[rateKey] || 0;
  
  let html = `<strong>${resourceName}</strong><br>`;
  html += `<span style="font-size: 18px; color: ${resourceColor};">${rate.toFixed(2)}</span> <img src="${resourceIcon}" alt="${resourceName}" style="width: 35px; height: 35px; vertical-align: middle;">/sec`;
  
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  
  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
  tooltip.style.top = (rect.bottom + 10) + 'px';
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
    icon.addEventListener('mouseleave', hideResourceTooltip);
  });
  
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
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = (rect.bottom + 10) + 'px';
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
  if (!gameState.map || gameState.map.length === 0) {
    initializeGrid();
  }
  
  // Update UI to reflect character bonuses
  calculateProduction();
  checkUnlocks();
  renderGrid();
  updateUI();
  updateSaveStatus();
  initializeBuildMenu();
  updateBuildMenu();
  initializeResourceTooltips();
  
  // Save the character selection
  saveGame();
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  const loaded = loadGame();
  
  if (!loaded) {
    initializeGrid();
  }
  
  // Check if character is selected
  if (!gameState.character) {
    showCharacterSelection();
  } else {
    hideCharacterSelection();
    // Calculate production and unlocks on initialization
    calculateProduction();
    checkUnlocks();
    renderGrid();
updateUI();
updateSaveStatus();
    initializeBuildMenu();
    updateBuildMenu();
    initializeResourceTooltips();
  }
});
