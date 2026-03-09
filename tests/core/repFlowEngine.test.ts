import { calculateOptimalRepFlow } from '../../src/core/engine/repFlowEngine';
import { getAgeGroupDefinition } from '../../src/core/constants/ageGroups';
import { AgeGroup, Drill } from '../../src/data/types';
import { SEED_DRILL_CATALOG } from '../../src/data/seedDrills';

/** Helper: pick N drills from seed catalog by id */
function getDrills(...ids: string[]): Drill[] {
  return ids.map((id) => {
    const d = SEED_DRILL_CATALOG.find((drill) => drill.id === id);
    if (!d) throw new Error(`Drill not found: ${id}`);
    return d;
  });
}

describe('calculateOptimalRepFlow', () => {
  test('Scenario A: 10U, intensity 3, 1 assistant → 2 stations, 2 drills each, 126 reps, wall clock 60', () => {
    const def = getAgeGroupDefinition(AgeGroup.KID_PITCH);
    const drills = getDrills('grounders-and-throw', 'lead-off-drill', 'batting-tee-drill', 'catch-and-throw-relay');
    const layout = calculateOptimalRepFlow(def, drills, 3, 1);

    expect(layout.stations).toHaveLength(2);
    expect(layout.stations[0].drills).toHaveLength(2);
    expect(layout.stations[1].drills).toHaveLength(2);
    expect(layout.transitionTimeMinutes).toBeCloseTo(3.0, 2);
    expect(layout.totalWallClockMinutes).toBe(60);

    // Each drill gets 21 min and 126 reps
    for (const station of layout.stations) {
      for (const block of station.drills) {
        expect(block.timeMinutes).toBeCloseTo(21.0, 2);
        expect(block.reps).toBe(126);
      }
    }
  });

  test('Scenario B: 12U, intensity 4, 0 assistants → 1 station, 4 drills, 88 reps, wall clock 75', () => {
    const def = getAgeGroupDefinition(AgeGroup.COMPETITIVE);
    const drills = getDrills('double-play-drill', 'bat-speed-drill', 'stolen-base-sim', 'pitching-mechanics');
    const layout = calculateOptimalRepFlow(def, drills, 4, 0);

    expect(layout.stations).toHaveLength(1);
    expect(layout.stations[0].drills).toHaveLength(4);
    expect(layout.transitionTimeMinutes).toBeCloseTo(2.5, 2);
    expect(layout.totalWallClockMinutes).toBe(75);

    for (const block of layout.stations[0].drills) {
      expect(block.timeMinutes).toBeCloseTo(12.625, 2);
      expect(block.reps).toBe(88);
    }
  });

  test('single drill: zero transitions, all time goes to one drill', () => {
    const def = getAgeGroupDefinition(AgeGroup.KID_PITCH);
    const drills = getDrills('grounders-and-throw');
    const layout = calculateOptimalRepFlow(def, drills, 3, 0);

    expect(layout.stations).toHaveLength(1);
    expect(layout.stations[0].drills).toHaveLength(1);
    // seqSlots=1, transitions=(1-1)*3=0, available=60-10-5=45, timePerDrill=45/1=45
    expect(layout.stations[0].drills[0].timeMinutes).toBeCloseTo(45, 1);
    expect(layout.stations[0].drills[0].reps).toBe(Math.round(45 * 6)); // 270
  });

  test('more coaches than drills: stationCount caps at numDrills', () => {
    const def = getAgeGroupDefinition(AgeGroup.KID_PITCH);
    const drills = getDrills('grounders-and-throw', 'batting-tee-drill');
    const layout = calculateOptimalRepFlow(def, drills, 3, 5); // 6 coaches, 2 drills

    expect(layout.stations).toHaveLength(2); // capped at 2
    expect(layout.stations[0].drills).toHaveLength(1);
    expect(layout.stations[1].drills).toHaveLength(1);
  });

  test('empty drill list returns empty layout', () => {
    const def = getAgeGroupDefinition(AgeGroup.KID_PITCH);
    const layout = calculateOptimalRepFlow(def, [], 3, 0);

    expect(layout.stations).toHaveLength(0);
    expect(layout.transitionTimeMinutes).toBe(0);
  });

  test('bonus reps never exceed 50% of base repsPerDrill', () => {
    // 3 drills, 2 coaches → station 0 gets 2 drills, station 1 gets 1 (short station)
    const def = getAgeGroupDefinition(AgeGroup.KID_PITCH);
    const drills = getDrills('grounders-and-throw', 'batting-tee-drill', 'base-running-relay');
    const layout = calculateOptimalRepFlow(def, drills, 3, 1);

    expect(layout.stations).toHaveLength(2);
    // Find the short station (1 drill)
    const shortStation = layout.stations.find((s) => s.drills.length === 1);
    expect(shortStation).toBeDefined();

    const lastBlock = shortStation!.drills[shortStation!.drills.length - 1];
    if (lastBlock.bonusReps > 0) {
      expect(lastBlock.bonusReps).toBeLessThanOrEqual(Math.round(lastBlock.reps * 0.5));
    }
  });

  test('intensity 1 produces transition time 4.0 min', () => {
    const def = getAgeGroupDefinition(AgeGroup.KID_PITCH);
    const drills = getDrills('grounders-and-throw', 'batting-tee-drill');
    const layout = calculateOptimalRepFlow(def, drills, 1, 0);
    expect(layout.transitionTimeMinutes).toBeCloseTo(4.0, 2);
  });

  test('intensity 5 produces transition time 2.0 min', () => {
    const def = getAgeGroupDefinition(AgeGroup.KID_PITCH);
    const drills = getDrills('grounders-and-throw', 'batting-tee-drill');
    const layout = calculateOptimalRepFlow(def, drills, 5, 0);
    expect(layout.transitionTimeMinutes).toBeCloseTo(2.0, 2);
  });
});
