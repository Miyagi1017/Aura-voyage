import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Activity } from '../types/travel';
import { TimeField } from './TimeField';
import { normalizeTime } from '../data/time';

interface ActivityTimeModalProps {
  isOpen: boolean;
  activity: Activity | null;
  /** Tranche horaire sélectionnée dans Explorer, pour rappel. */
  slot?: { start: string; end: string } | null;
  onClose: () => void;
  onConfirm: (time: string) => void;
}

/**
 * Au moment d'ajouter une activité au séjour, l'utilisateur choisit
 * lui-même l'heure à laquelle il souhaite la faire.
 */
export const ActivityTimeModal: React.FC<ActivityTimeModalProps> = ({
  isOpen,
  activity,
  slot,
  onClose,
  onConfirm,
}) => {
  const [time, setTime] = useState(activity?.time ?? '18:00');

  useEffect(() => {
    if (isOpen && activity) setTime(slot?.start ?? activity.time);
  }, [isOpen, activity, slot]);

  if (!isOpen || !activity) return null;

  const slotLabel = slot ? `${slot.start} – ${slot.end}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-xs animate-in fade-in duration-200 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl border border-line bg-white shadow-2xl sm:rounded-[26px]">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              Ajouter au séjour
            </span>
            <h3 className="font-serif text-xl font-semibold leading-tight text-ink">
              À quelle heure ?
            </h3>
            <p className="mt-0.5 text-[11px] text-muted">
              Choisissez librement l'heure de cette activité.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le choix de l'horaire"
            className="cursor-pointer rounded-full p-2 text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-2xl border border-line bg-paper p-3">
            <p className="text-sm font-semibold text-ink">{activity.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted">{activity.address}</p>
            {slotLabel && (
              <p className="mt-1 text-[10px] font-medium text-accent">
                Tranche choisie dans Explorer : {slotLabel}
              </p>
            )}
          </div>

          <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-muted">
            Heure souhaitée
          </label>
          <TimeField
            value={time}
            onChange={setTime}
            ariaLabel="Heure souhaitée pour l'activité"
            placeholder="ex: 21:30"
            large
            className="mt-1.5"
          />
          <p className="mt-1 text-[10px] text-muted">
            Aucune limite : de 00:00 à 29:59 (24:00 et au-delà = après minuit). L'étape se place
            dans l'ordre et les trajets du jour sont recalculés.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-line bg-white px-4 py-2.5 text-xs font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              const normalized = normalizeTime(time);
              if (!normalized) return;
              onConfirm(normalized);
            }}
            className="inline-flex cursor-pointer items-center rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
          >
            Ajouter à {time || '--:--'}
          </button>
        </div>
      </div>
    </div>
  );
};
