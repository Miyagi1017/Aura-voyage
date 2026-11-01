import test from 'node:test';
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  minutesToTime,
  calculateHaversineKm,
  computeTransitBetween,
  detectDayConflicts,
  resolveDayConflicts,
  calculateDayMetrics,
  moveStepBetweenDays,
  reorderStepWithinDay,
  optimizeDayRoute,
  ActivityStep,
} from './travelLogic';

test('timeToMinutes and minutesToTime conversions', () => {
  assert.equal(timeToMinutes('09:30'), 570);
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('23:59'), 1439);

  assert.equal(minutesToTime(570), '09:30');
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(minutesToTime(1439), '23:59');
});

test('calculateHaversineKm distance calculation', () => {
  // Distance between Colosseum (41.8902, 12.4922) and Pantheon (41.8986, 12.4769)
  const dist = calculateHaversineKm(41.8902, 12.4922, 41.8986, 12.4769);
  assert.ok(dist >= 1.5 && dist <= 2.2, `Distance should be ~1.8km, got ${dist}`);
});

test('detectDayConflicts identifies overlapping schedule items', () => {
  const steps: ActivityStep[] = [
    {
      id: 'step-1',
      day: 1,
      name: 'Colisée',
      time: '10:00',
      durationMinutes: 120, // Ends at 12:00
      address: 'Piazza del Colosseo',
      lat: 41.8902,
      lng: 12.4922,
      category: 'culture',
      price: 18,
      description: 'Visite',
      image: '',
      transitToNext: {
        mode: 'walk',
        durationMin: 20,
        distanceKm: 1.5,
        cost: 0,
      },
    },
    {
      id: 'step-2',
      day: 1,
      name: 'Panthéon',
      time: '11:30', // Starts BEFORE step-1 finishes! Direct conflict!
      durationMinutes: 45,
      address: 'Piazza della Rotonda',
      lat: 41.8986,
      lng: 12.4769,
      category: 'culture',
      price: 5,
      description: 'Visite',
      image: '',
    },
  ];

  const conflicts = detectDayConflicts(steps);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].stepAId, 'step-1');
  assert.equal(conflicts[0].stepBId, 'step-2');
  assert.ok(conflicts[0].overlapMinutes > 0);
});

test('resolveDayConflicts shifts subsequent items and clears conflicts', () => {
  const steps: ActivityStep[] = [
    {
      id: 'step-1',
      day: 1,
      name: 'Colisée',
      time: '10:00',
      durationMinutes: 120, // ends 12:00
      address: 'Piazza del Colosseo',
      lat: 41.8902,
      lng: 12.4922,
      category: 'culture',
      price: 18,
      description: 'Visite',
      image: '',
    },
    {
      id: 'step-2',
      day: 1,
      name: 'Panthéon',
      time: '11:00', // Conflict!
      durationMinutes: 45,
      address: 'Piazza della Rotonda',
      lat: 41.8986,
      lng: 12.4769,
      category: 'culture',
      price: 5,
      description: 'Visite',
      image: '',
    },
  ];

  const resolved = resolveDayConflicts(steps);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].time, '10:00');
  // step-2 should be pushed after 12:00 + transit
  const step2TimeMin = timeToMinutes(resolved[1].time);
  assert.ok(step2TimeMin >= 12 * 60 + 15, `Step 2 time min should be >= 12:15, got ${resolved[1].time}`);

  // Checking that there are no remaining conflicts
  const remainingConflicts = detectDayConflicts(resolved);
  assert.equal(remainingConflicts.length, 0);
});

test('calculateDayMetrics aggregates totals properly', () => {
  const steps: ActivityStep[] = [
    {
      id: 'step-1',
      day: 1,
      name: 'Café',
      time: '09:00',
      durationMinutes: 30,
      address: 'Rue A',
      lat: 41.89,
      lng: 12.48,
      category: 'food',
      price: 8,
      description: 'Petit déjeuner',
      image: '',
      transitToNext: {
        mode: 'walk',
        durationMin: 15,
        distanceKm: 1.2,
        cost: 0,
      },
    },
    {
      id: 'step-2',
      day: 1,
      name: 'Musée',
      time: '10:00',
      durationMinutes: 90,
      address: 'Rue B',
      lat: 41.9,
      lng: 12.49,
      category: 'culture',
      price: 20,
      description: 'Visite',
      image: '',
    },
  ];

  const metrics = calculateDayMetrics(steps);
  assert.equal(metrics.activityCount, 2);
  assert.equal(metrics.totalCost, 28);
  assert.equal(metrics.totalWalkingKm, 1.2);
  assert.equal(metrics.totalTransitMin, 15);
});

test('moveStepBetweenDays transfers step and calculates target time slot', () => {
  const day1: ActivityStep[] = [
    {
      id: 'step-colisee',
      day: 1,
      name: 'Colisée',
      time: '10:00',
      durationMinutes: 90,
      address: 'Piazza del Colosseo',
      lat: 41.8902,
      lng: 12.4922,
      category: 'culture',
      price: 18,
      description: 'Visite',
      image: '',
    },
    {
      id: 'step-pantheon',
      day: 1,
      name: 'Panthéon',
      time: '14:00',
      durationMinutes: 60,
      address: 'Piazza della Rotonda',
      lat: 41.8986,
      lng: 12.4769,
      category: 'culture',
      price: 5,
      description: 'Visite',
      image: '',
    },
  ];

  const day2: ActivityStep[] = [
    {
      id: 'step-vatican',
      day: 2,
      name: 'Vatican',
      time: '09:00',
      durationMinutes: 120, // ends at 11:00
      address: 'Vatican',
      lat: 41.9022,
      lng: 12.4539,
      category: 'culture',
      price: 24,
      description: 'Visite',
      image: '',
    },
  ];

  const result = moveStepBetweenDays(day1, day2, 'step-pantheon', 2);
  assert.equal(result.newSourceSteps.length, 1);
  assert.equal(result.newSourceSteps[0].id, 'step-colisee');
  assert.equal(result.newTargetSteps.length, 2);
  assert.equal(result.movedStep?.id, 'step-pantheon');
  assert.equal(result.movedStep?.day, 2);
  // The moved step should start after 11:00 + transit
  const movedStart = timeToMinutes(result.movedStep!.time);
  assert.ok(movedStart >= 11 * 60, 'Should start after first activity ends');
});

test('reorderStepWithinDay smoothly reorders and updates sequential order', () => {
  const steps: ActivityStep[] = [
    {
      id: 's1',
      day: 1,
      name: 'Act 1',
      time: '09:00',
      durationMinutes: 60,
      address: 'A',
      lat: 41.89,
      lng: 12.49,
      category: 'culture',
      price: 10,
      description: '',
      image: '',
    },
    {
      id: 's2',
      day: 1,
      name: 'Act 2',
      time: '11:00',
      durationMinutes: 60,
      address: 'B',
      lat: 41.9,
      lng: 12.48,
      category: 'food',
      price: 15,
      description: '',
      image: '',
    },
    {
      id: 's3',
      day: 1,
      name: 'Act 3',
      time: '14:00',
      durationMinutes: 60,
      address: 'C',
      lat: 41.91,
      lng: 12.47,
      category: 'viewpoint',
      price: 0,
      description: '',
      image: '',
    },
  ];

  const reordered = reorderStepWithinDay(steps, 0, 2);
  assert.equal(reordered[0].id, 's2');
  assert.equal(reordered[1].id, 's3');
  assert.equal(reordered[2].id, 's1');
});

test('computeTransitBetween provides multi-mode walk and drive metrics', () => {
  const pointA = { lat: 41.8902, lng: 12.4922 }; // Colisée
  const pointB = { lat: 41.8986, lng: 12.4769 }; // Panthéon (~1.8km)

  const transit = computeTransitBetween(pointA, pointB);
  assert.ok(transit.distanceKm > 1 && transit.distanceKm < 3, `Distance should be ~1.8km, got ${transit.distanceKm}`);
  assert.ok((transit.walkMinutes ?? 0) >= 15, `Walk minutes should be >= 15, got ${transit.walkMinutes}`);
  assert.ok((transit.driveMinutes ?? 0) >= 5, `Drive minutes should be >= 5, got ${transit.driveMinutes}`);
  assert.ok((transit.walkMinutes ?? 0) > (transit.driveMinutes ?? 0), 'Walking duration should be longer than driving');

  // Test mode override
  const carTransit = computeTransitBetween(pointA, pointB, 'car');
  assert.equal(carTransit.mode, 'car');
  assert.equal(carTransit.durationMin, carTransit.driveMinutes);
  assert.ok(carTransit.cost > 0);
});

test('optimizeDayRoute reduces total distance on zig-zag path and preserves fixed steps', () => {
  // Setup 4 steps: Step A (South), Step B (North), Step C (South, near A), Step D (North, near B)
  // Original path A -> B -> C -> D zig-zags twice across city
  const zigZagSteps: ActivityStep[] = [
    {
      id: 'step-A',
      day: 1,
      name: 'Colisée (Sud)',
      time: '09:00',
      durationMinutes: 60,
      address: 'Colosseum',
      lat: 41.8902,
      lng: 12.4922,
      category: 'culture',
      price: 18,
      description: '',
      image: '',
    },
    {
      id: 'step-B',
      day: 1,
      name: 'Place Navone (Nord-Ouest)',
      time: '10:30',
      durationMinutes: 60,
      address: 'Piazza Navona',
      lat: 41.8992,
      lng: 12.4731,
      category: 'walk',
      price: 0,
      description: '',
      image: '',
    },
    {
      id: 'step-C',
      day: 1,
      name: 'Forum Romain (Sud, près Colisée)',
      time: '12:00',
      durationMinutes: 60,
      address: 'Roman Forum',
      lat: 41.8925,
      lng: 12.4853,
      category: 'culture',
      price: 12,
      description: '',
      image: '',
    },
    {
      id: 'step-D',
      day: 1,
      name: 'Panthéon (Nord-Ouest, près Navone)',
      time: '13:30',
      durationMinutes: 60,
      address: 'Pantheon',
      lat: 41.8986,
      lng: 12.4769,
      category: 'culture',
      price: 5,
      description: '',
      image: '',
    },
  ];

  const result = optimizeDayRoute(zigZagSteps);
  assert.ok(result.hasReordered, 'Should have reordered the zig-zag steps');
  assert.ok(result.distanceSavedKm > 0.5, `Should save substantial distance, got ${result.distanceSavedKm} km`);
  assert.ok(result.optimizedDistanceKm < result.originalDistanceKm);

  // Colosseum (A) should be followed by Roman Forum (C), then Pantheon (D) and Piazza Navona (B)
  const orderedIds = result.optimizedSteps.map((s) => s.id);
  assert.equal(orderedIds[0], 'step-A');
  assert.equal(orderedIds[1], 'step-C');

  // Now test with Step B fixed as a locked reservation at 12:00
  const stepsWithFixed: ActivityStep[] = zigZagSteps.map((s) =>
    s.id === 'step-B' ? { ...s, isFixedTime: true, time: '12:00' } : { ...s }
  );

  const fixedResult = optimizeDayRoute(stepsWithFixed);
  const fixedStepInResult = fixedResult.optimizedSteps.find((s) => s.id === 'step-B');
  assert.ok(fixedStepInResult, 'Fixed step must remain in result');
  assert.equal(fixedStepInResult?.isFixedTime, true);
  assert.equal(fixedResult.fixedStepsCount, 1);
});


