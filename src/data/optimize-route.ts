import { ItineraryStep } from '../types/travel';
import { estimateTravel, haversineKm } from './geo';
import { recalculateStepsRoute } from './route';

export interface RouteOptimization {
  steps: ItineraryStep[];
  /** Minutes de trajet économisées par rapport à l'ordre actuel. */
  savedMinutes: number;
  /** Nombre d'étapes qui ont réellement changé de créneau. */
  movedSteps: number;
}

const legMinutes = (from: ItineraryStep, to: ItineraryStep): number =>
  estimateTravel(
    haversineKm(
      [from.activity.lat, from.activity.lng],
      [to.activity.lat, to.activity.lng]
    )
  ).durationMinutes;

/** Somme des trajets de la journée (le trajet d'approche reste inchangé). */
const routeMinutes = (steps: ItineraryStep[]): number =>
  steps.reduce(
    (total, step, index) => (index === 0 ? total : total + legMinutes(steps[index - 1], step)),
    0
  );

/** Toutes les permutations (utilisé seulement pour de petites journées). */
const permutations = <T,>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
          item,
          ...rest,
        ])
      );

/**
 * Réordonne les étapes flexibles d'une journée pour réduire le temps de trajet.
 *
 * - Les étapes réservées (`fixedIds`) gardent leur horaire.
 * - Les repas et les sorties nocturnes gardent aussi leur créneau : on ne
 *   déplace pas un déjeuner à 17 h pour gagner quelques minutes.
 * - Le premier rendez-vous de la journée reste le point de départ.
 * - Les créneaux horaires sont conservés : seules les activités permutent.
 *
 * Journée courte : permutation exhaustive (résultat optimal).
 * Journée longue : échanges successifs jusqu'à stabilité (rapide et léger).
 */
export const optimizeDayRoute = (
  steps: ItineraryStep[],
  fixedIds: readonly string[] = []
): RouteOptimization => {
  const fixed = new Set(fixedIds);
  const keepsItsSlot = (step: ItineraryStep): boolean =>
    fixed.has(step.activity.id) ||
    step.activity.category === 'Gastronomie' ||
    step.activity.category === 'Vie nocturne';
  const positions = steps
    .map((_, index) => index)
    .filter((index) => index > 0 && !keepsItsSlot(steps[index]));

  if (positions.length < 2) {
    return { steps, savedMinutes: 0, movedSteps: 0 };
  }

  const before = routeMinutes(steps);
  const pool = positions.map((position) => steps[position]);
  const place = (order: ItineraryStep[]): ItineraryStep[] => {
    const next = [...steps];
    positions.forEach((position, rank) => {
      next[position] = order[rank];
    });
    return next;
  };

  let best = place(pool);
  let bestCost = before;

  if (pool.length <= 7) {
    for (const order of permutations(pool)) {
      const candidate = place(order);
      const cost = routeMinutes(candidate);
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
    }
  } else {
    let current = [...pool];
    for (let improved = true; improved; ) {
      improved = false;
      for (let i = 0; i < current.length - 1; i += 1) {
        for (let j = i + 1; j < current.length; j += 1) {
          const candidate = [...current];
          [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
          const cost = routeMinutes(place(candidate));
          if (cost < bestCost) {
            current = candidate;
            best = place(candidate);
            bestCost = cost;
            improved = true;
          }
        }
      }
    }
  }

  // Les activités permutent, les créneaux horaires restent à leur place.
  const slots = positions.map((position) => steps[position].activity.time);
  const reordered = best.map((step) => ({ ...step }));
  positions.forEach((position, rank) => {
    reordered[position] = {
      ...best[position],
      activity: { ...best[position].activity, time: slots[rank] },
    };
  });

  const optimized = recalculateStepsRoute(reordered);
  const movedSteps = positions.filter(
    (position) => best[position].activity.id !== steps[position].activity.id
  ).length;

  return {
    steps: optimized,
    savedMinutes: Math.max(0, before - routeMinutes(optimized)),
    movedSteps,
  };
};
