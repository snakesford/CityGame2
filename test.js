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
    }

    // Miner discount on stone buildings (all levels)
    if (has('characterTypes') && logic.characterTypes.miner) {
      const { characterTypes } = logic;

      test('miner gets upgrade discount on quarry level 2 wood cost', () => {
        const ctx = { character: 'miner' };
        const lvl = 2;
        const baseWood = buildingTypes.quarry.baseCost.wood || 0;
        const factor = Math.pow(buildingTypes.quarry.costGrowthFactor, lvl - 1);
        const expected = Math.floor(
          baseWood * factor * characterTypes.miner.upgradeDiscount
        );
        const cost = getBuildingCost('quarry', lvl, ctx);
        assert.strictEqual(cost.wood, expected);
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
