import { Drill, AgeGroupDefinition, Station, DrillBlock, StationLayout } from '../../data/types';
import {
  BASE_TRANSITION_MINUTES,
  TRANSITION_INTENSITY_PIVOT,
  TRANSITION_SLOPE,
  BASE_RPM,
  BONUS_REP_CAP_FRACTION,
} from '../constants/intensityConfig';

/**
 * Rep Flow Engine — engine.calculateOptimalRepFlow()
 *
 * Given the age group timing, selected drills, intensity, and coach count,
 * produces a full station layout: how many stations, which drills go where,
 * how many reps per drill, transition times, and any bonus/open time.
 *
 * Key formulas:
 *   stationCount         = min(totalCoaches, numDrills)
 *   seqSlots             = ceil(numDrills / stationCount)
 *   transitionTime       = BASE + (PIVOT − intensity) × SLOPE
 *   wallClockTransitions = (seqSlots − 1) × transitionTime
 *   timePerDrill         = (available − wallClockTransitions) / seqSlots
 *   repsPerDrill         = round(timePerDrill × (BASE_RPM + intensity))
 */
export function calculateOptimalRepFlow(
  ageGroupDef: AgeGroupDefinition,
  selectedDrills: Drill[],
  intensity: number,
  assistantCoaches: number,
): StationLayout {
  if (selectedDrills.length === 0) {
    return {
      stations: [],
      transitionTimeMinutes: 0,
      totalWallClockMinutes: ageGroupDef.defaultPracticeMinutes,
    };
  }

  const totalCoaches = 1 + assistantCoaches;
  const numDrills = selectedDrills.length;
  const stationCount = Math.min(totalCoaches, numDrills);
  const seqSlots = Math.ceil(numDrills / stationCount);

  const transitionTime =
    BASE_TRANSITION_MINUTES + (TRANSITION_INTENSITY_PIVOT - intensity) * TRANSITION_SLOPE;
  const wallClockTransitions = (seqSlots - 1) * transitionTime;

  const availableDrillTime =
    ageGroupDef.defaultPracticeMinutes - ageGroupDef.warmupMinutes - ageGroupDef.cooldownMinutes;
  const pureDrillTime = availableDrillTime - wallClockTransitions;
  const timePerDrill = pureDrillTime / seqSlots;

  const baseRPM = BASE_RPM + intensity;
  const repsPerDrill = Math.round(timePerDrill * baseRPM);

  // Distribute drills round-robin across stations
  const stationDrills: Drill[][] = Array.from({ length: stationCount }, () => []);
  selectedDrills.forEach((drill, i) => {
    stationDrills[i % stationCount].push(drill);
  });

  // Identify short stations (fewer than seqSlots drills)
  const stations: Station[] = stationDrills.map((drills, coachIndex) => {
    const isShortStation = drills.length < seqSlots;

    const blocks: DrillBlock[] = drills.map((drill, drillIndex) => {
      const isLastDrill = drillIndex === drills.length - 1;
      let bonusReps = 0;
      let openTimeMinutes = 0;

      if (isShortStation && isLastDrill) {
        // This station finishes one drill-slot early. Award bonus reps on the last drill,
        // capped at 50% of base repsPerDrill AND capped by available time.
        const maxBonusByCap = Math.round(repsPerDrill * BONUS_REP_CAP_FRACTION);
        const maxBonusByTime = Math.floor(timePerDrill * baseRPM);
        bonusReps = Math.min(maxBonusByCap, maxBonusByTime);
        // Open time = the leftover slot minus the time the bonus reps consume
        const bonusTimeConsumed = bonusReps / baseRPM;
        openTimeMinutes = Math.max(0, timePerDrill - bonusTimeConsumed);
      }

      return {
        drill,
        timeMinutes: timePerDrill,
        reps: repsPerDrill,
        bonusReps,
        openTimeMinutes,
      };
    });

    return { coachIndex, drills: blocks };
  });

  return {
    stations,
    transitionTimeMinutes: transitionTime,
    totalWallClockMinutes: ageGroupDef.defaultPracticeMinutes,
  };
}
