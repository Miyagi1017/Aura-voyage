import React from 'react';
import { Trip } from '../types/travel';
import { BudgetPlanner } from './BudgetPlanner';

interface ContextPanelProps {
  trip: Trip;
  currentDay: number;
  onAddStep: () => void;
  onOpenChat: () => void;
  onOpenRestrictions: () => void;
  onBudgetChange: (value: number) => void;
  totalCost: number;
  userName?: string;
  profileStyle?: string;
}

/**
 * Colonne de contexte : le séjour, la météo, le budget et les actions clés.
 * Volontairement dépouillée : des chiffres, du texte, aucun ornement.
 */
export const ContextPanel: React.FC<ContextPanelProps> = ({
  trip,
  currentDay,
  onAddStep,
  onOpenChat,
  onOpenRestrictions,
  onBudgetChange,
  totalCost,
  userName,
  profileStyle,
}) => {
  const city = trip.destination.split(',')[0];
  const activeRestrictions = trip.restrictions.filter((r) => r.status === 'obligatoire');
  const weather = trip.weather;

  return (
    <div className="space-y-4">
      {/* Séjour en cours */}
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            Votre séjour
          </span>
          <span className="text-[10px] text-muted">{trip.duration}</span>
        </div>
        <p className="mt-1.5 font-serif text-base font-semibold text-ink">{trip.dates}</p>

        <div className="mt-3 flex gap-1" aria-hidden="true">
          {Array.from({ length: trip.daysCount }, (_, i) => i + 1).map((day) => (
            <span
              key={day}
              className={`h-1 flex-1 rounded-full ${
                day <= currentDay ? 'bg-ink' : 'bg-paper-deep'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Jour {currentDay} sur {trip.daysCount} · {trip.travelers} voyageur
          {trip.travelers > 1 ? 's' : ''}
        </p>
      </div>

      {/* Météo */}
      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Météo à {city}
        </p>
        <p className="mt-1 font-serif text-xl font-semibold leading-tight text-ink">
          {weather ? `${weather.temperature}°C · ${weather.condition}` : '22°C · Ensoleillé'}
        </p>
        <p className="mt-1 text-[11px] font-medium text-emerald-700">
          {weather?.advice ?? 'Idéal pour marcher'}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {weather?.summary ??
            'Ciel dégagé toute la journée. Prévoyez des lunettes de soleil et une gourde.'}
        </p>
      </div>

      {/* Budget & enveloppe ajustable (curseur 0 → 100 000 €) */}
      <BudgetPlanner
        value={trip.budgetTotal}
        onChange={onBudgetChange}
        spent={totalCost}
        travelers={trip.travelers}
        days={trip.daysCount}
        city={city}
        userName={userName}
        profileStyle={profileStyle}
      />

      {/* Action */}
      <div className="space-y-2">
        <button
          onClick={onAddStep}
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-line-strong hover:bg-paper"
        >
          + Ajouter une étape
        </button>
      </div>

      {/* Restrictions */}
      <button
        onClick={onOpenRestrictions}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-line-strong"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-ink">Infos pratiques</span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {activeRestrictions.length} règle{activeRestrictions.length > 1 ? 's' : ''} à {city}
          </span>
        </span>
        <span className="shrink-0 text-muted" aria-hidden="true">→</span>
      </button>

      {/* Concierge */}
      <button
        onClick={onOpenChat}
        className="w-full rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-line-strong"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Concierge local
        </span>
        <span className="mt-1 block font-serif text-base font-semibold leading-snug text-ink">
          Une question sur {city} ?
        </span>
        <span className="mt-1 block text-[11px] leading-relaxed text-muted">
          Une table, un itinéraire vélo ou le meilleur horaire sans file d'attente.
        </span>
        <span className="mt-2 block text-[11px] font-semibold text-ink">Ouvrir le chat →</span>
      </button>
    </div>
  );
};
