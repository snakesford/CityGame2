# Town System Testing Guide

## Overview
This document describes the test suite for the Town System features and how to run them.

## Test Files
- `town-system-tests.js` - Test suite with 20+ test cases
- `test-town-system.html` - Browser-based test runner

## Running Tests

### Option 1: Browser Test Runner
1. Open `test-town-system.html` in a web browser
2. Tests will run automatically on page load
3. Results will be displayed in the test output area

### Option 2: Browser Console
1. Open the main game (`index.html`) in a browser
2. Open browser console (F12)
3. Load the test file:
   ```javascript
   const script = document.createElement('script');
   script.src = 'town-system-tests.js';
   document.head.appendChild(script);
   ```
4. Tests will run automatically and results will be in the console

## Test Coverage

### 1. Core Functions
- ✅ `isMineType()` - Recognizes all mine types
- ✅ `getBuildingCount()` - Counts buildings excluding town centers
- ✅ `updateBuildingCap()` - Calculates building cap from town levels

### 2. Pattern Detection
- ✅ Detects pattern at 0° rotation
- ✅ Detects pattern at 90° rotation  
- ✅ Rejects invalid patterns
- ✅ Rejects patterns without cabin center

### 3. Town Creation
- ✅ Creates town with correct data structure
- ✅ Locks all 9 tiles
- ✅ Replaces center cabin with Town Center L1
- ✅ Updates building cap

### 4. Building Cap System
- ✅ Enforces building cap on placement
- ✅ Excludes town centers from count
- ✅ Increases cap when towns level up

### 5. Town Leveling
- ✅ Checks quest completion
- ✅ Levels up town when quest completed
- ✅ Updates town center building type
- ✅ Unlocks merchants

### 6. Merchant System
- ✅ Returns available merchants for unlocked tiers
- ✅ Tracks merchant unlocks per town

### 7. Protection Mechanisms
- ✅ Prevents building placement on locked tiles
- ✅ Prevents removal of town centers
- ✅ Prevents removal of buildings on locked tiles

## Bugs Fixed

### 1. Pattern Detection Bug
**Issue**: The pattern detection was checking the original tile position instead of the rotated position for townId validation.

**Fix**: Moved the townId check to after calculating the rotated position, so it checks the correct tile.

### 2. Center Tile Finding in levelUpTown
**Issue**: The function might not reliably find the center tile when leveling up.

**Fix**: Improved the logic to find the center tile by checking both the tile type and townId match.

### 3. DOM Function Safety
**Issue**: Functions like `showMessage`, `renderGrid`, and `updateUI` might not exist in test environments.

**Fix**: Added checks to ensure these functions exist before calling them, making the code testable.

## Test Results
Run the tests to see current pass/fail status. All tests should pass after the bug fixes.

## Manual Testing Checklist

1. **Pattern Detection**
   - [ ] Place the 3×3 pattern in all 4 rotations
   - [ ] Verify town center is created
   - [ ] Verify all 9 tiles are locked

2. **Building Cap**
   - [ ] Place buildings up to the cap
   - [ ] Verify placement is blocked at cap
   - [ ] Level up a town
   - [ ] Verify cap increases

3. **Town Leveling**
   - [ ] Complete level 1 quest (build 5 buildings)
   - [ ] Verify quest is marked complete
   - [ ] Click "Upgrade Town" button
   - [ ] Verify town levels up to 2
   - [ ] Verify building cap increases

4. **Merchants**
   - [ ] Level up town to unlock merchants
   - [ ] Open town center modal
   - [ ] Verify merchants appear
   - [ ] Test merchant trades

5. **Protection**
   - [ ] Try to place building on locked tile (should fail)
   - [ ] Try to remove town center (should fail)
   - [ ] Try to remove building on locked tile (should fail)

## Known Issues
None currently. All identified bugs have been fixed.

