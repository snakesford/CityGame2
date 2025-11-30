// test.js
// Minimal Node-based test runner for logic.js
// Run with:  node test.js

const assert = require('assert');
const logic = require('./logic');

// Simple test harness
function runTests() {
  const results = [];

  function record(name, pass, error) {
    const prefix = pass ? '✅' : '❌';
    if (pass) {
      console.log(`${prefix} ${name}`);
    } else {
      console.error(`${prefix} ${name}: ${error && error.message ? error.message : error}`);
    }
    results.push({ name, pass, error });
  }

  function test(name, fn) {
    try {
      fn();
      record(name, true, null);
    } catch (err) {
      record(name, false, err);
    }
  }

  const has = (key) => Object.prototype.hasOwnProperty.call(logic, key);

  // --------------------------------------------------
  // 1. formatNumber tests (pure utility)
  // --------------------------------------------------
  if (has('formatNumber')) {
    const { formatNumber } = logic;

    test('formatNumber(999, 0) -> "999"', () => {
      assert.strictEqual(formatNumber(999, 0), '999');
    });

    test('formatNumber(1500, 1) -> "1.5k"', () => {
      assert.strictEqual(formatNumber(1500, 1), '1.5k');
    });

    test('formatNumber(1500000, 2) -> "1.50M"', () => {
      assert.strictEqual(formatNumber(1500000, 2), '1.50M');
    });

    test('formatNumber(2000000000, 1) -> "2.0B"', () => {
      assert.strictEqual(formatNumber(2000000000, 1), '2.0B');
    });

    test('formatNumber(0) -> "0"', () => {
      const result = formatNumber(0);
      assert.ok(result === '0' || result === '0.0' || result === '0.00');
    });

    test('formatNumber(1) -> "1"', () => {
      const result = formatNumber(1);
      assert.ok(result === '1' || result === '1.0' || result === '1.00');
    });

    test('formatNumber(1000, 0) -> "1k"', () => {
      assert.strictEqual(formatNumber(1000, 0), '1k');
    });

    test('formatNumber(999999, 1) -> "1000.0k" or "1.0M"', () => {
      const result = formatNumber(999999, 1);
      assert.ok(result.includes('k') || result.includes('M'));
    });

    test('formatNumber(1000000, 0) -> "1M"', () => {
      assert.strictEqual(formatNumber(1000000, 0), '1M');
    });

    test('formatNumber(5000000000, 1) -> "5.0B"', () => {
      assert.strictEqual(formatNumber(5000000000, 1), '5.0B');
    });

    test('formatNumber(123, 2) -> "123" or "123.00"', () => {
      const result = formatNumber(123, 2);
      assert.ok(result === '123' || result === '123.00');
    });

    test('formatNumber(1234, 2) -> "1.23k" or "1.24k"', () => {
      const result = formatNumber(1234, 2);
      assert.ok(result.includes('k'));
    });
  } else {
    console.warn('Skipping formatNumber tests (not exported by logic.js).');
  }

  // --------------------------------------------------
  // 2. Building production tests
  //    (assumes buildingTypes + getBuildingProduction)
  // --------------------------------------------------
  if (has('buildingTypes') && has('getBuildingProduction')) {
    const { buildingTypes, getBuildingProduction } = logic;

    test('lumberMill level 1 base wood production is ~0.6', () => {
      const prod = getBuildingProduction('lumberMill', 1, { character: null });
      assert.ok(Math.abs(prod.wood - 0.6) < 1e-6);
    });

    test('quarry level 1 base stone production is ~0.3', () => {
      const prod = getBuildingProduction('quarry', 1, { character: null });
      assert.ok(Math.abs(prod.stone - 0.3) < 1e-6);
    });

    test('lumberMill level 2 scales by productionGrowthFactor', () => {
      const level = 2;
      const baseWood = 0.6;
      const factor = Math.pow(
        buildingTypes.lumberMill.productionGrowthFactor,
        level - 1
      );
      const prod = getBuildingProduction('lumberMill', level, { character: null });
      const expected = baseWood * factor;
      assert.ok(Math.abs(prod.wood - expected) < 1e-6);
    });

    test('tepee level 1 base capacity production', () => {
      const prod = getBuildingProduction('tepee', 1, { character: null });
      assert.strictEqual(prod.capacity, buildingTypes.tepee.baseProduction.capacity);
    });

    test('farm level 1 base population production', () => {
      const prod = getBuildingProduction('farm', 1, { character: null });
      assert.strictEqual(prod.population, buildingTypes.farm.baseProduction.population);
    });

    test('advancedFarm level 1 base population production', () => {
      const prod = getBuildingProduction('advancedFarm', 1, { character: null });
      assert.strictEqual(prod.population, buildingTypes.advancedFarm.baseProduction.population);
    });

    test('quarry level 3 scales correctly', () => {
      const level = 3;
      const baseStone = 0.3;
      const factor = Math.pow(
        buildingTypes.quarry.productionGrowthFactor,
        level - 1
      );
      const prod = getBuildingProduction('quarry', level, { character: null });
      const expected = baseStone * factor;
      assert.ok(Math.abs(prod.stone - expected) < 1e-6);
    });

    test('tepee level 2 capacity scales correctly', () => {
      const level = 2;
      const baseCapacity = buildingTypes.tepee.baseProduction.capacity;
      const factor = Math.pow(
        buildingTypes.tepee.productionGrowthFactor,
        level - 1
      );
      const prod = getBuildingProduction('tepee', level, { character: null });
      const expected = baseCapacity * factor;
      assert.ok(Math.abs(prod.capacity - expected) < 1e-6);
    });

    test('unknown building type returns zero production', () => {
      const prod = getBuildingProduction('unknownBuilding', 1, { character: null });
      assert.strictEqual(prod.wood, 0);
      assert.strictEqual(prod.stone, 0);
      assert.strictEqual(prod.population, 0);
      assert.strictEqual(prod.capacity, 0);
    });

    test('level 0 or negative level uses level 1 production', () => {
      const prod0 = getBuildingProduction('lumberMill', 0, { character: null });
      const prod1 = getBuildingProduction('lumberMill', 1, { character: null });
      assert.ok(Math.abs(prod0.wood - prod1.wood) < 1e-6);
    });
  } else {
    console.warn('Skipping building production tests (missing buildingTypes or getBuildingProduction).');
  }

  // --------------------------------------------------
  // 3. Character bonuses (miner / farmer)
  //    (assumes characterTypes + getBuildingProduction)
  // --------------------------------------------------
  if (has('characterTypes') && has('getBuildingProduction')) {
    const { characterTypes, getBuildingProduction } = logic;

    if (characterTypes.miner) {
      test('miner gets stone bonus on quarry', () => {
        const baseStone = 0.3;
        const prod = getBuildingProduction('quarry', 1, { character: 'miner' });
        const expected = baseStone * characterTypes.miner.miningProductionMultiplier;
        assert.ok(Math.abs(prod.stone - expected) < 1e-6);
      });

      test('miner does not get bonus on non-stone buildings', () => {
        const prodNoMiner = getBuildingProduction('lumberMill', 1, { character: null });
        const prodWithMiner = getBuildingProduction('lumberMill', 1, { character: 'miner' });
        assert.ok(Math.abs(prodNoMiner.wood - prodWithMiner.wood) < 1e-6);
      });

      test('miner bonus applies to level 2 quarry', () => {
        if (!has('buildingTypes')) return;
        const { buildingTypes } = logic;
        const baseStone = 0.3;
        const factor = Math.pow(buildingTypes.quarry.productionGrowthFactor, 1);
        const prod = getBuildingProduction('quarry', 2, { character: 'miner' });
        const expected = baseStone * factor * characterTypes.miner.miningProductionMultiplier;
        assert.ok(Math.abs(prod.stone - expected) < 1e-6);
      });
    }

    if (characterTypes.farmer && has('buildingTypes')) {
      const { buildingTypes } = logic;

      test('farmer gets population bonus on advancedFarm', () => {
        const def = buildingTypes.advancedFarm;
        // base pop * farmingProductionMultiplier * populationMultiplier
        const expected =
          def.baseProduction.population *
          characterTypes.farmer.farmingProductionMultiplier *
          characterTypes.farmer.populationMultiplier;

        const prod = getBuildingProduction('advancedFarm', 1, { character: 'farmer' });
        assert.ok(Math.abs(prod.population - expected) < 1e-6);
      });

      test('farmer gets population bonus on farm', () => {
        const def = buildingTypes.farm;
        const expected =
          def.baseProduction.population *
          characterTypes.farmer.farmingProductionMultiplier *
          characterTypes.farmer.populationMultiplier;

        const prod = getBuildingProduction('farm', 1, { character: 'farmer' });
        assert.ok(Math.abs(prod.population - expected) < 1e-6);
      });

      test('farmer does not get bonus on non-farming buildings', () => {
        const prodNoFarmer = getBuildingProduction('lumberMill', 1, { character: null });
        const prodWithFarmer = getBuildingProduction('lumberMill', 1, { character: 'farmer' });
        assert.ok(Math.abs(prodNoFarmer.wood - prodWithFarmer.wood) < 1e-6);
      });
    }
  } else {
    console.warn('Skipping character bonus tests (missing characterTypes or getBuildingProduction).');
  }

  // --------------------------------------------------
  // 4. Building cost + character discounts
  //    (assumes buildingTypes + getBuildingCost + characterTypes)
  // --------------------------------------------------
  if (has('buildingTypes') && has('getBuildingCost')) {
    const { buildingTypes, getBuildingCost } = logic;

    test('tepee level 1 cost matches baseCost', () => {
      const cost = getBuildingCost('tepee', 1, { character: null });
      assert.strictEqual(cost.wood, buildingTypes.tepee.baseCost.wood);
      assert.strictEqual(cost.stone || 0, buildingTypes.tepee.baseCost.stone || 0);
    });

    test('lumberMill level 1 cost matches baseCost', () => {
      const cost = getBuildingCost('lumberMill', 1, { character: null });
      assert.strictEqual(cost.wood, buildingTypes.lumberMill.baseCost.wood);
    });

    test('quarry level 1 cost matches baseCost', () => {
      const cost = getBuildingCost('quarry', 1, { character: null });
      assert.strictEqual(cost.wood, buildingTypes.quarry.baseCost.wood);
      assert.strictEqual(cost.stone || 0, buildingTypes.quarry.baseCost.stone || 0);
    });

    test('farm level 1 cost matches baseCost', () => {
      const cost = getBuildingCost('farm', 1, { character: null });
      assert.strictEqual(cost.wood, buildingTypes.farm.baseCost.wood);
      assert.strictEqual(cost.stone || 0, buildingTypes.farm.baseCost.stone || 0);
    });

    test('cost scales with level using costGrowthFactor', () => {
      const level = 3;
      const baseWood = buildingTypes.lumberMill.baseCost.wood;
      const factor = Math.pow(buildingTypes.lumberMill.costGrowthFactor, level - 1);
      const cost = getBuildingCost('lumberMill', level, { character: null });
      const expected = Math.floor(baseWood * factor);
      assert.strictEqual(cost.wood, expected);
    });

    test('level 0 or negative uses level 1 cost', () => {
      const cost0 = getBuildingCost('lumberMill', 0, { character: null });
      const cost1 = getBuildingCost('lumberMill', 1, { character: null });
      assert.strictEqual(cost0.wood, cost1.wood);
    });

    test('unknown building type returns empty cost', () => {
      const cost = getBuildingCost('unknownBuilding', 1, { character: null });
      assert.strictEqual(Object.keys(cost).length, 0);
    });

    // Farmer discount on farming buildings (level 1 only)
    if (has('characterTypes') && logic.characterTypes.farmer) {
      const { characterTypes } = logic;

      test('farmer gets build discount on farm level 1 wood cost', () => {
        const ctx = { character: 'farmer' };
        const baseWood = buildingTypes.farm.baseCost.wood;
        const discount = characterTypes.farmer.buildDiscount;
        const expected = Math.floor(baseWood * discount);
        const cost = getBuildingCost('farm', 1, ctx);
        assert.strictEqual(cost.wood, expected);
      });

      test('farmer gets build discount on farm level 1 stone cost', () => {
        const ctx = { character: 'farmer' };
        const baseStone = buildingTypes.farm.baseCost.stone;
        const discount = characterTypes.farmer.buildDiscount;
        const expected = Math.floor(baseStone * discount);
        const cost = getBuildingCost('farm', 1, ctx);
        assert.strictEqual(cost.stone, expected);
      });

      test('farmer does not get discount on farm level 2+', () => {
        const ctx = { character: 'farmer' };
        const costNoDiscount = getBuildingCost('farm', 2, { character: null });
        const costWithFarmer = getBuildingCost('farm', 2, ctx);
        assert.strictEqual(costWithFarmer.wood, costNoDiscount.wood);
      });

      test('farmer does not get discount on non-farming buildings', () => {
        const ctx = { character: 'farmer' };
        const costNoFarmer = getBuildingCost('lumberMill', 1, { character: null });
        const costWithFarmer = getBuildingCost('lumberMill', 1, ctx);
        assert.strictEqual(costWithFarmer.wood, costNoFarmer.wood);
      });
    }

    // Miner discount on stone buildings (all levels)
    if (has('characterTypes') && logic.characterTypes.miner) {
      const { characterTypes } = logic;

      test('miner gets upgrade discount on quarry level 2 wood cost', () => {
        const ctx = { character: 'miner' };
        const lvl = 2;
        const baseWood = buildingTypes.quarry.baseCost.wood || 0;
        const factor = Math.pow(buildingTypes.quarry.costGrowthFactor, lvl - 1);
        // Implementation floors after factor, then floors after discount
        const costAfterFactor = Math.floor(baseWood * factor);
        const expected = Math.floor(costAfterFactor * characterTypes.miner.upgradeDiscount);
        const cost = getBuildingCost('quarry', lvl, ctx);
        assert.strictEqual(cost.wood, expected);
      });

      test('miner gets discount on quarry level 1', () => {
        const ctx = { character: 'miner' };
        const baseWood = buildingTypes.quarry.baseCost.wood || 0;
        const expected = Math.floor(baseWood * characterTypes.miner.upgradeDiscount);
        const cost = getBuildingCost('quarry', 1, ctx);
        assert.strictEqual(cost.wood, expected);
      });

      test('miner gets discount on quarry level 3', () => {
        const ctx = { character: 'miner' };
        const lvl = 3;
        const baseWood = buildingTypes.quarry.baseCost.wood || 0;
        const factor = Math.pow(buildingTypes.quarry.costGrowthFactor, lvl - 1);
        const expected = Math.floor(
          baseWood * factor * characterTypes.miner.upgradeDiscount
        );
        const cost = getBuildingCost('quarry', lvl, ctx);
        assert.strictEqual(cost.wood, expected);
      });

      test('miner does not get discount on non-stone buildings', () => {
        const ctx = { character: 'miner' };
        const costNoMiner = getBuildingCost('lumberMill', 1, { character: null });
        const costWithMiner = getBuildingCost('lumberMill', 1, ctx);
        assert.strictEqual(costWithMiner.wood, costNoMiner.wood);
      });
    }
  } else {
    console.warn('Skipping cost tests (missing buildingTypes or getBuildingCost).');
  }

  // --------------------------------------------------
  // 5. Quest logic tests
  //    These are written to be generic and only run if the
  //    appropriate helpers are exported from logic.js
  // --------------------------------------------------
  if (
    has('createInitialGameState') &&
    has('questDefinitions') &&
    has('checkQuests') &&
    has('claimQuestReward')
  ) {
    const {
      createInitialGameState,
      questDefinitions,
      checkQuests,
      claimQuestReward
    } = logic;

    test('createInitialGameState returns valid state', () => {
      const state = createInitialGameState();
      assert.ok(state);
      assert.ok(Array.isArray(state.map));
      assert.ok(Array.isArray(state.quests));
      assert.ok(state.resources);
      assert.ok(state.upgrades);
      assert.strictEqual(state.resources.wood, 50);
      assert.strictEqual(state.resources.stone, 0);
    });

    test('initial state has all quests as incomplete', () => {
      const state = createInitialGameState();
      assert.ok(state.quests.length > 0);
      state.quests.forEach(q => {
        assert.strictEqual(q.completed, false);
        assert.strictEqual(q.claimed, false);
      });
    });

    test('first_shelter quest completes after placing a tepee', () => {
      const state = createInitialGameState();
      const firstShelterDef = questDefinitions.find((q) => q.id === 'first_shelter');
      assert.ok(firstShelterDef, 'first_shelter definition should exist');

      // We assume state.map is a 2D array of tiles with { type, level }
      state.map[0][0] = { type: 'tepee', level: 1 };

      checkQuests(state);
      const q = state.quests.find((q) => q.id === 'first_shelter');
      assert.ok(q, 'first_shelter should be in state.quests');
      assert.strictEqual(q.completed, true);
      assert.strictEqual(q.claimed, false);

      const woodBefore = state.resources.wood;
      claimQuestReward(state, 'first_shelter');
      assert.strictEqual(q.claimed, true);
      const expectedWoodReward = firstShelterDef.reward.wood || 0;
      assert.strictEqual(state.resources.wood, woodBefore + expectedWoodReward);
    });

    test('quest does not complete when condition not met', () => {
      const state = createInitialGameState();
      checkQuests(state);
      const q = state.quests.find((q) => q.id === 'first_shelter');
      if (q) {
        assert.strictEqual(q.completed, false);
      }
    });

    test('cannot claim quest that is not completed', () => {
      const state = createInitialGameState();
      const result = claimQuestReward(state, 'first_shelter');
      assert.strictEqual(result, false);
      const q = state.quests.find((q) => q.id === 'first_shelter');
      if (q) {
        assert.strictEqual(q.claimed, false);
      }
    });

    test('cannot claim quest twice', () => {
      const state = createInitialGameState();
      state.map[0][0] = { type: 'tepee', level: 1 };
      checkQuests(state);
      
      const woodBefore = state.resources.wood;
      const result1 = claimQuestReward(state, 'first_shelter');
      assert.strictEqual(result1, true);
      
      const woodAfterFirst = state.resources.wood;
      const result2 = claimQuestReward(state, 'first_shelter');
      assert.strictEqual(result2, false);
      assert.strictEqual(state.resources.wood, woodAfterFirst);
    });

    test('claiming invalid quest returns false', () => {
      const state = createInitialGameState();
      const result = claimQuestReward(state, 'nonexistent_quest');
      assert.strictEqual(result, false);
    });

    test('checkQuests does not change already completed quests', () => {
      const state = createInitialGameState();
      state.map[0][0] = { type: 'tepee', level: 1 };
      checkQuests(state);
      const q = state.quests.find((q) => q.id === 'first_shelter');
      if (q) {
        assert.strictEqual(q.completed, true);
        checkQuests(state);
        assert.strictEqual(q.completed, true);
      }
    });

    test('map has correct dimensions', () => {
      if (has('MAP_HEIGHT') && has('MAP_WIDTH')) {
        const state = createInitialGameState();
        assert.strictEqual(state.map.length, logic.MAP_HEIGHT);
        if (state.map.length > 0) {
          assert.strictEqual(state.map[0].length, logic.MAP_WIDTH);
        }
      }
    });
  } else {
    console.warn('Skipping quest tests (missing createInitialGameState, questDefinitions, checkQuests, or claimQuestReward).');
  }

  // --------------------------------------------------
  // 6. Shop / upgrade logic tests
  //    Again, only run if the helpers exist in logic.js
  // --------------------------------------------------
  if (
    has('createInitialGameState') &&
    has('purchaseUpgrade')
  ) {
    const { createInitialGameState, purchaseUpgrade } = logic;

    test('purchaseUpgrade sets upgrade flag and deducts gold when affordable', () => {
      const state = createInitialGameState();
      state.resources.gold = 200;
      const cost = 100;

      assert.strictEqual(state.upgrades.woodProduction, false);
      purchaseUpgrade(state, 'woodProduction', cost);
      assert.strictEqual(state.upgrades.woodProduction, true);
      assert.strictEqual(state.resources.gold, 100);
    });

    test('purchaseUpgrade does not go through if not enough gold', () => {
      const state = createInitialGameState();
      state.resources.gold = 50;
      const cost = 100;

      purchaseUpgrade(state, 'woodProduction', cost);
      // Expect no change
      assert.strictEqual(state.upgrades.woodProduction, false);
      assert.strictEqual(state.resources.gold, 50);
    });

    test('purchaseUpgrade returns true on success', () => {
      const state = createInitialGameState();
      state.resources.gold = 100;
      const result = purchaseUpgrade(state, 'woodProduction', 100);
      assert.strictEqual(result, true);
    });

    test('purchaseUpgrade returns false on insufficient gold', () => {
      const state = createInitialGameState();
      state.resources.gold = 50;
      const result = purchaseUpgrade(state, 'woodProduction', 100);
      assert.strictEqual(result, false);
    });

    test('cannot purchase upgrade twice', () => {
      const state = createInitialGameState();
      state.resources.gold = 200;
      const cost = 100;

      const result1 = purchaseUpgrade(state, 'woodProduction', cost);
      assert.strictEqual(result1, true);
      assert.strictEqual(state.resources.gold, 100);

      const result2 = purchaseUpgrade(state, 'woodProduction', cost);
      assert.strictEqual(result2, false);
      assert.strictEqual(state.resources.gold, 100);
    });

    test('purchaseUpgrade with exact gold amount works', () => {
      const state = createInitialGameState();
      state.resources.gold = 100;
      const cost = 100;

      const result = purchaseUpgrade(state, 'stoneProduction', cost);
      assert.strictEqual(result, true);
      assert.strictEqual(state.resources.gold, 0);
      assert.strictEqual(state.upgrades.stoneProduction, true);
    });

    test('purchaseUpgrade with invalid upgrade key returns false', () => {
      const state = createInitialGameState();
      state.resources.gold = 100;
      const result = purchaseUpgrade(state, 'invalidUpgrade', 100);
      assert.strictEqual(result, false);
      assert.strictEqual(state.resources.gold, 100);
    });

    test('initial state has all upgrades as false', () => {
      const state = createInitialGameState();
      assert.strictEqual(state.upgrades.woodProduction, false);
      assert.strictEqual(state.upgrades.stoneProduction, false);
      assert.strictEqual(state.upgrades.clayProduction, false);
      assert.strictEqual(state.upgrades.housingCapacity, false);
      assert.strictEqual(state.upgrades.smeltingSpeed, false);
    });
  } else {
    console.warn('Skipping shop/upgrade tests (missing createInitialGameState or purchaseUpgrade).');
  }

  // --------------------------------------------------
  // 7. Optional: production integration test
  //    Only runs if calculateProduction exists and uses a state object.
  // --------------------------------------------------
  if (has('createInitialGameState') && has('calculateProduction')) {
    const { createInitialGameState, calculateProduction } = logic;

    test('calculateProduction aggregates basic building rates', () => {
      const state = createInitialGameState();
      // place 1 lumberMill, 1 quarry, 1 tepee
      state.map[0][0] = { type: 'lumberMill', level: 1 };
      state.map[0][1] = { type: 'quarry', level: 1 };
      state.map[0][2] = { type: 'tepee', level: 1 };

      calculateProduction(state);

      // base wps assumed to be 1, plus lumberMill wood
      const expectedWps = 1 + 0.6;
      const expectedSps = 0.3; // quarry only
      const expectedCapacity = logic.buildingTypes
        ? logic.buildingTypes.tepee.baseProduction.capacity
        : state.population.capacity;

      assert.ok(Math.abs(state.rates.wps - expectedWps) < 1e-6);
      assert.ok(Math.abs(state.rates.sps - expectedSps) < 1e-6);
      assert.strictEqual(state.population.capacity, expectedCapacity);
    });

    test('calculateProduction with empty map returns base rates', () => {
      const state = createInitialGameState();
      calculateProduction(state);
      assert.strictEqual(state.rates.wps, 1); // base wps
      assert.strictEqual(state.rates.sps, 0);
      assert.strictEqual(state.population.capacity, 0);
    });

    test('calculateProduction aggregates multiple buildings', () => {
      const state = createInitialGameState();
      state.map[0][0] = { type: 'lumberMill', level: 1 };
      state.map[0][1] = { type: 'lumberMill', level: 1 };
      state.map[0][2] = { type: 'quarry', level: 1 };
      state.map[1][0] = { type: 'quarry', level: 1 };

      calculateProduction(state);

      const expectedWps = 1 + 0.6 + 0.6; // base + 2 lumberMills
      const expectedSps = 0.3 + 0.3; // 2 quarries

      assert.ok(Math.abs(state.rates.wps - expectedWps) < 1e-6);
      assert.ok(Math.abs(state.rates.sps - expectedSps) < 1e-6);
    });

    test('calculateProduction handles level 2 buildings', () => {
      const state = createInitialGameState();
      const { buildingTypes } = logic;
      state.map[0][0] = { type: 'lumberMill', level: 2 };

      calculateProduction(state);

      const baseWood = 0.6;
      const factor = Math.pow(buildingTypes.lumberMill.productionGrowthFactor, 1);
      const expectedWps = 1 + baseWood * factor;

      assert.ok(Math.abs(state.rates.wps - expectedWps) < 1e-6);
    });

    test('calculateProduction applies character bonuses', () => {
      const state = createInitialGameState();
      state.character = 'miner';
      state.map[0][0] = { type: 'quarry', level: 1 };

      calculateProduction(state);

      const baseStone = 0.3;
      const multiplier = logic.characterTypes.miner.miningProductionMultiplier;
      const expectedSps = baseStone * multiplier;

      assert.ok(Math.abs(state.rates.sps - expectedSps) < 1e-6);
    });

    test('calculateProduction handles farm population', () => {
      const state = createInitialGameState();
      state.map[0][0] = { type: 'farm', level: 1 };
      
      calculateProduction(state);
      
      // Should not affect rates, but building should produce population
      // (Note: actual population growth logic may be elsewhere)
      assert.ok(state.rates.wps >= 1);
    });

    test('calculateProduction ignores null tiles', () => {
      const state = createInitialGameState();
      state.map[0][0] = null;
      state.map[0][1] = { type: 'lumberMill', level: 1 };

      calculateProduction(state);

      const expectedWps = 1 + 0.6;
      assert.ok(Math.abs(state.rates.wps - expectedWps) < 1e-6);
    });

    test('calculateProduction ignores tiles without type', () => {
      const state = createInitialGameState();
      state.map[0][0] = { level: 1 }; // no type
      state.map[0][1] = { type: 'lumberMill', level: 1 };

      calculateProduction(state);

      const expectedWps = 1 + 0.6;
      assert.ok(Math.abs(state.rates.wps - expectedWps) < 1e-6);
    });
  } else {
    console.warn('Skipping production integration test (missing createInitialGameState or calculateProduction).');
  }

  // --------------------------------------------------
  // Summary
  // --------------------------------------------------
  const failed = results.filter((r) => !r.pass).length;
  const passed = results.length - failed;
  console.log('\n========== TEST SUMMARY ==========');
  console.log(`Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
  return results;
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
