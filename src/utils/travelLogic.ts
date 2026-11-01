export interface TransitDetail {
  mode: 'walk' | 'metro' | 'taxi' | 'car';
  durationMin: number;
  distanceKm: number;
  cost: number;
  walkMinutes?: number;
  driveMinutes?: number;
  carCost?: number;
}

export interface ActivityStep {
  id: string;
  day: number;
  name: string;
  time: string; // HH:mm
  durationMinutes: number;
  address: string;
  lat: number;
  lng: number;
  category: 'culture' | 'food' | 'nature' | 'viewpoint' | 'walk' | 'secret' | 'nightlife' | 'drink';
  price: number;
  bookingRequired?: boolean;
  isBooked?: boolean;
  isFixedTime?: boolean; // When true, optimization preserves this milestone's fixed schedule
  fixedTimeSlot?: string;
  tag?: 'instagram' | 'offbeat' | 'secret_table' | 'speakeasy' | 'classic';
  instagramTip?: string;
  description: string;
  tips?: string;
  image: string;
  transitToNext?: TransitDetail;
}

export interface ConflictInfo {
  stepAId: string;
  stepBId: string;
  stepAName: string;
  stepBName: string;
  overlapMinutes: number;
  message: string;
}

/**
 * Converts "HH:mm" into minutes from start of day.
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((num) => Number.parseInt(num, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Converts minutes from start of day into "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Calculates Haversine distance in kilometers between two geo coordinates.
 */
export function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Computes realistic multi-mode travel metrics (walking vs driving)
 * between two geographic coordinates.
 */
export function computeTransitBetween(
  stepA: { lat: number; lng: number },
  stepB: { lat: number; lng: number },
  preferredMode?: 'walk' | 'car' | 'metro' | 'taxi'
): TransitDetail {
  const rawDist = calculateHaversineKm(stepA.lat, stepA.lng, stepB.lat, stepB.lng);
  const distanceKm = Math.max(0.1, rawDist);

  // Urban walking: average 4.5 km/h + 2 min street crossing buffer
  const walkMinutes = Math.max(3, Math.round(distanceKm * 13.3 + 2));

  // Urban driving: average 24 km/h with traffic + 4 min start/parking buffer
  const driveMinutes = Math.max(4, Math.round(distanceKm * 2.5 + 4));

  // Car/taxi estimated cost
  const carCost = Math.round(Math.max(5, distanceKm * 2.2 + 4));

  let mode: 'walk' | 'metro' | 'taxi' | 'car' = preferredMode || 'walk';
  let durationMin = walkMinutes;
  let cost = 0;

  if (preferredMode === 'car' || preferredMode === 'taxi') {
    mode = preferredMode;
    durationMin = driveMinutes;
    cost = carCost;
  } else if (preferredMode === 'walk') {
    mode = 'walk';
    durationMin = walkMinutes;
    cost = 0;
  } else if (distanceKm <= 1.8) {
    mode = 'walk';
    durationMin = walkMinutes;
    cost = 0;
  } else if (distanceKm <= 6) {
    mode = 'metro';
    durationMin = Math.max(10, Math.round(distanceKm * 3.8 + 6));
    cost = 2;
  } else {
    mode = 'car';
    durationMin = driveMinutes;
    cost = carCost;
  }

  return {
    mode,
    durationMin,
    distanceKm,
    cost,
    walkMinutes,
    driveMinutes,
    carCost,
  };
}

/**
 * Detects conflicts between sequential steps on a single day.
 * A conflict occurs if step A ends after step B starts, or if
 * the gap between A's end and B's start is strictly less than transit time.
 */
export function detectDayConflicts(steps: ActivityStep[]): ConflictInfo[] {
  const sorted = [...steps].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
  );
  const conflicts: ConflictInfo[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const currentStart = timeToMinutes(current.time);
    const currentEnd = currentStart + current.durationMinutes;
    const nextStart = timeToMinutes(next.time);

    const transitMin =
      current.transitToNext?.durationMin ??
      computeTransitBetween(current, next).durationMin;

    const neededStart = currentEnd + transitMin;

    if (nextStart < neededStart) {
      const overlap = neededStart - nextStart;
      conflicts.push({
        stepAId: current.id,
        stepBId: next.id,
        stepAName: current.name,
        stepBName: next.name,
        overlapMinutes: overlap,
        message:
          nextStart < currentEnd
            ? `Chevauchement direct de ${currentEnd - nextStart} min entre "${current.name}" et "${next.name}".`
            : `Temps de trajet insuffisant (${transitMin} min requises, seulement ${nextStart - currentEnd} min prévues).`,
      });
    }
  }

  return conflicts;
}

/**
 * Automatically resolves a conflict by shifting step B and any subsequent
 * cascading steps so they have adequate visit duration and transit buffer.
 */
export function resolveDayConflicts(steps: ActivityStep[]): ActivityStep[] {
  if (steps.length <= 1) return [...steps];

  const sorted = [...steps].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
  );

  const resolved: ActivityStep[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      resolved.push({ ...sorted[0] });
      continue;
    }

    const prev = resolved[i - 1];
    const curr = { ...sorted[i] };

    const prevStart = timeToMinutes(prev.time);
    const prevEnd = prevStart + prev.durationMinutes;

    // Recalculate transit
    const transit = computeTransitBetween(prev, curr);
    prev.transitToNext = transit;

    const minRequiredStart = prevEnd + transit.durationMin;
    const currPlannedStart = timeToMinutes(curr.time);

    if (currPlannedStart < minRequiredStart) {
      // Shift current activity to minRequiredStart rounded to nearest 5 min
      const rounded = Math.ceil(minRequiredStart / 5) * 5;
      curr.time = minutesToTime(rounded);
    }

    resolved.push(curr);
  }

  // Ensure last activity has transit set to undefined or null
  if (resolved.length > 0) {
    resolved[resolved.length - 1].transitToNext = undefined;
  }

  return resolved;
}

/**
 * Calculates day statistics: total cost, total duration, total distance, transit count.
 */
export function calculateDayMetrics(steps: ActivityStep[]) {
  let totalCost = 0;
  let totalWalkingKm = 0;
  let totalTransitMin = 0;

  for (let i = 0; i < steps.length; i++) {
    totalCost += steps[i].price;
    if (steps[i].transitToNext) {
      const transit = steps[i].transitToNext!;
      totalCost += transit.cost;
      totalTransitMin += transit.durationMin;
      if (transit.mode === 'walk') {
        totalWalkingKm += transit.distanceKm;
      }
    }
  }

  return {
    activityCount: steps.length,
    totalCost,
    totalWalkingKm: Math.round(totalWalkingKm * 10) / 10,
    totalTransitMin,
  };
}

/**
 * Transfers an activity step from one day to another.
 * Automatically recalculates transit on the source day and schedules 
 * the activity at an optimal time on the target day.
 */
export function moveStepBetweenDays(
  sourceSteps: ActivityStep[],
  targetSteps: ActivityStep[],
  stepId: string,
  targetDayNumber: number
): {
  newSourceSteps: ActivityStep[];
  newTargetSteps: ActivityStep[];
  movedStep: ActivityStep | null;
} {
  const stepToMove = sourceSteps.find((s) => s.id === stepId);
  if (!stepToMove) {
    return {
      newSourceSteps: [...sourceSteps],
      newTargetSteps: [...targetSteps],
      movedStep: null,
    };
  }

  // Remove from source and recalculate transit
  const newSourceSteps = sourceSteps.filter((s) => s.id !== stepId);
  for (let i = 0; i < newSourceSteps.length; i++) {
    if (i < newSourceSteps.length - 1) {
      newSourceSteps[i].transitToNext = computeTransitBetween(
        newSourceSteps[i],
        newSourceSteps[i + 1]
      );
    } else {
      newSourceSteps[i].transitToNext = undefined;
    }
  }

  // Determine time slot in target day
  let targetTime = '09:30';
  if (targetSteps.length > 0) {
    const lastStep = targetSteps[targetSteps.length - 1];
    const lastEndMins =
      timeToMinutes(lastStep.time) + lastStep.durationMinutes;
    const transit = computeTransitBetween(lastStep, stepToMove);
    const plannedStart = lastEndMins + transit.durationMin;
    const roundedMins = Math.ceil(plannedStart / 5) * 5;
    targetTime = minutesToTime(roundedMins);
    lastStep.transitToNext = transit;
  }

  const updatedStep: ActivityStep = {
    ...stepToMove,
    day: targetDayNumber,
    time: targetTime,
    transitToNext: undefined,
  };

  const newTargetSteps = [...targetSteps, updatedStep];

  return {
    newSourceSteps,
    newTargetSteps,
    movedStep: updatedStep,
  };
}

/**
 * Reorders a step within the same day's itinerary, adjusting 
 * time sequences and transit connectors smoothly.
 */
export function reorderStepWithinDay(
  steps: ActivityStep[],
  sourceIndex: number,
  targetIndex: number
): ActivityStep[] {
  if (
    sourceIndex === targetIndex ||
    sourceIndex < 0 ||
    sourceIndex >= steps.length ||
    targetIndex < 0 ||
    targetIndex >= steps.length
  ) {
    return [...steps];
  }

  const reordered = [...steps];
  const [movedItem] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, movedItem);

  // Re-adjust transit and time flow progressively
  for (let i = 0; i < reordered.length; i++) {
    if (i === 0) continue;
    const prev = reordered[i - 1];
    const curr = reordered[i];

    const transit = computeTransitBetween(prev, curr);
    prev.transitToNext = transit;

    const prevEnd = timeToMinutes(prev.time) + prev.durationMinutes;
    const minStart = prevEnd + transit.durationMin;
    const currPlanned = timeToMinutes(curr.time);

    if (currPlanned < minStart) {
      const rounded = Math.ceil(minStart / 5) * 5;
      curr.time = minutesToTime(rounded);
    }
  }

  if (reordered.length > 0) {
    reordered[reordered.length - 1].transitToNext = undefined;
  }

  return reordered;
}

export interface RouteOptimizationResult {
  optimizedSteps: ActivityStep[];
  originalDistanceKm: number;
  optimizedDistanceKm: number;
  distanceSavedKm: number;
  timeSavedMinutes: number;
  hasReordered: boolean;
  fixedStepsCount: number;
}

/**
 * Calculates total transit distance across a chain of steps.
 */
export function calculateChainDistance(steps: ActivityStep[]): number {
  let dist = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    dist += calculateHaversineKm(steps[i].lat, steps[i].lng, steps[i + 1].lat, steps[i + 1].lng);
  }
  return dist;
}

/**
 * Checks whether an activity step must be held at a fixed schedule milestone.
 */
export function isStepFixedSchedule(step: ActivityStep): boolean {
  return Boolean(step.isFixedTime || step.bookingRequired || step.isBooked);
}

/**
 * Generates all permutations of an array (used for small arrays <= 7).
 */
function getPermutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = getPermutations(remaining);
    for (const p of perms) {
      result.push([current, ...p]);
    }
  }
  return result;
}

/**
 * Solves shortest path for flexible steps between two anchor points.
 */
function optimizeFlexibleSegment(
  items: ActivityStep[],
  startAnchor?: ActivityStep,
  endAnchor?: ActivityStep
): ActivityStep[] {
  if (items.length <= 1) return [...items];

  // For <= 7 items, test all permutations (fast, completes in < 1ms)
  if (items.length <= 7) {
    const perms = getPermutations(items);
    let bestPerm = perms[0];
    let bestDist = Number.POSITIVE_INFINITY;

    for (const p of perms) {
      let d = 0;
      if (startAnchor) {
        d += calculateHaversineKm(startAnchor.lat, startAnchor.lng, p[0].lat, p[0].lng);
      }
      for (let i = 0; i < p.length - 1; i++) {
        d += calculateHaversineKm(p[i].lat, p[i].lng, p[i + 1].lat, p[i + 1].lng);
      }
      if (endAnchor) {
        d += calculateHaversineKm(p[p.length - 1].lat, p[p.length - 1].lng, endAnchor.lat, endAnchor.lng);
      }

      if (d < bestDist) {
        bestDist = d;
        bestPerm = p;
      }
    }

    return [...bestPerm];
  }

  // Nearest-Neighbor heuristic for > 7 items
  const unvisited = [...items];
  const ordered: ActivityStep[] = [];
  let currentLat = startAnchor ? startAnchor.lat : items[0].lat;
  let currentLng = startAnchor ? startAnchor.lng : items[0].lng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < unvisited.length; i++) {
      const d = calculateHaversineKm(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }
    const [next] = unvisited.splice(nearestIdx, 1);
    ordered.push(next);
    currentLat = next.lat;
    currentLng = next.lng;
  }

  return ordered;
}

/**
 * Optimizes the day's itinerary to minimize total travel time and distance
 * while strictly respecting fixed-time reservations / booking milestones.
 */
export function optimizeDayRoute(steps: ActivityStep[]): RouteOptimizationResult {
  if (!steps || steps.length <= 2) {
    const origDist = steps ? calculateChainDistance(steps) : 0;
    return {
      optimizedSteps: steps ? [...steps] : [],
      originalDistanceKm: Math.round(origDist * 10) / 10,
      optimizedDistanceKm: Math.round(origDist * 10) / 10,
      distanceSavedKm: 0,
      timeSavedMinutes: 0,
      hasReordered: false,
      fixedStepsCount: steps ? steps.filter(isStepFixedSchedule).length : 0,
    };
  }

  const originalDistanceKm = Math.round(calculateChainDistance(steps) * 10) / 10;
  const fixedCount = steps.filter(isStepFixedSchedule).length;

  const workingSteps: ActivityStep[] = steps.map((s) => ({ ...s }));

  let reorderedSequence: ActivityStep[] = [];

  const fixedIndices: number[] = [];
  workingSteps.forEach((s, idx) => {
    if (isStepFixedSchedule(s)) {
      fixedIndices.push(idx);
    }
  });

  if (fixedIndices.length === 0) {
    // Treat step 0 as morning start anchor
    const startAnchor = workingSteps[0];
    const flexRest = workingSteps.slice(1);
    const optimizedFlex = optimizeFlexibleSegment(flexRest, startAnchor);
    reorderedSequence = [startAnchor, ...optimizedFlex];
  } else {
    // Partition into flexible buckets: before first fixed, between fixed, after last fixed
    let lastAnchor: ActivityStep | undefined = undefined;
    let flexBucket: ActivityStep[] = [];

    for (let i = 0; i < workingSteps.length; i++) {
      const step = workingSteps[i];
      if (isStepFixedSchedule(step)) {
        if (flexBucket.length > 0) {
          const optimizedBucket = optimizeFlexibleSegment(flexBucket, lastAnchor, step);
          reorderedSequence.push(...optimizedBucket);
          flexBucket = [];
        }
        reorderedSequence.push(step);
        lastAnchor = step;
      } else {
        flexBucket.push(step);
      }
    }

    if (flexBucket.length > 0) {
      const optimizedTail = optimizeFlexibleSegment(flexBucket, lastAnchor);
      reorderedSequence.push(...optimizedTail);
    }
  }

  // Recalculate schedule and transits chronologically
  const optimizedSteps: ActivityStep[] = [];

  for (let i = 0; i < reorderedSequence.length; i++) {
    const curr = { ...reorderedSequence[i] };

    if (i === 0) {
      optimizedSteps.push(curr);
      continue;
    }

    const prev = optimizedSteps[i - 1];
    const transit = computeTransitBetween(prev, curr, prev.transitToNext?.mode);
    prev.transitToNext = transit;

    const prevEnd = timeToMinutes(prev.time) + prev.durationMinutes;
    const earliestArrival = prevEnd + transit.durationMin;
    const roundedEarliest = Math.ceil(earliestArrival / 5) * 5;

    if (isStepFixedSchedule(curr)) {
      const plannedTimeMins = timeToMinutes(curr.time);
      if (plannedTimeMins < roundedEarliest) {
        curr.time = minutesToTime(roundedEarliest);
      }
    } else {
      curr.time = minutesToTime(roundedEarliest);
    }

    optimizedSteps.push(curr);
  }

  if (optimizedSteps.length > 0) {
    optimizedSteps[optimizedSteps.length - 1].transitToNext = undefined;
  }

  const optimizedDistanceKm = Math.round(calculateChainDistance(optimizedSteps) * 10) / 10;
  const distanceSavedKm = Math.max(
    0,
    Math.round((originalDistanceKm - optimizedDistanceKm) * 10) / 10
  );
  const timeSavedMinutes = Math.max(0, Math.round(distanceSavedKm * 13));

  const hasReordered =
    distanceSavedKm >= 0.1 ||
    steps.some((s, idx) => s.id !== optimizedSteps[idx]?.id || s.time !== optimizedSteps[idx]?.time);

  return {
    optimizedSteps,
    originalDistanceKm,
    optimizedDistanceKm,
    distanceSavedKm,
    timeSavedMinutes,
    hasReordered,
    fixedStepsCount: fixedCount,
  };
}

