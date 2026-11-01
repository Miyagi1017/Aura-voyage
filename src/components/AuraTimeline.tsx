import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  AlertTriangle,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Footprints,
  Train,
  Car,
  Ticket,
  GripVertical,
  CalendarDays,
  Wand2,
  Lock,
  Unlock,
  Route,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ActivityStep, ConflictInfo, minutesToTime, timeToMinutes } from '../utils/travelLogic';
import { triggerHaptic } from '../utils/haptics';
import { ThemePalette } from '../utils/themeConfig';

interface AuraTimelineProps {
  steps: ActivityStep[];
  conflicts: ConflictInfo[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onUpdateStep: (updated: ActivityStep) => void;
  onDeleteStep: (stepId: string) => void;
  onMoveStep: (index: number, direction: 'up' | 'down') => void;
  onAddStep: (step: ActivityStep) => void;
  onResolveConflicts: () => void;
  activeDay: number;
  totalDays: number;
  onMoveStepToDay: (stepId: string, targetDayIdx: number) => void;
  onReorderSteps: (sourceIdx: number, targetIdx: number) => void;
  isDraggingActive: boolean;
  setIsDraggingActive: (active: boolean) => void;
  onOpenMap?: () => void;
  onInspectTransitOnMap?: (fromStep: ActivityStep, toStep: ActivityStep) => void;
  onOptimizeRoute?: () => void;
  optimizationSavings?: { distanceSavedKm: number; timeSavedMinutes: number } | null;
  onUndoOptimization?: () => void;
  theme: ThemePalette;
}

export const AuraTimeline: React.FC<AuraTimelineProps> = ({
  steps,
  conflicts,
  selectedStepId,
  onSelectStep,
  onUpdateStep,
  onDeleteStep,
  onMoveStep,
  onAddStep,
  onResolveConflicts,
  activeDay,
  totalDays,
  onMoveStepToDay,
  onReorderSteps,
  isDraggingActive,
  setIsDraggingActive,
  onOpenMap,
  onInspectTransitOnMap,
  onOptimizeRoute,
  optimizationSavings,
  onUndoOptimization,
  theme,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [daySwitchMenuOpen, setDaySwitchMenuOpen] = useState<string | null>(null);

  // Drag states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // New Step form state
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('16:00');
  const [newDuration, setNewDuration] = useState(60);
  const [newCategory, setNewCategory] = useState<ActivityStep['category']>('culture');
  const [newPrice, setNewPrice] = useState(15);
  const [newAddress, setNewAddress] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleResolveWithCelebration = () => {
    triggerHaptic('resolve');
    onResolveConflicts();
    confetti({
      particleCount: 65,
      spread: 75,
      origin: { y: 0.6 },
      colors: [theme.primary, theme.accent, '#A08B62', '#0284C7'],
    });
  };

  const handleCreateStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    triggerHaptic('drop');

    const baseLat = steps[0]?.lat ?? 41.8902;
    const baseLng = steps[0]?.lng ?? 12.4922;

    const newStep: ActivityStep = {
      id: `step-${Date.now()}`,
      day: activeDay,
      name: newName.trim(),
      time: newTime,
      durationMinutes: newDuration,
      address: newAddress.trim() || 'Centre-ville',
      lat: baseLat + (Math.random() - 0.5) * 0.015,
      lng: baseLng + (Math.random() - 0.5) * 0.015,
      category: newCategory,
      price: newPrice,
      description: newDesc.trim() || 'Nouvelle étape ajoutée à votre carnet.',
      image:
        newCategory === 'food'
          ? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'
          : newCategory === 'viewpoint'
          ? 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=600&q=80'
          : 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80',
    };

    onAddStep(newStep);
    setNewName('');
    setNewDesc('');
    setNewAddress('');
    setShowAddForm(false);
  };

  const adjustStepTime = (step: ActivityStep, deltaMinutes: number) => {
    triggerHaptic('hover');
    const currentMins = timeToMinutes(step.time);
    const newMins = Math.max(0, Math.min(23 * 60 + 55, currentMins + deltaMinutes));
    onUpdateStep({
      ...step,
      time: minutesToTime(newMins),
    });
  };

  // Drag and Drop Gestures Handlers
  const handleDragStart = (e: React.DragEvent, index: number, step: ActivityStep) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ stepId: step.id, sourceDay: activeDay }));
    setDraggedIndex(index);
    setIsDraggingActive(true);
    triggerHaptic('lift');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
      triggerHaptic('hover');
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      triggerHaptic('drop');
      onReorderSteps(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDraggingActive(false);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDraggingActive(false);
  };

  const getCategoryTheme = (category: ActivityStep['category']) => {
    switch (category) {
      case 'food':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200/80',
          label: 'Gastronomie',
          icon: '🍷',
        };
      case 'culture':
        return {
          bg: 'bg-purple-50 text-purple-900 border-purple-200/80',
          label: 'Culture & Patrimoine',
          icon: '🏛️',
        };
      case 'viewpoint':
        return {
          bg: 'bg-orange-50 text-orange-900 border-orange-200/80',
          label: 'Panorama Vénitien',
          icon: '🌄',
        };
      case 'nature':
        return {
          bg: 'bg-emerald-50 text-emerald-900 border-emerald-200/80',
          label: 'Parcs & Nature',
          icon: '🌿',
        };
      case 'secret':
        return {
          bg: 'bg-sky-50 text-sky-900 border-sky-200/80',
          label: 'Pépite Secrète',
          icon: '✨',
        };
      default:
        return {
          bg: 'bg-stone-50 text-stone-800 border-stone-200',
          label: 'Escapade',
          icon: '📍',
        };
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Conflicts Banner - Light Theme High Contrast */}
      {conflicts.length > 0 && (
        <div
          style={{
            backgroundColor: '#FFFBEB',
            borderColor: '#FCD34D',
            boxShadow: '0 8px 20px -4px rgba(217, 119, 6, 0.15)',
          }}
          className="mb-4 p-3.5 rounded-2xl border flex items-center justify-between gap-3 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                {conflicts.length === 1
                  ? '1 conflit d’horaires détecté'
                  : `${conflicts.length} conflits d’horaires détectés`}
              </h4>
              <p className="text-[11px] text-amber-700 line-clamp-1">
                {conflicts[0].message}
              </p>
            </div>
          </div>
          <button
            onClick={handleResolveWithCelebration}
            style={{
              backgroundColor: theme.primary,
              color: theme.primaryText,
              boxShadow: `0 4px 12px ${theme.accentGlow}`,
            }}
            className="shrink-0 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 cursor-pointer transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Résoudre magiquement</span>
          </button>
        </div>
      )}

      {/* Gestural Drag Hint Banner when dragging */}
      {isDraggingActive && (
        <div
          style={{
            backgroundColor: theme.bgSurfaceSubtle,
            borderColor: theme.borderActive,
            color: theme.textHeading,
          }}
          className="mb-3 p-2.5 rounded-2xl border text-xs flex items-center justify-between animate-bounce shadow-md"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-amber-600 animate-pulse" />
            <span className="font-semibold">
              Glissez et déposez sur un autre Jour en haut ou réorganisez ci-dessous !
            </span>
          </div>
          <span
            style={{
              backgroundColor: theme.badgeBg,
              color: theme.badgeText,
              borderColor: theme.border,
            }}
            className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-bold"
          >
            Haptique Live
          </span>
        </div>
      )}

      {/* Day Itinerary Summary & Route Optimizer Toolbar */}
      <div
        style={{
          backgroundColor: theme.bgSurface,
          borderColor: theme.border,
        }}
        className="mb-3 p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs"
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{ backgroundColor: theme.badgeBg, color: theme.primary }}
            className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs"
          >
            J{activeDay}
          </div>
          <div>
            <h3 style={{ color: theme.textHeading }} className="font-heading font-extrabold text-xs sm:text-sm">
              Itinéraire du Jour {activeDay} · {steps.length} {steps.length > 1 ? 'étapes' : 'étape'}
            </h3>
            <p style={{ color: theme.textMuted }} className="text-[11px] flex items-center gap-2 mt-0.5">
              <span>
                🏃 ~{Math.round(steps.reduce((acc, s) => acc + (s.transitToNext?.distanceKm ?? 0), 0) * 10) / 10} km de trajet
              </span>
              <span>·</span>
              <span>
                🔒 {steps.filter((s) => s.isFixedTime || s.bookingRequired || s.isBooked).length} horaire(s) fixe(s)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {/* Optimiser Trajet Button */}
          {onOptimizeRoute && steps.length >= 3 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('drop');
                onOptimizeRoute();
              }}
              style={{
                backgroundColor: theme.primary,
                color: theme.primaryText,
                boxShadow: `0 4px 12px ${theme.accentGlow}`,
              }}
              className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-xs"
              title="Réorganise intelligemment les étapes flexibles pour minimiser le trajet en respectant les horaires fixes"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Optimiser Trajet</span>
            </button>
          )}

          {onOpenMap && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('hover');
                onOpenMap();
              }}
              style={{
                backgroundColor: theme.bgSurfaceSubtle,
                borderColor: theme.border,
                color: theme.textHeading,
              }}
              className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 hover:border-black/20 transition-all cursor-pointer"
              title="Ouvrir la carte interactive"
            >
              <MapPin className="w-3.5 h-3.5" style={{ color: theme.primary }} />
              <span className="hidden xs:inline">Carte</span>
            </button>
          )}
        </div>
      </div>

      {/* Optimization Savings Notification Banner */}
      {optimizationSavings && (
        <div
          style={{
            backgroundColor: '#ECFDF5',
            borderColor: '#A7F3D0',
          }}
          className="mb-3 p-3 rounded-2xl border flex items-center justify-between gap-2.5 text-xs text-emerald-950 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Trajet optimisé !</strong> Économie de{' '}
              <strong>{optimizationSavings.distanceSavedKm} km</strong> (~{optimizationSavings.timeSavedMinutes} min de marche épargnées) tout en conservant vos horaires fixes.
            </span>
          </div>
          {onUndoOptimization && (
            <button
              type="button"
              onClick={onUndoOptimization}
              className="px-2.5 py-1 rounded-lg bg-emerald-200/90 hover:bg-emerald-300 font-bold text-[11px] text-emerald-900 cursor-pointer transition-all shrink-0 active:scale-95"
            >
              Annuler
            </button>
          )}
        </div>
      )}

      {/* Activity Timeline Scrollable List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {steps.length === 0 ? (
          <div
            style={{
              borderColor: theme.border,
              backgroundColor: theme.bgSurfaceSubtle,
            }}
            className="text-center py-12 px-4 rounded-3xl border border-dashed"
          >
            <Sparkles style={{ color: theme.primary }} className="w-8 h-8 mx-auto mb-2" />
            <p style={{ color: theme.textHeading }} className="text-sm font-semibold font-heading">
              Aucune étape prévue pour ce jour
            </p>
            <p style={{ color: theme.textMuted }} className="text-xs mt-1">
              Glissez une étape depuis un autre jour ou demandez au Concierge IA !
            </p>
          </div>
        ) : (
          steps.map((step, idx) => {
            const isSelected = step.id === selectedStepId;
            const isExpanded = expandedId === step.id;
            const isBeingDragged = draggedIndex === idx;
            const isDropTarget = dragOverIndex === idx && draggedIndex !== idx;
            const catTheme = getCategoryTheme(step.category);
            const hasConflict = conflicts.some(
              (c) => c.stepAId === step.id || c.stepBId === step.id
            );

            return (
              <div
                key={step.id}
                className="relative transition-transform duration-200"
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
              >
                {/* Visual Drop Slot Indicator */}
                {isDropTarget && (
                  <div
                    style={{
                      borderColor: theme.primary,
                      backgroundColor: theme.badgeBg,
                      color: theme.primary,
                    }}
                    className="h-11 my-2 rounded-2xl border-2 border-dashed flex items-center justify-center text-xs font-bold shadow-md animate-pulse"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Insérer ici à {step.time}
                    </span>
                  </div>
                )}

                {/* Main Step Card - Light Theme */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx, step)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    triggerHaptic('hover');
                    onSelectStep(step.id);
                  }}
                  style={{
                    backgroundColor: isSelected
                      ? theme.bgSurface
                      : hasConflict
                      ? '#FEF2F2'
                      : theme.bgSurface,
                    borderColor: isSelected
                      ? theme.borderActive
                      : hasConflict
                      ? '#F87171'
                      : theme.border,
                    boxShadow: isSelected
                      ? `0 12px 24px -6px ${theme.accentGlow}, 0 4px 8px -2px rgba(0,0,0,0.05)`
                      : '0 2px 10px -2px rgba(0,0,0,0.04)',
                  }}
                  className={`group relative rounded-2xl border transition-all duration-300 cursor-grab active:cursor-grabbing overflow-hidden ${
                    isBeingDragged
                      ? 'opacity-40 scale-[0.98] border-dashed rotate-1'
                      : isSelected
                      ? 'ring-2'
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className="p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Drag Handle, Step Number & Time Stepper */}
                      <div className="flex items-center gap-2">
                        {/* Tactile Drag Grip Handle */}
                        <div
                          style={{ color: theme.textMuted }}
                          className="hover:opacity-100 opacity-60 transition-colors p-0.5 cursor-grab active:cursor-grabbing"
                          title="Glisser pour réorganiser ou déplacer vers un autre jour"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Step Number Badge */}
                        <div
                          style={{
                            background: isSelected ? theme.markerBg : theme.bgSurfaceSubtle,
                            color: isSelected ? theme.markerText : theme.textHeading,
                            border: `1px solid ${isSelected ? 'transparent' : theme.border}`,
                          }}
                          className="w-7 h-7 rounded-xl flex items-center justify-center font-heading font-extrabold text-xs shrink-0 shadow-sm"
                        >
                          {idx + 1}
                        </div>

                        {/* Interactive Time Badge */}
                        <div
                          style={{
                            backgroundColor: theme.bgSurfaceSubtle,
                            borderColor: theme.border,
                          }}
                          className="flex items-center border rounded-lg px-2 py-1 gap-1"
                        >
                          <Clock style={{ color: theme.primary }} className="w-3 h-3" />
                          <span
                            style={{ color: theme.textHeading }}
                            className="font-mono text-xs font-bold"
                          >
                            {step.time}
                          </span>
                          <div
                            style={{ borderColor: theme.border, color: theme.textMuted }}
                            className="flex flex-col ml-1 pl-1 border-l text-[9px]"
                          >
                            <button
                              title="Avancer de 15 min"
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustStepTime(step, -15);
                              }}
                              className="hover:opacity-100 opacity-60 leading-none cursor-pointer"
                            >
                              ▲
                            </button>
                            <button
                              title="Retarder de 15 min"
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustStepTime(step, 15);
                              }}
                              className="hover:opacity-100 opacity-60 leading-none cursor-pointer"
                            >
                              ▼
                            </button>
                          </div>
                        </div>

                        {/* Category Chip */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catTheme.bg}`}
                        >
                          {catTheme.icon} {catTheme.label}
                        </span>

                        {/* Curation tag if present */}
                        {step.tag === 'instagram' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-800 border-rose-200">
                            📸 Insta
                          </span>
                        )}
                        {step.tag === 'offbeat' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                            🌿 Pépite
                          </span>
                        )}
                        {step.tag === 'secret_table' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                            🍽️ Table
                          </span>
                        )}
                        {step.tag === 'speakeasy' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200">
                            🍸 Speakeasy
                          </span>
                        )}
                      </div>

                      {/* Price, Fixed Lock & Booking Badges */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Fixed schedule lock toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('hover');
                            const isNowFixed = !(step.isFixedTime || step.bookingRequired || step.isBooked);
                            onUpdateStep({
                              ...step,
                              isFixedTime: isNowFixed,
                            });
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold transition-all cursor-pointer border ${
                            step.isFixedTime || step.bookingRequired || step.isBooked
                              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              : 'bg-stone-100/90 text-stone-600 border-stone-200 hover:border-amber-300 hover:text-amber-800'
                          }`}
                          title={
                            step.isFixedTime || step.bookingRequired || step.isBooked
                              ? 'Horaire verrouillé : préservé lors de l’optimisation du trajet (cliquer pour rendre flexible)'
                              : 'Horaire flexible : cliquer pour verrouiller l’horaire exact'
                          }
                        >
                          {step.isFixedTime || step.bookingRequired || step.isBooked ? (
                            <>
                              <Lock className="w-2.5 h-2.5 text-amber-700" />
                              <span>Fixe 🔒</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-2.5 h-2.5 opacity-60" />
                              <span>Flexible</span>
                            </>
                          )}
                        </button>

                        {step.bookingRequired && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold ${
                              step.isBooked
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            <Ticket className="w-2.5 h-2.5" />
                            {step.isBooked ? 'Réservé' : 'À réserver'}
                          </span>
                        )}
                        <span
                          style={{
                            backgroundColor: theme.badgeBg,
                            color: theme.badgeText,
                            borderColor: theme.border,
                          }}
                          className="font-mono text-xs font-bold px-2 py-0.5 rounded-md border"
                        >
                          {step.price > 0 ? `${step.price} €` : 'Gratuit'}
                        </span>
                      </div>
                    </div>

                    {/* Step Name & Address */}
                    <div className="mt-2.5 flex items-start justify-between gap-3">
                      <div>
                        <h4
                          style={{ color: theme.textHeading }}
                          className="font-heading text-sm sm:text-base font-bold transition-colors"
                        >
                          {step.name}
                        </h4>
                        <p
                          style={{ color: theme.textBody }}
                          className="text-xs flex items-center gap-1.5 mt-0.5 line-clamp-1"
                        >
                          <MapPin style={{ color: theme.primary }} className="w-3 h-3 shrink-0" />
                          <span>{step.address}</span>
                          <span style={{ color: theme.border }}>•</span>
                          <span style={{ color: theme.textMuted }}>
                            {step.durationMinutes} min de visite
                          </span>
                        </p>
                      </div>

                      {/* Step Thumbnail */}
                      {step.image && (
                        <img
                          src={step.image}
                          alt={step.name}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 border border-black/5 shadow-sm group-hover:scale-105 transition-transform"
                        />
                      )}
                    </div>

                    {/* Expandable Info / Tips */}
                    {isExpanded && (
                      <div
                        style={{ borderColor: theme.border, color: theme.textBody }}
                        className="mt-3 pt-3 border-t text-xs space-y-2"
                      >
                        <p className="leading-relaxed">{step.description}</p>
                        {step.tips && (
                          <div
                            style={{
                              backgroundColor: theme.bgSurfaceSubtle,
                              borderColor: theme.border,
                              color: theme.textHeading,
                            }}
                            className="p-2.5 rounded-xl border flex items-start gap-2"
                          >
                            <Sparkles style={{ color: theme.primary }} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                              <strong>Conseil d'explorateur :</strong> {step.tips}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Actions Footer */}
                    <div
                      style={{ borderColor: theme.border }}
                      className="mt-3 pt-2 flex items-center justify-between border-t text-xs"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('hover');
                          setExpandedId(isExpanded ? null : step.id);
                        }}
                        style={{ color: theme.textMuted }}
                        className="hover:opacity-100 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <span>Moins de détails</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>Détails & conseils</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {/* Quick Day Transfer Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            title="Transférer vers un autre jour"
                            aria-label="Transférer vers un autre jour"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('hover');
                              setDaySwitchMenuOpen(
                                daySwitchMenuOpen === step.id ? null : step.id
                              );
                            }}
                            style={{
                              backgroundColor: theme.bgSurfaceSubtle,
                              borderColor: theme.border,
                              color: theme.textBody,
                            }}
                            className="px-2 py-1 cursor-pointer flex items-center gap-1 rounded-lg border text-[11px] font-semibold hover:border-black/20 transition-all active:scale-95"
                          >
                            <CalendarDays style={{ color: theme.primary }} className="w-3.5 h-3.5" />
                            <span>Changer de jour</span>
                          </button>

                          {daySwitchMenuOpen === step.id && (
                            <div
                              style={{
                                backgroundColor: theme.bgSurface,
                                borderColor: theme.borderActive,
                                boxShadow: '0 20px 30px -10px rgba(0,0,0,0.15)',
                              }}
                              className="absolute right-0 bottom-full mb-1.5 w-48 border rounded-2xl p-2 z-50 backdrop-blur-2xl"
                            >
                              <div
                                style={{ color: theme.primary }}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 mb-1 font-mono"
                              >
                                Transférer vers :
                              </div>
                              {Array.from({ length: totalDays }).map((_, dIdx) => (
                                <button
                                  key={dIdx}
                                  type="button"
                                  disabled={dIdx + 1 === activeDay}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic('drop');
                                    onMoveStepToDay(step.id, dIdx);
                                    setDaySwitchMenuOpen(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xl transition-all cursor-pointer flex items-center justify-between my-0.5 ${
                                    dIdx + 1 === activeDay
                                      ? 'opacity-35 bg-stone-100 text-stone-500'
                                      : 'hover:bg-black/5 text-stone-800 active:scale-95'
                                  }`}
                                >
                                  <span className="font-semibold">Jour {dIdx + 1}</span>
                                  {dIdx + 1 === activeDay ? (
                                    <span style={{ color: theme.textMuted }} className="text-[10px] font-mono">Actuel</span>
                                  ) : (
                                    <span style={{ color: theme.primary }} className="text-[10px] font-bold">Déplacer →</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reorder Buttons */}
                        <button
                          title="Monter"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('hover');
                            onMoveStep(idx, 'up');
                          }}
                          style={{ color: theme.textMuted }}
                          className="p-1 hover:text-stone-900 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Descendre"
                          disabled={idx === steps.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('hover');
                            onMoveStep(idx, 'down');
                          }}
                          style={{ color: theme.textMuted }}
                          className="p-1 hover:text-stone-900 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Supprimer l'étape"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('cancel');
                            onDeleteStep(step.id);
                          }}
                          className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transit Multi-Mode Connector to Next Step */}
                {step.transitToNext && idx < steps.length - 1 && (
                  <div
                    style={{ borderColor: theme.border }}
                    className="my-2.5 ml-6 sm:ml-7 pl-5 sm:pl-6 relative border-l-2 border-dashed py-1.5"
                  >
                    <div
                      style={{
                        backgroundColor: theme.bgSurfaceSubtle,
                        borderColor: theme.border,
                      }}
                      className="p-2 sm:p-2.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Multi-mode Mode Switcher */}
                        <div
                          style={{ borderColor: theme.border, backgroundColor: theme.bgSurface }}
                          className="flex items-center p-0.5 rounded-xl border text-[11px] gap-0.5"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('hover');
                              const walkMins = step.transitToNext?.walkMinutes ?? step.transitToNext?.durationMin ?? 15;
                              onUpdateStep({
                                ...step,
                                transitToNext: {
                                  ...step.transitToNext!,
                                  mode: 'walk',
                                  durationMin: walkMins,
                                  cost: 0,
                                },
                              });
                            }}
                            style={{
                              backgroundColor: step.transitToNext.mode === 'walk' ? theme.primary : 'transparent',
                              color: step.transitToNext.mode === 'walk' ? theme.primaryText : theme.textBody,
                            }}
                            className="px-2 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Footprints className="w-3 h-3" />
                            <span>À pied ({step.transitToNext.walkMinutes || step.transitToNext.durationMin} min)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('hover');
                              const driveMins =
                                step.transitToNext?.driveMinutes ??
                                Math.max(4, Math.round(step.transitToNext!.distanceKm * 2.5 + 4));
                              const carCost =
                                step.transitToNext?.carCost ??
                                Math.round(step.transitToNext!.distanceKm * 2.2 + 4);
                              onUpdateStep({
                                ...step,
                                transitToNext: {
                                  ...step.transitToNext!,
                                  mode: 'car',
                                  durationMin: driveMins,
                                  cost: carCost,
                                },
                              });
                            }}
                            style={{
                              backgroundColor: step.transitToNext.mode === 'car' ? theme.primary : 'transparent',
                              color: step.transitToNext.mode === 'car' ? theme.primaryText : theme.textBody,
                            }}
                            className="px-2 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Car className="w-3 h-3" />
                            <span>Voiture ({step.transitToNext.driveMinutes || Math.max(4, Math.round(step.transitToNext.distanceKm * 2.5 + 4))} min)</span>
                          </button>
                        </div>

                        {/* Distance metric */}
                        <span style={{ color: theme.textMuted }} className="font-mono text-[11px] font-bold">
                          {step.transitToNext.distanceKm} km
                        </span>

                        {step.transitToNext.cost > 0 && (
                          <span style={{ color: theme.primary }} className="font-mono font-bold text-[11px]">
                            ~{step.transitToNext.cost} €
                          </span>
                        )}
                      </div>

                      {/* View transit on map button */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('hover');
                          if (onInspectTransitOnMap && steps[idx + 1]) {
                            onInspectTransitOnMap(step, steps[idx + 1]);
                          } else if (onOpenMap) {
                            onOpenMap();
                          }
                          onSelectStep(step.id);
                        }}
                        style={{
                          backgroundColor: theme.bgSurface,
                          borderColor: theme.border,
                          color: theme.primary,
                        }}
                        className="px-2 py-1 border rounded-xl font-semibold flex items-center gap-1 hover:border-black/20 transition-all cursor-pointer self-start sm:self-auto shrink-0 text-[11px]"
                        title="Voir ce trajet sur la carte interactive"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Tracé carte</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Add Step Toggle / Form */}
        <div className="pt-2">
          {!showAddForm ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  triggerHaptic('hover');
                  setShowAddForm(true);
                }}
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.bgSurface,
                  color: theme.textBody,
                }}
                className="w-full py-3 px-4 rounded-2xl border border-dashed hover:border-black/30 hover:bg-black/5 transition-all font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer group shadow-xs"
              >
                <Plus style={{ color: theme.primary }} className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Ajouter une étape personnalisée</span>
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleCreateStep}
              style={{
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderActive,
                boxShadow: '0 12px 24px -4px rgba(0,0,0,0.08)',
              }}
              className="p-4 rounded-2xl border space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 style={{ color: theme.textHeading }} className="font-heading font-bold text-sm">
                  Nouvelle étape pour la journée
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{ color: theme.textMuted }}
                  className="text-xs hover:text-stone-900 cursor-pointer"
                >
                  Annuler
                </button>
              </div>

              <div>
                <label style={{ color: theme.textBody }} className="text-[11px] font-semibold block mb-1">
                  Nom du lieu / de l’activité *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Galerie Borghèse, Aperitivo Piazza del Popolo..."
                  style={{
                    backgroundColor: theme.bgSurfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textHeading,
                  }}
                  className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-stone-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label style={{ color: theme.textBody }} className="text-[11px] font-semibold block mb-1">
                    Heure de début
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    style={{
                      backgroundColor: theme.bgSurfaceSubtle,
                      borderColor: theme.border,
                      color: theme.textHeading,
                    }}
                    className="w-full border rounded-xl px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label style={{ color: theme.textBody }} className="text-[11px] font-semibold block mb-1">
                    Durée (minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    style={{
                      backgroundColor: theme.bgSurfaceSubtle,
                      borderColor: theme.border,
                      color: theme.textHeading,
                    }}
                    className="w-full border rounded-xl px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label style={{ color: theme.textBody }} className="text-[11px] font-semibold block mb-1">
                    Catégorie
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) =>
                      setNewCategory(e.target.value as ActivityStep['category'])
                    }
                    style={{
                      backgroundColor: theme.bgSurfaceSubtle,
                      borderColor: theme.border,
                      color: theme.textHeading,
                    }}
                    className="w-full border rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <option value="culture">🏛️ Culture & Art</option>
                    <option value="food">🍷 Gastronomie</option>
                    <option value="viewpoint">🌄 Panorama</option>
                    <option value="nature">🌿 Nature</option>
                    <option value="secret">✨ Pépite Secrète</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: theme.textBody }} className="text-[11px] font-semibold block mb-1">
                    Prix estimé (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    style={{
                      backgroundColor: theme.bgSurfaceSubtle,
                      borderColor: theme.border,
                      color: theme.textHeading,
                    }}
                    className="w-full border rounded-xl px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label style={{ color: theme.textBody }} className="text-[11px] font-semibold block mb-1">
                  Adresse ou quartier
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Ex: Piazzale Napoleone I, Rome"
                  style={{
                    backgroundColor: theme.bgSurfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textHeading,
                  }}
                  className="w-full border rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: theme.primary,
                  color: theme.primaryText,
                  boxShadow: `0 4px 12px ${theme.accentGlow}`,
                }}
                className="w-full py-2.5 font-bold text-xs rounded-xl shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                Confirmer l'ajout
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
