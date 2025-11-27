// Grid size
const GRID_SIZE = 15;

// Game state
let gameState = {
  resources: {
    wood: 50,
    stone: 0
  },
  rates: {
    wps: 1, // Base 1 wps
    sps: 0 // Stone per second
  },
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
  if (!building || level < 1) return { wood: 0, stone: 0, population: 0, capacity: 0 };
  
  const factor = Math.pow(building.productionGrowthFactor, level - 1);
  let production = {
    wood: building.baseProduction.wood * factor,
    stone: building.baseProduction.stone * factor,
    population: building.baseProduction.population * factor,
    capacity: building.baseProduction.capacity * factor
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
  if (!building) return { wood: 0, stone: 0 };
  
  let cost;
  if (level === 1) {
    cost = { ...building.baseCost };
  } else {
    const factor = Math.pow(building.costGrowthFactor, level - 1);
    cost = {
      wood: Math.floor(building.baseCost.wood * factor),
      stone: Math.floor(building.baseCost.stone * factor)
    };
  }
  
  // Apply character bonuses
  if (gameState.character) {
    const character = characterTypes[gameState.character];
    
    // Farmer: 20% discount on farm buildings (level 1 placement only)
    if (gameState.character === 'farmer' && level === 1 && building.category === 'farming') {
      cost.wood = Math.floor(cost.wood * character.buildDiscount);
      cost.stone = Math.floor(cost.stone * character.buildDiscount);
    }
    
    // Miner: 20% discount on stone buildings (all levels)
    if (gameState.character === 'miner' && building.category === 'stone') {
      cost.wood = Math.floor(cost.wood * character.upgradeDiscount);
      cost.stone = Math.floor(cost.stone * character.upgradeDiscount);
    }
  }
  
  return cost;
}

// Calculate total cost spent on a building (for refund calculation)
function getTotalBuildingCost(buildingType, level) {
  let total = { wood: 0, stone: 0 };
  for (let l = 1; l <= level; l++) {
    const cost = getBuildingCost(buildingType, l);
    total.wood += cost.wood;
    total.stone += cost.stone;
  }
  return total;
}

// Calculate production from all buildings
function calculateProduction() {
  let totalWood = 1; // Base 1 wps always
  let totalStone = 0;
  let totalPopulation = 0;
  let totalCapacity = 0;
  
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const tile = gameState.map[row][col];
      if (tile.type !== "empty") {
        const production = getBuildingProduction(tile.type, tile.level);
        totalWood += production.wood;
        totalStone += production.stone;
        totalPopulation += production.population;
        totalCapacity += production.capacity;
      }
    }
  }
  
  gameState.rates.wps = totalWood;
  gameState.rates.sps = totalStone;
  gameState.population.capacity = totalCapacity;
  
  // Update population (capped by capacity)
  gameState.population.current = Math.min(
    gameState.population.current + totalPopulation,
    gameState.population.capacity
  );
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
  if (gameState.resources.wood < cost.wood || gameState.resources.stone < cost.stone) {
  return false;
}

  // Deduct resources
  gameState.resources.wood -= cost.wood;
  gameState.resources.stone -= cost.stone;
  
  // Place building
  tile.type = buildingType;
  tile.level = 1;
  
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
  
  if (gameState.resources.wood < cost.wood || gameState.resources.stone < cost.stone) {
    return false;
  }
  
  // Deduct resources
  gameState.resources.wood -= cost.wood;
  gameState.resources.stone -= cost.stone;
  
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
    wood: Math.floor(totalCost.wood * 0.5),
    stone: Math.floor(totalCost.stone * 0.5)
  };
  
  gameState.resources.wood += refund.wood;
  gameState.resources.stone += refund.stone;
  
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
  const canAffordUpgrade = gameState.resources.wood >= upgradeCost.wood && 
                          gameState.resources.stone >= upgradeCost.stone;
  
  let html = `<h3>${building.displayName} (Level ${tile.level})</h3>`;
  html += `<p><strong>Production per second:</strong></p>`;
  if (production.wood > 0) html += `<p>Wood: ${production.wood.toFixed(2)}</p>`;
  if (production.stone > 0) html += `<p>Stone: ${production.stone.toFixed(2)}</p>`;
  if (production.population > 0) html += `<p>Population: ${production.population.toFixed(2)}</p>`;
  if (production.capacity > 0) html += `<p>Capacity: ${production.capacity}</p>`;
  
  if (canUpgrade) {
    html += `<p><strong>Upgrade Cost:</strong></p>`;
    html += `<p>Wood: ${upgradeCost.wood} | Stone: ${upgradeCost.stone}</p>`;
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
        showMessage(`${building.displayName} upgraded to Level ${newLevel}!`, 'success');
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
  const wpsEl = document.getElementById('wps');
  const stoneEl = document.getElementById('stone');
  const spsEl = document.getElementById('sps');
  const populationEl = document.getElementById('population');
  const capacityEl = document.getElementById('housingCapacity');
  
  if (woodEl) woodEl.textContent = Math.floor(gameState.resources.wood);
  if (wpsEl) wpsEl.textContent = gameState.rates.wps.toFixed(2);
  if (stoneEl) stoneEl.textContent = Math.floor(gameState.resources.stone);
  if (spsEl) spsEl.textContent = gameState.rates.sps.toFixed(2);
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
      resources: { wood: 50, stone: 0 },
      rates: { wps: 1, sps: 0 }, // Base 1 wps
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
  // Only re-render grid if needed (unlocks might have changed button states)
  // Grid visual updates happen on user interaction
}, 1000);

// Show resource icon tooltip
function showResourceTooltip(event, text) {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  
  tooltip.innerHTML = `<strong>${text}</strong>`;
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
  const resourceIcons = document.querySelectorAll('[data-tooltip]');
  resourceIcons.forEach(icon => {
    const tooltipText = icon.getAttribute('data-tooltip');
    icon.addEventListener('mouseenter', (e) => showResourceTooltip(e, tooltipText));
    icon.addEventListener('mouseleave', hideResourceTooltip);
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
