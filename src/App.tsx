import React, { useState, useMemo, useEffect } from 'react';
import {
  Compass,
  MapPin,
  Calendar,
  Sparkles,
  AlertTriangle,
  Zap,
  Coins,
  Sun,
  ChevronDown,
  Camera,
  BookOpen,
  Share2,
  Check,
  Palette,
  X,
  RotateCcw,
  Columns,
  Minimize2,
} from 'lucide-react';
import { DESTINATIONS, Destination, PhotoSpot, DiscoveryPlace } from './data/destinationsData';
import {
  ActivityStep,
  detectDayConflicts,
  resolveDayConflicts,
  calculateDayMetrics,
  moveStepBetweenDays,
  reorderStepWithinDay,
  computeTransitBetween,
  optimizeDayRoute,
  timeToMinutes,
  minutesToTime,
} from './utils/travelLogic';
import { triggerHaptic } from './utils/haptics';
import { LIGHT_THEMES, ThemePalette } from './utils/themeConfig';
import { AuraTimeline } from './components/AuraTimeline';
import { CornerInteractiveMap } from './components/CornerInteractiveMap';
import { DiscoveryCarousel } from './components/DiscoveryCarousel';
import { AuraConcierge } from './components/AuraConcierge';
import { BudgetFlightDeck } from './components/BudgetFlightDeck';
import { LocalIntelModal } from './components/LocalIntelModal';
import { SchedulePickerModal } from './components/SchedulePickerModal';
import { RecommendedPlace } from './api/chatService';

interface HistorySnapshot {
  description: string;
  tripsState: Record<string, Record<number, ActivityStep[]>>;
  activeDayIndex: number;
  timestamp: number;
}

export default function App() {
  // Color Themes State (5 curated light themes)
  const [currentThemeId, setCurrentThemeId] = useState<string>('regal_twilight_light');
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const currentTheme: ThemePalette = useMemo(() => {
    return LIGHT_THEMES[currentThemeId] || LIGHT_THEMES.regal_twilight_light;
  }, [currentThemeId]);

  // Destination selection
  const [selectedDestId, setSelectedDestId] = useState<string>('rome');
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);

  // Active destination data
  const destination = DESTINATIONS[selectedDestId] || DESTINATIONS.rome;

  // Active day index (0 for Day 1, 1 for Day 2...)
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);

  // Mutable schedule state per destination and day
  const [tripsState, setTripsState] = useState<Record<string, Record<number, ActivityStep[]>>>(() => {
    const initial: Record<string, Record<number, ActivityStep[]>> = {};
    Object.values(DESTINATIONS).forEach((dest) => {
      initial[dest.id] = {};
      dest.days.forEach((day, idx) => {
        initial[dest.id][idx] = [...day.steps];
      });
    });
    return initial;
  });

  // Undo History Stack
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [undoToast, setUndoToast] = useState<{ message: string; timestamp: number } | null>(null);

  const pushUndoSnapshot = (description: string) => {
    setUndoStack((prev) => [
      {
        description,
        tripsState: JSON.parse(JSON.stringify(tripsState)),
        activeDayIndex,
        timestamp: Date.now(),
      },
      ...prev.slice(0, 14),
    ]);
    setUndoToast({ message: description, timestamp: Date.now() });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [latest, ...remaining] = undoStack;
    setUndoStack(remaining);
    setTripsState(latest.tripsState);
    setActiveDayIndex(latest.activeDayIndex);
    triggerHaptic('resolve');
    setUndoToast(null);
    setToastNotification(`Annulé : ${latest.description}`);
    setTimeout(() => setToastNotification(null), 3000);
  };

  // Global Ctrl+Z / Cmd+Z Keyboard Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, tripsState, activeDayIndex]);

  // Auto-dismiss undo toast after 6 seconds
  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => {
      setUndoToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  // Budget envelope state per destination
  const [budgetsState, setBudgetsState] = useState<Record<string, number>>(() => {
    const b: Record<string, number> = {};
    Object.values(DESTINATIONS).forEach((d) => {
      b[d.id] = d.defaultBudget;
    });
    return b;
  });

  const [travelersCount, setTravelersCount] = useState<number>(2);

  // UI Modals, Drawers & Map State
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [inspectedPlace, setInspectedPlace] = useState<DiscoveryPlace | null>(null);
  const [mapOpen, setMapOpen] = useState<boolean>(false);
  const [mapDockPosition, setMapDockPosition] = useState<'corner' | 'left-pane'>('corner');

  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [intelModalOpen, setIntelModalOpen] = useState(false);
  const [showPhotoSpots, setShowPhotoSpots] = useState(true);
  const [copiedShare, setCopiedShare] = useState(false);
  const [scheduleModalPlace, setScheduleModalPlace] = useState<(DiscoveryPlace | PhotoSpot) | null>(null);
  const [optimizationSavings, setOptimizationSavings] = useState<{ distanceSavedKm: number; timeSavedMinutes: number } | null>(null);

  // Drag and Drop between Days state
  const [isDraggingActive, setIsDraggingActive] = useState(false);
  const [hoveredDayDropIdx, setHoveredDayDropIdx] = useState<number | null>(null);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Current day steps
  const currentSteps = useMemo(() => {
    return tripsState[selectedDestId]?.[activeDayIndex] || [];
  }, [tripsState, selectedDestId, activeDayIndex]);

  // Detected conflicts for active day
  const activeConflicts = useMemo(() => {
    return detectDayConflicts(currentSteps);
  }, [currentSteps]);

  // Aggregate metrics across the entire trip
  const currentTripMetrics = useMemo(() => {
    const daysData = tripsState[selectedDestId] || {};
    let totalCost = 0;
    let totalKm = 0;
    let totalStepsCount = 0;

    Object.values(daysData).forEach((steps) => {
      const m = calculateDayMetrics(steps);
      totalCost += m.totalCost;
      totalKm += m.totalWalkingKm;
      totalStepsCount += m.activityCount;
    });

    return {
      totalCost,
      totalKm: Math.round(totalKm * 10) / 10,
      totalStepsCount,
    };
  }, [tripsState, selectedDestId]);

  const activeDayMetrics = useMemo(() => {
    return calculateDayMetrics(currentSteps);
  }, [currentSteps]);

  // Handlers for step updates
  const handleUpdateStep = (updated: ActivityStep) => {
    pushUndoSnapshot(`Modification d'étape : ${updated.name}`);
    setTripsState((prev) => {
      const currentDayList = [...(prev[selectedDestId]?.[activeDayIndex] || [])];
      const idx = currentDayList.findIndex((s) => s.id === updated.id);
      if (idx !== -1) {
        currentDayList[idx] = updated;
      }
      return {
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: currentDayList,
        },
      };
    });
  };

  const handleDeleteStep = (stepId: string) => {
    const stepToDelete = currentSteps.find((s) => s.id === stepId);
    pushUndoSnapshot(`Suppression de « ${stepToDelete?.name || 'étape'} »`);

    setTripsState((prev) => {
      const currentDayList = (prev[selectedDestId]?.[activeDayIndex] || []).filter(
        (s) => s.id !== stepId
      );
      // Recalculate transit
      for (let i = 0; i < currentDayList.length; i++) {
        if (i < currentDayList.length - 1) {
          currentDayList[i].transitToNext = computeTransitBetween(currentDayList[i], currentDayList[i + 1]);
        } else {
          currentDayList[i].transitToNext = undefined;
        }
      }
      return {
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: currentDayList,
        },
      };
    });
    if (selectedStepId === stepId) setSelectedStepId(null);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    handleReorderSteps(index, targetIdx);
  };

  const handleReorderSteps = (sourceIdx: number, targetIdx: number) => {
    pushUndoSnapshot('Réorganisation de la timeline');
    setTripsState((prev) => {
      const dayList = prev[selectedDestId]?.[activeDayIndex] || [];
      const reordered = reorderStepWithinDay(dayList, sourceIdx, targetIdx);
      return {
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: reordered,
        },
      };
    });
  };

  // Cross-Day Transfer Handler
  const handleMoveStepToDay = (stepId: string, targetDayIdx: number) => {
    if (targetDayIdx === activeDayIndex) return;

    const step = currentSteps.find((s) => s.id === stepId);
    pushUndoSnapshot(`Transfert de « ${step?.name || 'étape'} » vers Jour ${targetDayIdx + 1}`);

    setTripsState((prev) => {
      const currentDayList = prev[selectedDestId]?.[activeDayIndex] || [];
      const targetDayList = prev[selectedDestId]?.[targetDayIdx] || [];

      const { newSourceSteps, newTargetSteps, movedStep } = moveStepBetweenDays(
        currentDayList,
        targetDayList,
        stepId,
        targetDayIdx + 1
      );

      if (movedStep) {
        setToastNotification(`Étape « ${movedStep.name} » déplacée au Jour ${targetDayIdx + 1}`);
        setTimeout(() => setToastNotification(null), 3500);
      }

      return {
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: newSourceSteps,
          [targetDayIdx]: newTargetSteps,
        },
      };
    });

    setActiveDayIndex(targetDayIdx);
    setSelectedStepId(stepId);
    triggerHaptic('drop');
  };

  // Drop on Day Tab handler
  const handleDropOnDayTab = (e: React.DragEvent, targetDayIdx: number) => {
    e.preventDefault();
    setHoveredDayDropIdx(null);
    setIsDraggingActive(false);

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.stepId) {
        handleMoveStepToDay(data.stepId, targetDayIdx);
      }
    } catch (err) {
      console.warn('Drag data parse error:', err);
    }
  };

  const handleAddStep = (newStep: ActivityStep) => {
    pushUndoSnapshot(`Création d'étape : ${newStep.name}`);
    setTripsState((prev) => {
      const currentDayList = [...(prev[selectedDestId]?.[activeDayIndex] || []), newStep];
      // Recalculate transits
      for (let i = 0; i < currentDayList.length - 1; i++) {
        currentDayList[i].transitToNext = computeTransitBetween(currentDayList[i], currentDayList[i + 1]);
      }
      return {
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: currentDayList,
        },
      };
    });
    setSelectedStepId(newStep.id);
  };

  // Add Place from Discovery Carousel (Day / Evening / Nightlife)
  const handleAddPlaceFromDiscovery = (place: DiscoveryPlace) => {
    pushUndoSnapshot(`Ajout de « ${place.name} »`);

    // Smart time insertion: place daytime in morning/afternoon, dinner at 19:30, nightlife at 22:00
    let plannedTime = place.recommendedTime;
    if (currentSteps.length > 0) {
      const lastStep = currentSteps[currentSteps.length - 1];
      const lastEndMins = timeToMinutes(lastStep.time) + lastStep.durationMinutes;
      const recMins = timeToMinutes(place.recommendedTime);
      const startMins = Math.max(recMins, lastEndMins + 20);
      plannedTime = minutesToTime(Math.min(23 * 60 + 30, Math.ceil(startMins / 5) * 5));
    }

    const newStep: ActivityStep = {
      id: `step-disc-${Date.now()}`,
      day: activeDayIndex + 1,
      name: place.name,
      time: plannedTime,
      durationMinutes: place.estimatedDurationMin,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      category: place.category as any,
      price: place.price,
      description: place.description,
      tips: place.highlight,
      image: place.image,
    };

    setTripsState((prev) => {
      const list = [...(prev[selectedDestId]?.[activeDayIndex] || []), newStep];
      // compute transits
      for (let i = 0; i < list.length - 1; i++) {
        list[i].transitToNext = computeTransitBetween(list[i], list[i + 1]);
      }
      return {
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: list,
        },
      };
    });

    setSelectedStepId(newStep.id);
    setInspectedPlace(null);
    setToastNotification(`« ${place.name} » ajouté au Jour ${activeDayIndex + 1}`);
    setTimeout(() => setToastNotification(null), 3000);
  };

  // Add Place or Photo Spot with chosen schedule & recalculated transits
  const handleAddPlaceWithSchedule = (
    place: DiscoveryPlace | PhotoSpot,
    chosenTime: string,
    isFixedTime: boolean
  ) => {
    pushUndoSnapshot(`Ajout de « ${place.name} » à ${chosenTime}`);

    const isDiscovery = 'category' in place;
    const newStep: ActivityStep = {
      id: `step-${Date.now()}`,
      day: activeDayIndex + 1,
      name: place.name,
      time: chosenTime,
      durationMinutes: isDiscovery ? (place as DiscoveryPlace).estimatedDurationMin : 35,
      address: isDiscovery ? (place as DiscoveryPlace).address : place.name,
      lat: place.lat,
      lng: place.lng,
      category: isDiscovery ? ((place as DiscoveryPlace).category as any) : 'viewpoint',
      price: isDiscovery ? (place as DiscoveryPlace).price : 0,
      isFixedTime,
      tag: isDiscovery ? (place as DiscoveryPlace).tag : 'instagram',
      instagramTip: isDiscovery ? (place as DiscoveryPlace).instagramTip : (place as PhotoSpot).tip,
      description: isDiscovery ? (place as DiscoveryPlace).description : (place as PhotoSpot).vibe,
      tips: isDiscovery ? (place as DiscoveryPlace).highlight : (place as PhotoSpot).tip,
      image: place.image,
    };

    setTripsState((prev) => {
      const existing = prev[selectedDestId]?.[activeDayIndex] || [];
      const updatedList = [...existing, newStep].sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
      );

      for (let i = 0; i < updatedList.length; i++) {
        if (i < updatedList.length - 1) {
          updatedList[i].transitToNext = computeTransitBetween(updatedList[i], updatedList[i + 1]);
        } else {
          updatedList[i].transitToNext = undefined;
        }
      }

      return {
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: updatedList,
        },
      };
    });

    setSelectedStepId(newStep.id);
    setToastNotification(`« ${place.name} » ajouté au Jour ${activeDayIndex + 1} à ${chosenTime}`);
    setTimeout(() => setToastNotification(null), 3500);
  };

  // Algorithmic Route Optimizer
  const handleOptimizeRoute = () => {
    if (currentSteps.length <= 2) {
      setToastNotification('Ajoutez au moins 3 étapes pour optimiser votre parcours.');
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }

    pushUndoSnapshot(`Optimisation du trajet du Jour ${activeDayIndex + 1}`);

    const result = optimizeDayRoute(currentSteps);
    if (result.hasReordered) {
      setTripsState((prev) => ({
        ...prev,
        [selectedDestId]: {
          ...prev[selectedDestId],
          [activeDayIndex]: result.optimizedSteps,
        },
      }));

      setOptimizationSavings({
        distanceSavedKm: result.distanceSavedKm,
        timeSavedMinutes: result.timeSavedMinutes,
      });

      triggerHaptic('drop');
      setToastNotification(
        `✨ Trajet optimisé ! -${result.distanceSavedKm} km économisés (~${result.timeSavedMinutes} min de marche épargnées).`
      );
      setTimeout(() => setToastNotification(null), 4500);
    } else {
      triggerHaptic('resolve');
      setToastNotification('Itinéraire déjà optimal pour vos horaires fixes !');
      setTimeout(() => setToastNotification(null), 3500);
    }
  };

  // Inspect Place on Map
  const handleInspectPlaceOnMap = (place: DiscoveryPlace) => {
    setInspectedPlace(place);
    setSelectedStepId(null);
    setMapOpen(true);
  };

  const handleResolveConflicts = () => {
    pushUndoSnapshot('Résolution des conflits horaires');
    const resolved = resolveDayConflicts(currentSteps);
    setTripsState((prev) => ({
      ...prev,
      [selectedDestId]: {
        ...prev[selectedDestId],
        [activeDayIndex]: resolved,
      },
    }));
  };

  const handleAddStepFromAi = (rec: RecommendedPlace) => {
    pushUndoSnapshot(`Ajout IA : ${rec.name}`);
    const lastStep = currentSteps[currentSteps.length - 1];
    let nextTime = '16:00';
    if (lastStep) {
      const endMins = timeToMinutes(lastStep.time) + lastStep.durationMinutes + 25;
      nextTime = minutesToTime(Math.ceil(endMins / 5) * 5);
    }

    const newStep: ActivityStep = {
      id: `step-ai-${Date.now()}`,
      day: activeDayIndex + 1,
      name: rec.name,
      time: nextTime,
      durationMinutes: rec.durationMinutes,
      address: rec.address,
      lat: rec.lat,
      lng: rec.lng,
      category: rec.category,
      price: rec.price,
      description: rec.description,
      image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
    };

    handleAddStep(newStep);
  };

  const handleChangeBudget = (newBudget: number) => {
    setBudgetsState((prev) => ({
      ...prev,
      [selectedDestId]: newBudget,
    }));
  };

  const handleShareTrip = () => {
    triggerHaptic('drop');
    const text = `Aura Voyage — Mon itinéraire à ${destination.name} (${destination.days.length} jours, ${currentTripMetrics.totalStepsCount} étapes). Budget estimé : ${currentTripMetrics.totalCost} €.`;
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div
      style={{
        backgroundColor: currentTheme.bgApp,
        color: currentTheme.textBody,
      }}
      className="min-h-screen flex flex-col font-sans transition-colors duration-300"
    >
      {/* Toast Notification Banner */}
      {toastNotification && (
        <div
          style={{
            backgroundColor: currentTheme.primary,
            color: currentTheme.primaryText,
            boxShadow: `0 10px 25px -5px ${currentTheme.accentGlow}`,
          }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl text-xs font-semibold shadow-xl flex items-center gap-2 animate-bounce"
        >
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* Undo Floating Banner */}
      {undoToast && (
        <div
          style={{
            backgroundColor: currentTheme.bgSurface,
            borderColor: currentTheme.primary,
            boxShadow: '0 20px 45px -10px rgba(0,0,0,0.25)',
          }}
          className="fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl border-2 flex items-center gap-3 backdrop-blur-xl animate-fade-in shadow-2xl"
        >
          <div
            style={{ backgroundColor: currentTheme.badgeBg, color: currentTheme.primary }}
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <div style={{ color: currentTheme.textHeading }} className="font-heading font-bold text-xs">
              {undoToast.message}
            </div>
            <div style={{ color: currentTheme.textMuted }} className="text-[10px] flex items-center gap-1 mt-0.5">
              <span>Raccourci :</span>
              <kbd className="font-mono bg-black/5 px-1 py-0.2 rounded text-[9px] font-bold">Ctrl+Z</kbd>
            </div>
          </div>
          <button
            onClick={handleUndo}
            style={{
              backgroundColor: currentTheme.primary,
              color: currentTheme.primaryText,
            }}
            className="px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-xs"
          >
            Annuler
          </button>
          <button
            onClick={() => setUndoToast(null)}
            className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Navigation */}
      <header
        style={{
          backgroundColor: currentTheme.bgSurface,
          borderColor: currentTheme.border,
        }}
        className="sticky top-0 z-30 border-b backdrop-blur-md px-4 sm:px-6 py-2.5 transition-colors duration-300"
      >
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
          {/* Brand & Destination Picker */}
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: currentTheme.primary,
                color: currentTheme.primaryText,
                boxShadow: `0 4px 12px ${currentTheme.accentGlow}`,
              }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold"
            >
              <Compass className="w-5 h-5" />
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  triggerHaptic('hover');
                  setDestDropdownOpen(!destDropdownOpen);
                }}
                className="flex items-center gap-2 group text-left cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1
                      style={{ color: currentTheme.textHeading }}
                      className="font-heading font-extrabold text-sm sm:text-base tracking-tight"
                    >
                      Aura Voyage
                    </h1>
                    <span style={{ color: currentTheme.border }}>•</span>
                    <span
                      style={{ color: currentTheme.primary }}
                      className="font-heading font-bold text-sm sm:text-base flex items-center gap-1"
                    >
                      {destination.name}
                      <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                  <p style={{ color: currentTheme.textMuted }} className="text-[11px] truncate hidden md:block">
                    {destination.tagline}
                  </p>
                </div>
              </button>

              {/* Destination Dropdown */}
              {destDropdownOpen && (
                <div
                  style={{
                    backgroundColor: currentTheme.bgSurface,
                    borderColor: currentTheme.border,
                    boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.2)',
                  }}
                  className="absolute left-0 top-full mt-2 w-72 border rounded-2xl p-2 z-50 backdrop-blur-xl animate-fade-in space-y-1"
                >
                  {Object.values(DESTINATIONS).map((dest) => (
                    <button
                      key={dest.id}
                      onClick={() => {
                        triggerHaptic('drop');
                        setSelectedDestId(dest.id);
                        setActiveDayIndex(0);
                        setSelectedStepId(null);
                        setDestDropdownOpen(false);
                      }}
                      style={{
                        backgroundColor:
                          dest.id === selectedDestId
                            ? currentTheme.badgeBg
                            : 'transparent',
                        borderColor:
                          dest.id === selectedDestId
                            ? currentTheme.primary
                            : 'transparent',
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl text-left border transition-all cursor-pointer hover:bg-black/5"
                    >
                      <img
                        src={dest.heroImage}
                        alt={dest.name}
                        className="w-10 h-10 rounded-lg object-cover border border-black/10"
                      />
                      <div>
                        <div style={{ color: currentTheme.textHeading }} className="font-heading font-bold text-xs">
                          {dest.name}
                        </div>
                        <div style={{ color: currentTheme.textMuted }} className="text-[11px]">
                          {dest.country} • {dest.days.length} jours
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics, Undo, Theme Selector & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Quick Undo Action */}
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              style={{
                backgroundColor: undoStack.length > 0 ? currentTheme.badgeBg : currentTheme.bgSurfaceSubtle,
                borderColor: undoStack.length > 0 ? currentTheme.primary : currentTheme.border,
                color: undoStack.length > 0 ? currentTheme.primary : currentTheme.textMuted,
              }}
              className="flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 text-xs font-semibold hover:border-black/20 cursor-pointer shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              title={undoStack.length > 0 ? `Annuler : ${undoStack[0].description} (Ctrl+Z)` : 'Rien à annuler'}
            >
              <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-45 transition-transform" />
              <span className="hidden sm:inline">Annuler</span>
              {undoStack.length > 0 && (
                <span
                  style={{
                    backgroundColor: currentTheme.primary,
                    color: currentTheme.primaryText,
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold"
                >
                  {undoStack.length}
                </span>
              )}
            </button>

            {/* Map Layout Toggle */}
            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => {
                  triggerHaptic('hover');
                  setMapOpen(!mapOpen);
                }}
                style={{
                  backgroundColor: mapOpen ? currentTheme.badgeBg : currentTheme.bgSurfaceSubtle,
                  borderColor: mapOpen ? currentTheme.primary : currentTheme.border,
                  color: mapOpen ? currentTheme.primary : currentTheme.textBody,
                }}
                className="flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 text-xs font-semibold cursor-pointer shadow-xs transition-all"
                title="Afficher ou masquer la carte interactive"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{mapOpen ? 'Carte Visible' : 'Carte Masquée'}</span>
              </button>

              {mapOpen && (
                <button
                  onClick={() => {
                    triggerHaptic('hover');
                    setMapDockPosition(mapDockPosition === 'corner' ? 'left-pane' : 'corner');
                  }}
                  style={{
                    backgroundColor: currentTheme.bgSurfaceSubtle,
                    borderColor: currentTheme.border,
                    color: currentTheme.textHeading,
                  }}
                  className="flex items-center gap-1 border rounded-xl px-2 py-1.5 text-xs hover:border-black/20 cursor-pointer shadow-xs"
                  title={mapDockPosition === 'corner' ? 'Ancrer en volet gauche' : 'Mode coin flottant'}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium hidden xl:inline">
                    {mapDockPosition === 'corner' ? 'Volet gauche' : 'Coin flottant'}
                  </span>
                </button>
              )}
            </div>

            {/* 5 Themes Swatch Switcher Button */}
            <div className="relative">
              <button
                onClick={() => {
                  triggerHaptic('hover');
                  setThemeModalOpen(!themeModalOpen);
                }}
                style={{
                  backgroundColor: currentTheme.bgSurfaceSubtle,
                  borderColor: currentTheme.border,
                  color: currentTheme.textHeading,
                }}
                className="flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 text-xs font-semibold hover:border-black/20 cursor-pointer shadow-xs transition-all"
                title="Choisir un thème de couleur (fond clair)"
              >
                <Palette style={{ color: currentTheme.primary }} className="w-3.5 h-3.5" />
                <span className="hidden md:inline font-medium">Thème :</span>
                <span style={{ color: currentTheme.primary }} className="font-bold">
                  {currentTheme.name}
                </span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {/* Theme Dropdown */}
              {themeModalOpen && (
                <div
                  style={{
                    backgroundColor: currentTheme.bgSurface,
                    borderColor: currentTheme.border,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
                  }}
                  className="absolute right-0 top-full mt-2 w-80 border rounded-2xl p-3 z-50 backdrop-blur-xl animate-fade-in"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                    <div>
                      <h4 style={{ color: currentTheme.textHeading }} className="font-heading font-bold text-xs">
                        5 Thèmes Voyage • Fond Clair
                      </h4>
                      <p style={{ color: currentTheme.textMuted }} className="text-[10px]">
                        Palette inspirée du brief et de vos explorations
                      </p>
                    </div>
                    <button
                      onClick={() => setThemeModalOpen(false)}
                      className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {Object.values(LIGHT_THEMES).map((thm) => {
                      const isSelected = thm.id === currentThemeId;
                      return (
                        <button
                          key={thm.id}
                          onClick={() => {
                            triggerHaptic('drop');
                            setCurrentThemeId(thm.id);
                            setThemeModalOpen(false);
                            setToastNotification(`Thème « ${thm.name} » appliqué`);
                            setTimeout(() => setToastNotification(null), 2500);
                          }}
                          style={{
                            backgroundColor: isSelected ? thm.badgeBg : thm.bgSurfaceSubtle,
                            borderColor: isSelected ? thm.primary : thm.border,
                          }}
                          className="w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between hover:scale-[1.01]"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                style={{ color: isSelected ? thm.primary : thm.textHeading }}
                                className="font-heading font-bold text-xs"
                              >
                                {thm.name}
                              </span>
                              {isSelected && (
                                <span
                                  style={{
                                    backgroundColor: thm.primary,
                                    color: thm.primaryText,
                                  }}
                                  className="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold"
                                >
                                  Actif
                                </span>
                              )}
                            </div>
                            <div style={{ color: thm.textMuted }} className="text-[10px] mt-0.5">
                              {thm.subtitle}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 pl-2">
                            {thm.swatches.map((color, idx) => (
                              <div
                                key={idx}
                                style={{ backgroundColor: color }}
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                                title={color}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Budget Cockpit Trigger */}
            <button
              onClick={() => {
                triggerHaptic('hover');
                setBudgetModalOpen(true);
              }}
              style={{
                backgroundColor: currentTheme.bgSurfaceSubtle,
                borderColor: currentTheme.border,
                color: currentTheme.textHeading,
              }}
              className="flex items-center gap-1 border rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer hover:border-black/20 shadow-xs group"
              title="Ouvrir le cockpit budget"
            >
              <Coins style={{ color: currentTheme.primary }} className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span className="font-mono font-bold">
                {currentTripMetrics.totalCost} €
              </span>
              <span style={{ color: currentTheme.textMuted }} className="hidden sm:inline">
                / {budgetsState[selectedDestId]} €
              </span>
            </button>

            {/* AI Concierge Trigger */}
            <button
              onClick={() => {
                triggerHaptic('hover');
                setConciergeOpen(true);
              }}
              style={{
                backgroundColor: currentTheme.primary,
                color: currentTheme.primaryText,
                boxShadow: `0 4px 14px ${currentTheme.accentGlow}`,
              }}
              className="flex items-center gap-1.5 font-bold px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Concierge IA</span>
              <span className="sm:hidden">IA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Days Tabs Strip & Telemetry */}
      <section
        style={{
          backgroundColor: currentTheme.bgSurface,
          borderColor: currentTheme.border,
        }}
        className="border-b px-4 sm:px-6 py-2.5"
      >
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Days Tabs (Active Drop Targets) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {destination.days.map((day, idx) => {
              const isActive = idx === activeDayIndex;
              const isHoveredTarget = hoveredDayDropIdx === idx;
              const daySteps = tripsState[selectedDestId]?.[idx] || [];
              const dayConflicts = detectDayConflicts(daySteps);

              return (
                <button
                  key={day.dayNumber}
                  onClick={() => {
                    triggerHaptic('hover');
                    setActiveDayIndex(idx);
                    setSelectedStepId(null);
                    setInspectedPlace(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (hoveredDayDropIdx !== idx) {
                      setHoveredDayDropIdx(idx);
                      triggerHaptic('hover');
                    }
                  }}
                  onDragLeave={() => {
                    if (hoveredDayDropIdx === idx) {
                      setHoveredDayDropIdx(null);
                    }
                  }}
                  onDrop={(e) => handleDropOnDayTab(e, idx)}
                  style={{
                    backgroundColor: isHoveredTarget
                      ? currentTheme.badgeBg
                      : isActive
                      ? currentTheme.bgSurface
                      : currentTheme.bgSurfaceSubtle,
                    borderColor: isHoveredTarget
                      ? currentTheme.primary
                      : isActive
                      ? currentTheme.primary
                      : currentTheme.border,
                    color: currentTheme.textHeading,
                    boxShadow: isActive ? `0 4px 12px ${currentTheme.accentGlow}` : 'none',
                  }}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap border ${
                    isHoveredTarget
                      ? 'scale-105 ring-4 ring-amber-400/40 shadow-lg'
                      : isActive
                      ? 'ring-2'
                      : isDraggingActive
                      ? 'border-dashed animate-pulse hover:border-black/30'
                      : 'hover:border-black/20'
                  }`}
                >
                  <span className="font-heading font-bold">Jour {day.dayNumber}</span>
                  <span style={{ color: currentTheme.textMuted }} className="text-[11px] hidden sm:inline">
                    • {day.title}
                  </span>
                  <span
                    style={{
                      backgroundColor: currentTheme.bgSurfaceSubtle,
                      borderColor: currentTheme.border,
                      color: currentTheme.primary,
                    }}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded-full border font-bold"
                  >
                    {daySteps.length}
                  </span>
                  {dayConflicts.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                  {isDraggingActive && !isActive && (
                    <span style={{ color: currentTheme.primary }} className="text-[10px] ml-1 font-mono font-bold">
                      (Déposer)
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Day Telemetry Summary */}
          <div
            style={{ color: currentTheme.textBody }}
            className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-[11px] sm:text-xs pt-1 md:pt-0 border-t md:border-t-0 border-black/5"
          >
            <div className="flex items-center gap-1">
              <span style={{ color: currentTheme.textMuted }}>Marche :</span>
              <span style={{ color: currentTheme.textHeading }} className="font-mono font-bold">
                {activeDayMetrics.totalWalkingKm} km
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span style={{ color: currentTheme.textMuted }}>Transit :</span>
              <span style={{ color: currentTheme.textHeading }} className="font-mono font-bold">
                {activeDayMetrics.totalTransitMin} min
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span style={{ color: currentTheme.textMuted }}>Jour :</span>
              <span style={{ color: currentTheme.primary }} className="font-mono font-bold">
                {activeDayMetrics.totalCost} €
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-5 flex flex-col gap-4 sm:gap-5">
        {/* 1. Surrounding Discovery Carousel (Day / Evening / Nightlife) */}
        <DiscoveryCarousel
          places={destination.discoveryPlaces || []}
          activeDay={activeDayIndex + 1}
          centerCoords={destination.center}
          currentStepCoords={currentSteps[0]}
          onAddPlaceToTrip={handleAddPlaceFromDiscovery}
          onSelectPlaceForSchedule={(place) => setScheduleModalPlace(place)}
          onInspectPlaceOnMap={handleInspectPlaceOnMap}
          theme={currentTheme}
        />

        {/* 2. Timeline Editor & Day Itinerary */}
        <div className="flex-1 flex flex-col border rounded-3xl p-4 sm:p-6 shadow-xs" style={{ backgroundColor: currentTheme.bgSurface, borderColor: currentTheme.border }}>
          <div style={{ borderColor: currentTheme.border }} className="flex items-center justify-between pb-3 mb-3 border-b shrink-0">
            <div>
              <h2 style={{ color: currentTheme.textHeading }} className="font-heading font-extrabold text-base sm:text-lg flex items-center gap-2">
                <span>{destination.days[activeDayIndex]?.title || 'Programme de la journée'}</span>
              </h2>
              <p style={{ color: currentTheme.textMuted }} className="text-xs mt-0.5">
                {destination.days[activeDayIndex]?.dateFormatted} • {currentSteps.length} étapes avec calcul de trajet en direct
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHaptic('hover');
                  setMapOpen(!mapOpen);
                }}
                style={{
                  backgroundColor: mapOpen ? currentTheme.badgeBg : currentTheme.bgSurfaceSubtle,
                  borderColor: mapOpen ? currentTheme.primary : currentTheme.border,
                  color: mapOpen ? currentTheme.primary : currentTheme.textBody,
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{mapOpen ? 'Masquer la carte' : 'Ouvrir la carte'}</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('hover');
                  setShowPhotoSpots(!showPhotoSpots);
                }}
                style={{
                  backgroundColor: showPhotoSpots ? currentTheme.badgeBg : currentTheme.bgSurfaceSubtle,
                  borderColor: showPhotoSpots ? currentTheme.primary : currentTheme.border,
                  color: showPhotoSpots ? currentTheme.primary : currentTheme.textBody,
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Spots Photos</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <AuraTimeline
              steps={currentSteps}
              conflicts={activeConflicts}
              selectedStepId={selectedStepId}
              onSelectStep={(id) => {
                setSelectedStepId(id);
                setInspectedPlace(null);
                setMapOpen(true);
              }}
              onUpdateStep={handleUpdateStep}
              onDeleteStep={handleDeleteStep}
              onMoveStep={handleMoveStep}
              onAddStep={handleAddStep}
              onResolveConflicts={handleResolveConflicts}
              activeDay={activeDayIndex + 1}
              totalDays={destination.days.length}
              onMoveStepToDay={handleMoveStepToDay}
              onReorderSteps={handleReorderSteps}
              isDraggingActive={isDraggingActive}
              setIsDraggingActive={setIsDraggingActive}
              onOpenMap={() => setMapOpen(true)}
              onInspectTransitOnMap={(fromStep) => {
                setSelectedStepId(fromStep.id);
                setInspectedPlace(null);
                setMapOpen(true);
              }}
              onOptimizeRoute={handleOptimizeRoute}
              optimizationSavings={optimizationSavings}
              onUndoOptimization={handleUndo}
              theme={currentTheme}
            />
          </div>
        </div>
      </main>

      {/* Floating Interactive Corner Map */}
      <CornerInteractiveMap
        center={destination.center}
        zoom={destination.zoom}
        steps={currentSteps}
        photoSpots={destination.photoSpots}
        discoveryPlaces={destination.discoveryPlaces}
        selectedStepId={selectedStepId}
        inspectedPlace={inspectedPlace}
        isOpen={mapOpen}
        dockPosition={mapDockPosition}
        onToggleDock={() => setMapDockPosition(mapDockPosition === 'corner' ? 'left-pane' : 'corner')}
        onClose={() => setMapOpen(false)}
        onSelectStep={(id) => setSelectedStepId(id)}
        theme={currentTheme}
      />

      {/* Floating Trigger when Map is closed */}
      {!mapOpen && (
        <button
          onClick={() => {
            triggerHaptic('hover');
            setMapOpen(true);
          }}
          style={{
            backgroundColor: currentTheme.primary,
            color: currentTheme.primaryText,
            boxShadow: `0 10px 25px -5px ${currentTheme.accentGlow}`,
          }}
          className="fixed bottom-5 left-5 z-40 px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20 shadow-xl"
        >
          <Compass className="w-4 h-4" />
          <span>Carte interactive ({currentSteps.length} étapes)</span>
        </button>
      )}

      {/* Interactive Modals & Concierge Drawer */}
      <AuraConcierge
        destination={destination}
        activeDay={activeDayIndex + 1}
        currentSteps={currentSteps}
        currentBudget={budgetsState[selectedDestId]}
        travelers={travelersCount}
        isOpen={conciergeOpen}
        onClose={() => setConciergeOpen(false)}
        onAddStepFromAi={handleAddStepFromAi}
        theme={currentTheme}
      />

      <BudgetFlightDeck
        destination={destination}
        totalSpent={currentTripMetrics.totalCost}
        currentBudget={budgetsState[selectedDestId]}
        travelers={travelersCount}
        daysCount={destination.days.length}
        onChangeBudget={handleChangeBudget}
        isOpen={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        theme={currentTheme}
      />

      <LocalIntelModal
        destination={destination}
        isOpen={intelModalOpen}
        onClose={() => setIntelModalOpen(false)}
        theme={currentTheme}
      />

      {/* Schedule Selection & Recalculation Modal */}
      <SchedulePickerModal
        place={scheduleModalPlace}
        isOpen={Boolean(scheduleModalPlace)}
        activeDay={activeDayIndex + 1}
        currentSteps={currentSteps}
        onConfirm={handleAddPlaceWithSchedule}
        onClose={() => setScheduleModalPlace(null)}
        theme={currentTheme}
      />
    </div>
  );
}
