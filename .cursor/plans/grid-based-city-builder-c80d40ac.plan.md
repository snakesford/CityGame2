<!-- c80d40ac-ab71-4429-b3d1-1138d1d5d584 45422286-214d-45d6-925d-d4d8a31556b7 -->
# Military System Implementation

## Overview

Add a military/war component to the city builder game with 4 military buildings, unit training, weapons production, and raid mechanics (both defensive and offensive).

## Implementation Details

### 1. Add Military Resources to Game State

- **File**: `script.js`
- Add to `gameState`:
  - `military: { infantry: 0, weapons: 0, defenseStrength: 0, attackStrength: 0 }`
- These track trained units, weapons, and calculated military power

### 2. Create Military Building Definitions

- **File**: `script.js`
- Add 4 buildings to `buildingTypes`:
  - **Barracks** (`barracks`):
    - Category: "military"
    - Cost: Wood + Minerals (e.g., 80 wood, 40 minerals)
    - Unlock: Population threshold (e.g., 20 population)
    - Production: Trains infantry units (e.g., 0.1 infantry/sec per level)
    - Max level: null (infinite)
  - **Training Grounds** (`trainingGrounds`):
    - Category: "military"
    - Cost: Wood + Minerals (e.g., 100 wood, 60 minerals)
    - Unlock: Requires 1 Barracks
    - Production: Training speed multiplier (e.g., +50% training speed)
    - Special: Multiplies infantry training rate from Barracks
  - **Watch Tower** (`watchTower`):
    - Category: "military"
    - Cost: Wood + Minerals (e.g., 60 wood, 30 minerals)
    - Unlock: Requires 1 Barracks
    - Production: Defense strength (e.g., +5 defense per level)
    - Special: Provides early warning and defense bonus
  - **Weapons Factory** (`weaponsFactory`):
    - Category: "military"
    - Cost: Wood + Minerals (e.g., 120 wood, 80 minerals)
    - Unlock: Requires 1 Training Grounds
    - Production: Weapons (e.g., 0.2 weapons/sec per level)
    - Special: Produces weapons that enhance unit effectiveness

### 3. Add Military Section to Build Menu

- **File**: `index.html`
- Add new building category section:
  ```html
  <div class="building-category">
    <h4>Military</h4>
    <button class="building-btn" data-building-type="barracks" disabled>Barracks</button>
    <button class="building-btn" data-building-type="watchTower" disabled>Watch Tower</button>
    <button class="building-btn" data-building-type="trainingGrounds" disabled>Training Grounds</button>
    <button class="building-btn" data-building-type="weaponsFactory" disabled>Weapons Factory</button>
  </div>
  ```


### 4. Update Production Calculation

- **File**: `script.js`
- Modify `calculateProduction()` to:
  - Sum infantry training from all Barracks
  - Apply Training Grounds multiplier to infantry production
  - Sum weapons production from Weapons Factories
  - Calculate defense strength from Watch Towers
  - Update `gameState.military` resources each tick

### 5. Add Military Resource Display to HUD

- **File**: `index.html`
- Add military resources to top HUD:
  - Infantry count with icon
  - Weapons count with icon
  - Defense strength indicator
- **File**: `script.js`
- Update `updateUI()` to display military resources

### 6. Implement Unit Training System

- **File**: `script.js`
- Create `trainInfantry()` function:
  - Barracks produce infantry over time
  - Training Grounds multiply production rate
  - Infantry can be used for defense/offense
- Infantry accumulates in `gameState.military.infantry`

### 7. Implement Weapons System

- **File**: `script.js`
- Weapons Factory produces weapons over time
- Weapons enhance unit effectiveness:
  - Each weapon increases attack/defense power
  - Formula: `attackStrength = infantry + (weapons * 0.5)`
  - Formula: `defenseStrength = watchTowers + (infantry * 0.3) + (weapons * 0.2)`

### 8. Add Raid/Defense Mechanics

- **File**: `script.js`
- Create `checkRandomRaid()` function:
  - Random chance of raid event (e.g., every 60-120 seconds)
  - If defense strength is sufficient, defend successfully
  - If defense fails, lose some resources
  - Show notification messages
- Create `initiateRaid()` function:
  - Player can initiate offensive raid
  - Requires minimum attack strength
  - Success chance based on attack strength
  - Rewards: Gain random resources (wood, minerals)
  - Cooldown period between raids

### 9. Add Raid UI Controls

- **File**: `index.html`
- Add raid button to HUD or controls section:
  - "Initiate Raid" button
  - Shows attack strength requirement
  - Disabled if insufficient strength or on cooldown
- **File**: `script.js`
- Add event listener for raid button
- Show raid results in notification

### 10. Update Building Info Panel for Military Buildings

- **File**: `script.js`
- Update `updateTileInfo()` to show:
  - For Barracks: Infantry training rate, total trained
  - For Training Grounds: Training speed multiplier
  - For Watch Tower: Defense contribution
  - For Weapons Factory: Weapons production rate

### 11. Add Military Building Visuals

- **File**: `style.css`
- Add CSS classes for military buildings:
  - `.cell-barracks`, `.cell-trainingGrounds`, `.cell-watchTower`, `.cell-weaponsFactory`
- Use appropriate colors (e.g., red/dark colors for military theme)

### 12. Update Save/Load System

- **File**: `script.js`
- Update `saveGame()` and `loadGame()` to include `gameState.military`
- Ensure military resources persist across saves

## Implementation Order

1. Add military resources to gameState
2. Create 4 military building definitions
3. Add Military section to build menu HTML
4. Update production calculation for military resources
5. Add military display to HUD
6. Implement unit training and weapons production
7. Add raid mechanics (defensive and offensive)
8. Add raid UI controls
9. Update building info panel for military buildings
10. Add CSS styling for military buildings
11. Update save/load system

## Notes

- Barracks unlocks at population threshold (e.g., 20)
- Other military buildings unlock based on building requirements
- Military resources accumulate passively over time
- Raids provide risk/reward gameplay element
- Balance: Military should be useful but not overpowered compared to economy

### To-dos

- [ ] Refactor data structures: create 15x15 grid array, gameState object, and buildingTypes dictionary with cost/production formulas
- [ ] Restructure HTML: top HUD, build menu panel, 15x15 grid container, tile info panel, save/reset controls
- [ ] Implement renderGrid() function to generate and display grid cells with proper CSS classes based on tile types
- [ ] Implement building type selection from build menu with visual highlighting of selected button
- [ ] Implement click-to-place: check costs, validate placement, deduct resources, update grid and UI
- [ ] Implement per-second tick: calculate production from all buildings, update resources and population with capacity clamping
- [ ] Implement tile info panel, upgrade logic with cost scaling, and remove/demolish with optional refund
- [ ] Implement unlock conditions for advanced buildings and display locked state in build menu
- [ ] Implement save/load system for full grid state with auto-save and load on page start
- [ ] Add hover tooltips, cell highlighting, selected building highlighting, and smooth visual feedback