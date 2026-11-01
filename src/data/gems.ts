import { Activity } from '../types/travel';
import { isInstagrammable } from './guided-tours';

export type GemKind = 'photo' | 'table' | 'sortie' | 'hors-sentiers' | 'instagram';

const LABELS: Record<GemKind, string> = {
  photo: 'Spot photo',
  table: 'Table locale',
  sortie: 'Sortie',
  'hors-sentiers': 'Hors sentiers',
  instagram: 'Instagrammable',
};

/**
 * Sélection éditoriale volontairement courte : les adresses qui valent
 * le détour, sans transformer Explorer en annuaire.
 */
const PICKS: Record<string, GemKind> = {
  'rec-1': 'table',
  'rec-2': 'photo',
  'rec-3': 'hors-sentiers',
  'rec-4': 'table',
  'rec-night-1': 'sortie',
  'rec-night-4': 'sortie',
  'rec-night-5': 'sortie',
};

/** Étiquette discrète d'un lieu, ou null si ce n'est pas une pépite. */
export const gemKind = (activity: Activity): GemKind | null => {
  const pick = PICKS[activity.id];
  if (pick) return pick;
  return isInstagrammable(activity) ? 'instagram' : null;
};

export const gemLabel = (kind: GemKind): string => LABELS[kind];
