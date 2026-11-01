import React, { useState, useMemo } from 'react';
import {
  Clock,
  Lock,
  Unlock,
  Sparkles,
  MapPin,
  Calendar,
  X,
  Footprints,
  Check,
} from 'lucide-react';
import { DiscoveryPlace, PhotoSpot } from '../data/destinationsData';
import {
  ActivityStep,
  computeTransitBetween,
  timeToMinutes,
  minutesToTime,
} from '../utils/travelLogic';
import { ThemePalette } from '../utils/themeConfig';
import { triggerHaptic } from '../utils/haptics';

interface SchedulePickerModalProps {
  place: (DiscoveryPlace | PhotoSpot) | null;
  isOpen: boolean;
  activeDay: number;
  currentSteps: ActivityStep[];
  onConfirm: (
    place: DiscoveryPlace | PhotoSpot,
    chosenTime: string,
    isFixedTime: boolean
  ) => void;
  onClose: () => void;
  theme: ThemePalette;
}

export const SchedulePickerModal: React.FC<SchedulePickerModalProps> = ({
  place,
  isOpen,
  activeDay,
  currentSteps,
  onConfirm,
  onClose,
  theme,
}) => {
  if (!isOpen || !place) return null;

  // Calculate default optimal time based on current steps
  const suggestedTime = useMemo(() => {
    if (currentSteps.length === 0) return '09:30';

    const lastStep = currentSteps[currentSteps.length - 1];
    const lastEndMins = timeToMinutes(lastStep.time) + lastStep.durationMinutes;
    const transit = computeTransitBetween(lastStep, place);
    const startMins = lastEndMins + transit.durationMin;
    const rounded = Math.min(23 * 60 + 30, Math.ceil(startMins / 5) * 5);
    return minutesToTime(rounded);
  }, [currentSteps, place]);

  // Pre-configured slot options
  const defaultRecommended =
    'recommendedTime' in place
      ? (place as DiscoveryPlace).recommendedTime
      : 'bestTime' in place
      ? (place as PhotoSpot).bestTime.includes('18h')
        ? '18:30'
        : '10:00'
      : suggestedTime;

  const [selectedTime, setSelectedTime] = useState<string>(defaultRecommended || suggestedTime);
  const [isFixedTime, setIsFixedTime] = useState<boolean>(
    'period' in place && ((place as DiscoveryPlace).period === 'evening' || (place as DiscoveryPlace).category === 'food')
  );

  const quickSlots = [
    { label: '☀️ Matin', time: '09:30' },
    { label: '🍕 Déjeuner', time: '12:30' },
    { label: '🏛️ Après-midi', time: '15:00' },
    { label: '📸 Golden Hour', time: '18:30' },
    { label: '🍷 Dîner', time: '20:15' },
    { label: '🍸 Nuit & Bar', time: '22:15' },
    { label: `⚡ Optimale (${suggestedTime})`, time: suggestedTime },
  ];

  // Preview insertion point and transit in the timeline
  const insertionPreview = useMemo(() => {
    const targetMins = timeToMinutes(selectedTime);
    let prevStep: ActivityStep | null = null;
    let nextStep: ActivityStep | null = null;

    for (let i = 0; i < currentSteps.length; i++) {
      const stepMins = timeToMinutes(currentSteps[i].time);
      if (stepMins <= targetMins) {
        prevStep = currentSteps[i];
      } else if (!nextStep && stepMins > targetMins) {
        nextStep = currentSteps[i];
      }
    }

    let transitFromPrev: { durationMin: number; distanceKm: number } | null = null;
    if (prevStep) {
      transitFromPrev = computeTransitBetween(prevStep, place);
    }

    return {
      prevStep,
      nextStep,
      transitFromPrev,
    };
  }, [selectedTime, currentSteps, place]);

  const handleConfirm = () => {
    triggerHaptic('drop');
    onConfirm(place, selectedTime, isFixedTime);
    onClose();
  };

  const isDiscovery = 'category' in place;
  const placeImage = place.image;
  const placeName = place.name;
  const placeVibe = place.vibe;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        style={{
          backgroundColor: theme.bgSurface,
          borderColor: theme.border,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        }}
        className="w-full max-w-lg rounded-3xl border overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-stone-900 shrink-0">
          <img
            src={placeImage}
            alt={placeName}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <button
            onClick={() => {
              triggerHaptic('cancel');
              onClose();
            }}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-all cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
              Jour {activeDay} · Planification d'horaire
            </span>
            <h3 className="font-heading font-extrabold text-base sm:text-lg leading-tight truncate">
              {placeName}
            </h3>
            {placeVibe && (
              <p className="text-white/80 text-xs truncate mt-0.5">{placeVibe}</p>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Quick Slot Grid */}
          <div>
            <label
              style={{ color: theme.textHeading }}
              className="text-xs font-bold font-heading mb-2 flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" style={{ color: theme.primary }} />
              <span>Créneaux suggérés pour cette étape :</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {quickSlots.map((slot) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => {
                      triggerHaptic('hover');
                      setSelectedTime(slot.time);
                    }}
                    style={{
                      backgroundColor: isSelected ? theme.primary : theme.bgSurfaceSubtle,
                      borderColor: isSelected ? theme.borderActive : theme.border,
                      color: isSelected ? theme.primaryText : theme.textHeading,
                    }}
                    className="p-2 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer flex flex-col hover:border-black/30"
                  >
                    <span className="truncate">{slot.label}</span>
                    <span
                      style={{ color: isSelected ? theme.primaryText : theme.textMuted }}
                      className="text-[11px] font-mono mt-0.5"
                    >
                      {slot.time}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Time Selector & Fixed Milestone Toggle */}
          <div
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
            }}
            className="p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <span style={{ color: theme.textHeading }} className="font-bold">
                Heure exacte :
              </span>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                style={{
                  backgroundColor: theme.bgSurface,
                  borderColor: theme.border,
                  color: theme.textHeading,
                }}
                className="px-2.5 py-1.5 rounded-xl border font-mono font-bold text-xs focus:outline-hidden"
              />
            </div>

            {/* Fixed milestone toggle */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('hover');
                setIsFixedTime(!isFixedTime);
              }}
              style={{
                backgroundColor: isFixedTime ? theme.badgeBg : theme.bgSurface,
                borderColor: isFixedTime ? theme.borderActive : theme.border,
                color: isFixedTime ? theme.primary : theme.textMuted,
              }}
              className="px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto font-medium"
              title="Un horaire fixe ne sera jamais déplacé lors de l'optimisation automatique du trajet"
            >
              {isFixedTime ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-bold text-amber-900">Horaire fixe 🔒</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Horaire flexible 🔓</span>
                </>
              )}
            </button>
          </div>

          {/* Insertion Timeline Preview */}
          <div
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
            }}
            className="p-3 rounded-2xl border text-xs space-y-1.5"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider font-mono text-stone-500">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Calcul d'insertion & Trajet</span>
            </div>

            {insertionPreview.prevStep ? (
              <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                <span style={{ color: theme.textMuted }}>
                  S'insère après : <strong style={{ color: theme.textHeading }}>{insertionPreview.prevStep.name}</strong>
                </span>
                {insertionPreview.transitFromPrev && (
                  <span
                    style={{
                      backgroundColor: theme.bgSurface,
                      borderColor: theme.border,
                      color: theme.primary,
                    }}
                    className="px-2 py-0.5 rounded-lg border font-mono font-bold flex items-center gap-1"
                  >
                    <Footprints className="w-3 h-3" />
                    ~{insertionPreview.transitFromPrev.durationMin} min ({insertionPreview.transitFromPrev.distanceKm} km)
                  </span>
                )}
              </div>
            ) : (
              <p style={{ color: theme.textMuted }} className="text-[11px]">
                S'insère comme <strong>première étape</strong> de la journée à {selectedTime}.
              </p>
            )}

            <p style={{ color: theme.textMuted }} className="text-[10px] italic pt-1">
              {isFixedTime
                ? 'ℹ️ Étape verrouillée : l’optimiseur de trajet préservera cet horaire exact.'
                : 'ℹ️ Étape flexible : pourra être réorganisée par l’optimiseur pour réduire vos temps de marche.'}
            </p>
          </div>
        </div>

        {/* Modal Footer Buttons */}
        <div
          style={{
            backgroundColor: theme.bgSurface,
            borderColor: theme.border,
          }}
          className="p-3.5 border-t flex items-center justify-end gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic('cancel');
              onClose();
            }}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="px-4 py-2 rounded-xl border text-xs font-semibold hover:border-black/30 transition-all cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            style={{
              backgroundColor: theme.primary,
              color: theme.primaryText,
              boxShadow: `0 4px 14px ${theme.accentGlow}`,
            }}
            className="px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>Valider & Intégrer au Jour {activeDay}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
