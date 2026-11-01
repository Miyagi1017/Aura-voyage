import React, { useState, useRef } from 'react';
import {
  Compass,
  UtensilsCrossed,
  Moon,
  Sun,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Star,
  Check,
  Camera,
  Compass as CompassIcon,
  Wine,
  Sparkles,
  Clock,
} from 'lucide-react';
import { DiscoveryPlace } from '../data/destinationsData';
import { ThemePalette } from '../utils/themeConfig';
import { calculateHaversineKm } from '../utils/travelLogic';
import { triggerHaptic } from '../utils/haptics';

interface DiscoveryCarouselProps {
  places: DiscoveryPlace[];
  activeDay: number;
  centerCoords: [number, number];
  currentStepCoords?: { lat: number; lng: number };
  onAddPlaceToTrip: (place: DiscoveryPlace) => void;
  onSelectPlaceForSchedule?: (place: DiscoveryPlace) => void;
  onInspectPlaceOnMap: (place: DiscoveryPlace) => void;
  theme: ThemePalette;
}

export const DiscoveryCarousel: React.FC<DiscoveryCarouselProps> = ({
  places,
  activeDay,
  centerCoords,
  currentStepCoords,
  onAddPlaceToTrip,
  onSelectPlaceForSchedule,
  onInspectPlaceOnMap,
  theme,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'day' | 'evening' | 'night'>('all');
  const [filterVibe, setFilterVibe] = useState<'all' | 'instagram' | 'offbeat' | 'secret_table' | 'speakeasy'>('all');
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredPlaces = places.filter((p) => {
    if (filterPeriod !== 'all' && p.period !== filterPeriod) return false;
    if (filterVibe === 'instagram' && p.tag !== 'instagram') return false;
    if (filterVibe === 'offbeat' && p.tag !== 'offbeat') return false;
    if (filterVibe === 'secret_table' && p.tag !== 'secret_table' && p.category !== 'food') return false;
    if (filterVibe === 'speakeasy' && p.tag !== 'speakeasy' && p.category !== 'nightlife') return false;
    return true;
  });

  const handleScroll = (direction: 'left' | 'right') => {
    triggerHaptic('hover');
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -380 : 380;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleAddClick = (place: DiscoveryPlace) => {
    if (onSelectPlaceForSchedule) {
      triggerHaptic('hover');
      onSelectPlaceForSchedule(place);
    } else {
      triggerHaptic('drop');
      onAddPlaceToTrip(place);
      setAddedIds((prev) => ({ ...prev, [place.id]: true }));
      setTimeout(() => {
        setAddedIds((prev) => {
          const copy = { ...prev };
          delete copy[place.id];
          return copy;
        });
      }, 2500);
    }
  };

  return (
    <section
      style={{
        backgroundColor: theme.bgSurface,
        borderColor: theme.border,
      }}
      className="border rounded-3xl p-4 sm:p-5 shadow-xs mb-4"
    >
      {/* Header and Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass style={{ color: theme.primary }} className="w-5 h-5" />
            <h3 style={{ color: theme.textHeading }} className="font-heading font-extrabold text-base sm:text-lg">
              Lieux Alentour & Découverte Journée / Soirée
            </h3>
          </div>
          <p style={{ color: theme.textMuted }} className="text-xs mt-0.5">
            Sélectionnez vos activités du matin, vos dîners réputés et vos sorties nocturnes pour enrichir le Jour {activeDay}
          </p>
        </div>

        {/* Carousel Arrow Controls */}
        <div className="hidden sm:flex items-center gap-1 self-end lg:self-auto">
          <button
            onClick={() => handleScroll('left')}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="p-2 rounded-xl border hover:border-black/20 transition-all cursor-pointer"
            title="Défiler vers la gauche"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="p-2 rounded-xl border hover:border-black/20 transition-all cursor-pointer"
            title="Défiler vers la droite"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Discrete Curator Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3.5 pb-1">
        {/* Period Filter */}
        <div
          style={{
            backgroundColor: theme.bgSurfaceSubtle,
            borderColor: theme.border,
          }}
          className="flex items-center p-0.5 rounded-2xl border text-xs gap-0.5"
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterPeriod('all');
            }}
            style={{
              backgroundColor: filterPeriod === 'all' ? theme.primary : 'transparent',
              color: filterPeriod === 'all' ? theme.primaryText : theme.textBody,
            }}
            className="px-2.5 py-1 rounded-xl font-medium transition-all cursor-pointer text-[11px]"
          >
            Tous ({places.length})
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterPeriod('day');
            }}
            style={{
              backgroundColor: filterPeriod === 'day' ? theme.primary : 'transparent',
              color: filterPeriod === 'day' ? theme.primaryText : theme.textBody,
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl font-medium transition-all cursor-pointer text-[11px]"
          >
            <Sun className="w-3 h-3" />
            <span>Journée</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterPeriod('evening');
            }}
            style={{
              backgroundColor: filterPeriod === 'evening' ? theme.primary : 'transparent',
              color: filterPeriod === 'evening' ? theme.primaryText : theme.textBody,
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl font-medium transition-all cursor-pointer text-[11px]"
          >
            <UtensilsCrossed className="w-3 h-3" />
            <span>Dîner</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterPeriod('night');
            }}
            style={{
              backgroundColor: filterPeriod === 'night' ? theme.primary : 'transparent',
              color: filterPeriod === 'night' ? theme.primaryText : theme.textBody,
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl font-medium transition-all cursor-pointer text-[11px]"
          >
            <Moon className="w-3 h-3" />
            <span>Nocturne</span>
          </button>
        </div>

        {/* Curation Theme Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterVibe(filterVibe === 'instagram' ? 'all' : 'instagram');
            }}
            style={{
              backgroundColor: filterVibe === 'instagram' ? '#F43F5E' : theme.bgSurfaceSubtle,
              color: filterVibe === 'instagram' ? '#FFFFFF' : theme.textBody,
              borderColor: filterVibe === 'instagram' ? '#F43F5E' : theme.border,
            }}
            className="px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap hover:border-black/20"
          >
            <Camera className="w-3 h-3" />
            <span>📸 Spots Insta</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterVibe(filterVibe === 'offbeat' ? 'all' : 'offbeat');
            }}
            style={{
              backgroundColor: filterVibe === 'offbeat' ? '#059669' : theme.bgSurfaceSubtle,
              color: filterVibe === 'offbeat' ? '#FFFFFF' : theme.textBody,
              borderColor: filterVibe === 'offbeat' ? '#059669' : theme.border,
            }}
            className="px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap hover:border-black/20"
          >
            <CompassIcon className="w-3 h-3" />
            <span>🌿 Hors sentiers battus</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterVibe(filterVibe === 'secret_table' ? 'all' : 'secret_table');
            }}
            style={{
              backgroundColor: filterVibe === 'secret_table' ? '#D97706' : theme.bgSurfaceSubtle,
              color: filterVibe === 'secret_table' ? '#FFFFFF' : theme.textBody,
              borderColor: filterVibe === 'secret_table' ? '#D97706' : theme.border,
            }}
            className="px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap hover:border-black/20"
          >
            <UtensilsCrossed className="w-3 h-3" />
            <span>🍽️ Tables d'initiés</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('hover');
              setFilterVibe(filterVibe === 'speakeasy' ? 'all' : 'speakeasy');
            }}
            style={{
              backgroundColor: filterVibe === 'speakeasy' ? '#4F46E5' : theme.bgSurfaceSubtle,
              color: filterVibe === 'speakeasy' ? '#FFFFFF' : theme.textBody,
              borderColor: filterVibe === 'speakeasy' ? '#4F46E5' : theme.border,
            }}
            className="px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap hover:border-black/20"
          >
            <Wine className="w-3 h-3" />
            <span>🍸 Bars clandestins</span>
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Viewport */}
      <div
        ref={scrollContainerRef}
        className="flex items-stretch gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar"
      >
        {filteredPlaces.length === 0 ? (
          <div
            style={{
              borderColor: theme.border,
              backgroundColor: theme.bgSurfaceSubtle,
            }}
            className="w-full text-center py-8 rounded-2xl border border-dashed text-xs text-stone-500"
          >
            Aucun lieu ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          filteredPlaces.map((place) => {
            const originLat = currentStepCoords?.lat ?? centerCoords[0];
            const originLng = currentStepCoords?.lng ?? centerCoords[1];
            const distKm = calculateHaversineKm(originLat, originLng, place.lat, place.lng);
            const isRecentlyAdded = addedIds[place.id];

            return (
              <div
                key={place.id}
                style={{
                  backgroundColor: theme.bgSurfaceSubtle,
                  borderColor: theme.border,
                }}
                className="w-[280px] sm:w-[320px] shrink-0 border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:scale-[1.01]"
              >
                {/* Card Media with Overlay */}
                <div className="relative h-36 w-full overflow-hidden bg-stone-200">
                  <img
                    src={place.image}
                    alt={place.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                  {/* Badges on Top */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {/* Discrete Curated Tag Badge */}
                      {place.tag === 'instagram' && (
                        <span className="bg-rose-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
                          📸 Insta
                        </span>
                      )}
                      {place.tag === 'offbeat' && (
                        <span className="bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
                          🌿 Secret
                        </span>
                      )}
                      {place.tag === 'secret_table' && (
                        <span className="bg-amber-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
                          🍽️ Table
                        </span>
                      )}
                      {place.tag === 'speakeasy' && (
                        <span className="bg-indigo-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
                          🍸 Speakeasy
                        </span>
                      )}

                      <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1">
                        {place.period === 'day' ? (
                          <>
                            <Sun className="w-3 h-3 text-amber-400" />
                            <span>Journée</span>
                          </>
                        ) : place.period === 'evening' ? (
                          <>
                            <UtensilsCrossed className="w-3 h-3 text-emerald-400" />
                            <span>Dîner</span>
                          </>
                        ) : (
                          <>
                            <Moon className="w-3 h-3 text-indigo-400" />
                            <span>Nuit</span>
                          </>
                        )}
                      </span>
                    </div>

                    <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{place.rating}</span>
                    </span>
                  </div>

                  {/* Bottom title inside media */}
                  <div className="absolute bottom-2 left-3 right-3 text-white">
                    <h4 className="font-heading font-bold text-sm leading-snug line-clamp-1 drop-shadow-sm">
                      {place.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-white/80 mt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <MapPin className="w-3 h-3" />
                        {distKm} km
                      </span>
                      <span>·</span>
                      <span className="font-mono">{place.recommendedTime}</span>
                      <span>·</span>
                      <span className="font-mono font-bold">{place.price === 0 ? 'Gratuit' : `${place.price} €`}</span>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                  <div>
                    <p style={{ color: theme.textBody }} className="text-xs line-clamp-2 leading-relaxed">
                      {place.description}
                    </p>

                    {place.instagramTip ? (
                      <p style={{ color: theme.primary }} className="text-[11px] font-medium mt-1.5 flex items-start gap-1 line-clamp-2">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <span><strong>Tip d'initié :</strong> {place.instagramTip}</span>
                      </p>
                    ) : (
                      <p style={{ color: theme.primary }} className="text-[11px] font-medium mt-1.5 flex items-center gap-1 line-clamp-1">
                        <span className="font-bold">Point fort :</span> {place.highlight}
                      </p>
                    )}
                  </div>

                  {/* Card CTA Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-black/5">
                    <button
                      type="button"
                      onClick={() => handleAddClick(place)}
                      style={{
                        backgroundColor: isRecentlyAdded ? '#16A34A' : theme.primary,
                        color: theme.primaryText,
                      }}
                      className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      {isRecentlyAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Ajouté !</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Planifier au Jour {activeDay}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('hover');
                        onInspectPlaceOnMap(place);
                      }}
                      style={{
                        backgroundColor: theme.bgSurface,
                        borderColor: theme.border,
                        color: theme.textHeading,
                      }}
                      className="p-1.5 border rounded-xl hover:border-black/30 transition-all cursor-pointer shrink-0"
                      title="Voir l'emplacement sur la carte interactive"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
