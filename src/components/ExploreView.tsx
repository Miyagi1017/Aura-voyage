import React, { useEffect, useState } from 'react';
import {
  Search,
  MapPin,
  Plus,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Activity, ActivityCategory } from '../types/travel';
import { POPULAR_RECOMMENDATIONS } from '../data/mock-data';
import { activityMatchesInterests } from '../data/interests';
import { formatDistance, haversineKm } from '../data/geo';
import { compareTime, timeToMinutes } from '../data/time';
import { getLocalCurrency, localEquivalent } from '../data/currency';
import { gemKind, gemLabel } from '../data/gems';
import { SafeImage } from './SafeImage';
import { ActivityTimeModal } from './ActivityTimeModal';
import { TimeField } from './TimeField';

interface ExploreViewProps {
  onAddActivityToTrip: (activity: Activity) => void;
  onFocusOnMap: (activity: Activity) => void;
  onAskAIAboutActivity: (name: string) => void;
  onOpenComparator?: (activity: Activity) => void;
  onToggleWishlist?: (activity: Activity) => void;
  wishlistIds?: string[];
  addedActivityIds: string[];
  destination?: string;
  dates?: string;
  travelers?: number;
  interests?: string[];
  onEditDates?: () => void;
  /** Valide les filtres et déclenche le recalcul des trajets du séjour. */
  onValidateChoices?: (count: number) => void;
  /** Position enregistrée (GPS ou manuelle) pour le filtre « Autour de moi ». */
  position?: [number, number];
  positionLabel?: string;
  center?: [number, number];
}

const TIME_SLOTS = [
  { id: 'morning', label: 'Matin', start: '06:00', end: '12:00' },
  { id: 'lunch', label: 'Déjeuner', start: '12:00', end: '15:00' },
  { id: 'afternoon', label: 'Après-midi', start: '15:00', end: '18:00' },
  { id: 'dinner', label: 'Dîner', start: '18:00', end: '21:00' },
  { id: 'night', label: 'Soirée', start: '21:00', end: '02:00' },
];

export const ExploreView: React.FC<ExploreViewProps> = ({
  onAddActivityToTrip,
  onFocusOnMap,
  onAskAIAboutActivity,
  onOpenComparator,
  onToggleWishlist,
  wishlistIds = [],
  addedActivityIds,
  destination = 'Rome',
  dates = '14 - 17 Nov.',
  travelers = 2,
  interests = [],
  onEditDates,
  onValidateChoices,
  position,
  positionLabel,
  center,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | 'Tous'>('Tous');
  const [maxBudget, setMaxBudget] = useState<number | null>(null);
  const [onlyInterests, setOnlyInterests] = useState(false);
  const [onlyGems, setOnlyGems] = useState(false);
  const [validatedCount, setValidatedCount] = useState<number | null>(null);
  const [isDestinationOpen, setIsDestinationOpen] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<{ start: string; end: string } | null>(null);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [pendingTimeActivity, setPendingTimeActivity] = useState<Activity | null>(null);
  const localCurrency = getLocalCurrency(destination);

  useEffect(() => {
    setValidatedCount(null);
  }, [selectedCategory, maxBudget, onlyInterests, onlyGems, searchQuery, distanceKm, timeFilter]);

  const matchesTimeRange = (time: string) => {
    if (!timeFilter) return true;
    const { start, end } = timeFilter;
    const startMinutes = start ? timeToMinutes(start) : null;
    const endMinutes = end ? timeToMinutes(end) : null;
    const minutes = timeToMinutes(time);

    // Aucune borne : tout est accepté.
    if (startMinutes == null && endMinutes == null) return true;
    if (startMinutes == null) return minutes <= (endMinutes as number);
    if (endMinutes == null) return minutes >= startMinutes;
    return startMinutes <= endMinutes
      ? minutes >= startMinutes && minutes <= endMinutes
      : minutes >= startMinutes || minutes <= endMinutes;
  };

  const referencePoint: [number, number] = position ?? center ?? [41.8902, 12.4922];
  const referenceLabel = position ? positionLabel ?? 'ma position' : `${destination} centre`;

  const distanceTo = (item: Activity): number | null =>
    typeof item.lat === 'number' && typeof item.lng === 'number'
      ? haversineKm(referencePoint, [item.lat, item.lng])
      : null;

  const categories: { label: ActivityCategory | 'Tous' }[] = [
    { label: 'Tous' },
    { label: 'Gastronomie' },
    { label: 'Culture' },
    { label: 'Nature' },
    { label: 'Insolite' },
    { label: 'Vie nocturne' },
  ];

  const search = searchQuery.trim().toLowerCase();

  const filtered = POPULAR_RECOMMENDATIONS.filter((item) => {
    const matchesCategory = selectedCategory === 'Tous' || item.category === selectedCategory;
    const matchesSearch =
      search.length === 0 ||
      item.name.toLowerCase().includes(search) ||
      item.address.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search);
    const matchesBudget = maxBudget === null || item.price <= maxBudget;
    const matchesGem = !onlyGems || gemKind(item) !== null;
    const matchesInterests =
      !onlyInterests || interests.length === 0 || activityMatchesInterests(item, interests);
    const itemDistance = distanceTo(item);
    const matchesDistance =
      distanceKm == null || (itemDistance != null && itemDistance <= distanceKm);
    const matchesTime = matchesTimeRange(item.time);
    return (
      matchesCategory &&
      matchesSearch &&
      matchesBudget &&
      matchesGem &&
      matchesInterests &&
      matchesDistance &&
      matchesTime
    );
  });

  // Toutes les activités disponibles, classées par horaire (menu destination).
  const destinationOptions = [...POPULAR_RECOMMENDATIONS]
    .filter(
      (item) =>
        (search.length === 0 ||
          item.name.toLowerCase().includes(search) ||
          item.address.toLowerCase().includes(search)) &&
        matchesTimeRange(item.time)
    )
    .sort((a, b) => compareTime(a.time, b.time));

  // Activités classées par horaire, pour visualiser celles qui suivent.
  const chronological = [...filtered].sort((a, b) => compareTime(a.time, b.time));

  return (
    <div className="space-y-6">
      {/* Recherche & filtres */}
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-5 max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Explorer
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            Des adresses pour votre voyage
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Lieux vérifiés, expériences locales et coups de cœur à {destination}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDestinationOpen(true);
              }}
              onFocus={() => setIsDestinationOpen(true)}
              placeholder="Destination, monument, quartier..."
              className="w-full rounded-xl border border-line bg-paper py-3 pl-10 pr-12 text-sm font-medium text-ink placeholder:text-muted/80 focus:border-line-strong focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/5"
            />
            <button
              type="button"
              onClick={() => setIsDestinationOpen((prev) => !prev)}
              aria-expanded={isDestinationOpen}
              aria-label="Afficher toutes les activités disponibles"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-white hover:text-ink"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isDestinationOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isDestinationOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsDestinationOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-xl">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Toutes les activités
                    {timeFilter
                      ? ` · ${timeFilter.start || 'sans limite'} – ${timeFilter.end || 'sans limite'}`
                      : ''}{' '}
                    · classées par horaire
                  </p>

                  {destinationOptions.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-muted">
                      Aucune activité ne correspond à cette recherche.
                    </p>
                  )}

                  {destinationOptions.map((item) => {
                    const itemDistance = distanceTo(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSearchQuery(item.name);
                          setIsDestinationOpen(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-paper"
                      >
                        <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold text-muted">
                          {item.category}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-ink">
                            {item.name}
                          </span>
                          <span className="block truncate text-[10px] text-muted">
                            {itemDistance != null
                              ? `${formatDistance(itemDistance)} de ${referenceLabel}`
                              : item.address}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onEditDates}
            disabled={!onEditDates}
            title="Modifier les dates et le nombre de voyageurs"
            className="group flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-3 text-left text-sm text-ink-soft transition-colors hover:border-accent/40 hover:bg-white disabled:cursor-default disabled:hover:border-line disabled:hover:bg-paper"
          >
            <span className="truncate">{dates}</span>
          </button>

          <button
            type="button"
            onClick={onEditDates}
            disabled={!onEditDates}
            title="Modifier le nombre de voyageurs"
            className="group flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-3 text-left text-sm text-ink-soft transition-colors hover:border-accent/40 hover:bg-white disabled:cursor-default disabled:hover:border-line disabled:hover:bg-paper"
          >
            <span>
              {travelers} voyageur{travelers > 1 ? 's' : ''}
            </span>
          </button>
        </div>

        {/* Catégories */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setSelectedCategory(cat.label)}
              aria-pressed={selectedCategory === cat.label}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ${
                selectedCategory === cat.label
                  ? 'bg-ink text-white shadow-xs'
                  : 'border border-line bg-white text-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}

          <button
            onClick={() => setOnlyInterests((prev) => !prev)}
            aria-pressed={onlyInterests}
            title="Filtrer selon les centres d'intérêt du profil"
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
              onlyInterests
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-line bg-white text-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            {onlyInterests ? 'Mes envies ✓' : 'Mes envies'}
            {interests.length > 0 && (
              <span className="rounded-full bg-white/70 px-1.5 text-[10px] text-ink-soft">
                {interests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setOnlyGems((prev) => !prev)}
            aria-pressed={onlyGems}
            title="Spots photo, tables locales, sorties et adresses hors des sentiers battus"
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
              onlyGems
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-white text-muted hover:text-ink'
            }`}
          >
            {onlyGems ? 'Pépites ✓' : 'Pépites'}
          </button>

          <button
            onClick={() => setMaxBudget(maxBudget === 20 ? null : 20)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold ${
              maxBudget === 20
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-line bg-white text-muted hover:text-ink'
            }`}
          >
            {maxBudget === 20 ? 'Budget ≤ 20 € ✓' : 'Budget ≤ 20 €'}
          </button>
        </div>

        {/* Filtre de proximité */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2.5">
          <button
            type="button"
            onClick={() => setDistanceKm(distanceKm == null ? 3 : null)}
            aria-pressed={distanceKm != null}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
              distanceKm != null
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-line bg-white text-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            Autour de moi
          </button>

          {distanceKm != null &&
            [1, 3, 5, 10, 25].map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setDistanceKm(km)}
                aria-pressed={distanceKm === km}
                className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  distanceKm === km
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-white text-ink-soft hover:border-line-strong'
                }`}
              >
                {km} km
              </button>
            ))}

          <span className="ml-auto text-[10px] text-muted">
            {distanceKm != null
              ? `Périmètre ${distanceKm} km · ${referenceLabel}`
              : `Référence : ${referenceLabel}`}
          </span>
        </div>

        {/* Tranche horaire */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Tranche horaire
          </span>

          <button
            type="button"
            onClick={() => {
              setTimeFilter(null);
              setIsCustomTime(false);
            }}
            aria-pressed={!timeFilter}
            className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              !timeFilter
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-ink-soft hover:border-line-strong'
            }`}
          >
            Sans limite
          </button>

          {TIME_SLOTS.map((slot) => {
            const active =
              timeFilter?.start === slot.start && timeFilter?.end === slot.end;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => {
                  setIsCustomTime(false);
                  setTimeFilter(active ? null : { start: slot.start, end: slot.end });
                }}
                aria-pressed={active}
                className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-white text-ink-soft hover:border-line-strong'
                }`}
              >
                {slot.label} · {slot.start}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setIsCustomTime((prev) => {
                const next = !prev;
                if (next && !timeFilter) setTimeFilter({ start: '18:00', end: '23:00' });
                return next;
              });
            }}
            aria-pressed={isCustomTime}
            className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              isCustomTime
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-white text-ink-soft hover:border-line-strong'
            }`}
          >
            Personnalisée
          </button>

          {isCustomTime && (
            <span className="inline-flex items-center gap-1">
              <TimeField
                value={timeFilter?.start ?? ''}
                onChange={(value) =>
                  setTimeFilter({ start: value, end: timeFilter?.end ?? '' })
                }
                ariaLabel="Début de la tranche horaire (vide = sans limite)"
                placeholder="Début"
                allowEmpty
                compact
              />
              <span className="text-[10px] text-muted">→</span>
              <TimeField
                value={timeFilter?.end ?? ''}
                onChange={(value) =>
                  setTimeFilter({ start: timeFilter?.start ?? '', end: value })
                }
                ariaLabel="Fin de la tranche horaire (vide = sans limite)"
                placeholder="Fin"
                allowEmpty
                compact
              />
              <span className="text-[10px] text-muted">vide = sans limite</span>
            </span>
          )}
        </div>

        {/* Validation des filtres + recalcul */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
          <p className="text-[11px] text-muted">
            <strong className="font-semibold text-ink-soft">{filtered.length}</strong> adresse
            {filtered.length > 1 ? 's' : ''} correspond
            {filtered.length > 1 ? 'ent' : ''} à vos choix.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {validatedCount != null && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                Choix validés · {validatedCount} adresse{validatedCount > 1 ? 's' : ''} · trajets
                recalculés
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setValidatedCount(filtered.length);
                onValidateChoices?.(filtered.length);
              }}
              className="cursor-pointer rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
            >
              Valider et recalculer
            </button>
          </div>
        </div>
      </div>

      {/* Grille de recommandations */}
      <div>
        <div className="mb-4 flex items-end justify-between gap-3 px-1">
          <div>
            <h3 className="font-serif text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {searchQuery.trim() ? `Résultats pour « ${searchQuery.trim()} »` : 'Suggestions pour vous'}
            </h3>
            <p className="mt-0.5 text-[13px] text-muted">
              {filtered.length} adresse{filtered.length > 1 ? 's' : ''} vérifiée
              {filtered.length > 1 ? 's' : ''} à {destination} · classées par horaire
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-muted sm:flex">
            Sélection Odyssée
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center">
              <p className="text-sm font-semibold text-ink">Aucune adresse ne correspond</p>
              <p className="mt-1 text-xs text-muted">
                Essayez sans les filtres « Mes envies » ou « Pépites », ou élargissez votre
                recherche.
              </p>
              <button
                onClick={() => {
                  setOnlyInterests(false);
                  setOnlyGems(false);
                  setSelectedCategory('Tous');
                  setMaxBudget(null);
                  setSearchQuery('');
                }}
                className="mt-3 cursor-pointer rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}

          {chronological.map((item, index) => {
            const isAdded = addedActivityIds.includes(item.id);
            const gem = gemKind(item);
            const nextItem = chronological[index + 1];
            return (
              <article
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-xs transition-all hover:border-line-strong hover:shadow-md"
              >
                <div className="relative h-44 w-full overflow-hidden bg-paper-deep">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    icon={<MapPin className="h-6 w-6 text-ink/20" aria-hidden="true" />}
                  />
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent" />

                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink backdrop-blur-sm">
                    {item.category}
                  </span>

                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    {gem && (
                      <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-accent shadow-xs backdrop-blur-sm">
                        {gemLabel(gem)}
                      </span>
                    )}

                    {item.rating && (
                      <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink shadow-xs backdrop-blur-sm">
                        {item.rating} / 5
                      </span>
                    )}

                    {onToggleWishlist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWishlist(item);
                        }}
                        title={wishlistIds.includes(item.id) ? "Retirer de ma liste d'envies" : "Ajouter à ma liste d'envies"}
                        aria-label={wishlistIds.includes(item.id) ? "Retirer de ma liste d'envies" : "Ajouter à ma liste d'envies"}
                        aria-pressed={wishlistIds.includes(item.id)}
                        className={`rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-xs backdrop-blur-sm ${
                          wishlistIds.includes(item.id) ? 'text-rose-600' : 'text-ink-soft'
                        }`}
                      >
                        {wishlistIds.includes(item.id) ? 'Gardé' : 'Garder'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h4 className="font-serif text-lg font-semibold leading-snug text-ink">
                      {item.name}
                    </h4>
                    <p className="mt-1 truncate text-[11px] text-muted">{item.address}</p>
                    <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-ink-soft/90">
                      {item.description}
                    </p>

                    {nextItem && (
                      <p className="mt-2 text-[10px] leading-relaxed text-muted">
                        <span className="text-accent">→</span> Ensuite :{' '}
                        <span className="font-semibold text-ink-soft">{nextItem.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                    <div>
                      {onOpenComparator ? (
                        <button
                          onClick={() => onOpenComparator(item)}
                          className="group/price text-left"
                          title="Comparer les prix"
                        >
                          <span className="block text-sm font-semibold text-ink">
                            {item.price > 0 ? `${item.price} €` : 'Gratuit'}
                          </span>
                          <span className="block text-[10px] font-medium text-accent underline decoration-accent/30 underline-offset-2 group-hover/price:decoration-accent">
                            Comparer les prix
                          </span>
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-ink">
                          {item.price > 0 ? `${item.price} €` : 'Gratuit'}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[10px] text-muted">{item.duration}</span>
                      {localCurrency.code !== 'EUR' && item.price > 0 && (
                        <span className="mt-0.5 block text-[10px] font-medium text-muted">
                          ≈ {localEquivalent(item.price, localCurrency.code)} sur place
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <a
                        href={
                          item.googleMapsUrl ||
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        title="Ouvrir dans Google Maps"
                        aria-label="Ouvrir dans Google Maps"
                        className="flex h-8 items-center justify-center rounded-full border border-line px-2.5 text-[11px] font-semibold text-ink-soft hover:border-line-strong hover:bg-paper"
                      >
                        Y aller
                      </a>

                      <button
                        onClick={() => onAskAIAboutActivity(item.name)}
                        title="Demander des détails au concierge"
                        className="flex h-8 items-center justify-center rounded-full border border-line px-2.5 text-[11px] font-semibold text-ink-soft hover:border-line-strong hover:bg-paper"
                      >
                        Conseil
                      </button>

                      <button
                        onClick={() => onFocusOnMap(item)}
                        className="flex h-8 items-center justify-center rounded-full border border-line px-2.5 text-[11px] font-semibold text-ink-soft hover:border-line-strong hover:bg-paper"
                      >
                        Carte
                      </button>

                      <button
                        onClick={() => setPendingTimeActivity(item)}
                        disabled={isAdded}
                        className={`flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold ${
                          isAdded
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-ink text-white hover:bg-ink-soft'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Ajouté</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" />
                            <span>Ajouter</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="mt-4 rounded-[24px] border border-dashed border-line-strong bg-white/70 p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper text-muted">
              <Search className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Aucun résultat</p>
            <p className="mt-1 text-xs text-muted">
              Essayez une autre catégorie ou élargissez votre budget.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Tous');
                setMaxBudget(null);
              }}
              className="mt-4 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink-soft"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      <ActivityTimeModal
        isOpen={!!pendingTimeActivity}
        activity={pendingTimeActivity}
        slot={timeFilter}
        onClose={() => setPendingTimeActivity(null)}
        onConfirm={(time) => {
          if (pendingTimeActivity) {
            onAddActivityToTrip({ ...pendingTimeActivity, time });
          }
          setPendingTimeActivity(null);
        }}
      />
    </div>
  );
};
