import React, { useState } from 'react';
import {
  Coins,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { Destination } from '../data/destinationsData';
import { ThemePalette } from '../utils/themeConfig';

interface BudgetFlightDeckProps {
  destination: Destination;
  totalSpent: number;
  currentBudget: number;
  travelers: number;
  daysCount: number;
  onChangeBudget: (newBudget: number) => void;
  isOpen: boolean;
  onClose: () => void;
  theme: ThemePalette;
}

export const BudgetFlightDeck: React.FC<BudgetFlightDeckProps> = ({
  destination,
  totalSpent,
  currentBudget,
  travelers,
  daysCount,
  onChangeBudget,
  isOpen,
  onClose,
  theme,
}) => {
  const [targetCurrency, setTargetCurrency] = useState<'EUR' | 'USD' | 'JPY' | 'GBP'>('EUR');

  const currencyRates: Record<string, { rate: number; symbol: string }> = {
    EUR: { rate: 1, symbol: '€' },
    USD: { rate: 1.08, symbol: '$' },
    JPY: { rate: 165, symbol: '¥' },
    GBP: { rate: 0.85, symbol: '£' },
  };

  const percentageSpent = Math.min(100, Math.round((totalSpent / currentBudget) * 100));
  const remainingBudget = currentBudget - totalSpent;
  const costPerPersonPerDay = Math.round(totalSpent / (travelers * daysCount));

  const convert = (eurAmount: number) => {
    const info = currencyRates[targetCurrency];
    const val = eurAmount * info.rate;
    if (targetCurrency === 'JPY') {
      return `${Math.round(val).toLocaleString()} ${info.symbol}`;
    }
    return `${val.toFixed(1)} ${info.symbol}`;
  };

  const budgetTiers = [
    { label: 'Essentiel', amount: 450, desc: 'Bistrots locaux & visites libres' },
    { label: 'Équilibré', amount: 680, desc: 'Coupe-files, trattorias & cafés' },
    { label: 'Confort', amount: 1100, desc: 'Guides privés & belles tables' },
    { label: 'Signature', amount: 1900, desc: 'Luxe, dégustations & transferts' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        style={{
          backgroundColor: theme.bgSurface,
          borderColor: theme.border,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        className="w-full max-w-xl border rounded-3xl p-6 relative overflow-hidden"
      >
        {/* Header */}
        <div style={{ borderColor: theme.border }} className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <div
              style={{
                background: theme.markerBg,
                color: theme.markerText,
                boxShadow: `0 4px 12px ${theme.accentGlow}`,
              }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold"
            >
              <Coins className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 style={{ color: theme.textHeading }} className="font-heading font-bold text-lg">
                Cockpit Budget & Devises
              </h3>
              <p style={{ color: theme.textMuted }} className="text-xs">
                {destination.name} • {travelers} voyageurs • {daysCount} jours
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: theme.textMuted }}
            className="p-2 rounded-xl hover:bg-black/5 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currency Switcher Bar */}
        <div
          style={{
            backgroundColor: theme.bgSurfaceSubtle,
            borderColor: theme.border,
          }}
          className="mt-5 p-3 rounded-2xl border flex items-center justify-between"
        >
          <div style={{ color: theme.textBody }} className="flex items-center gap-2 text-xs font-medium">
            <ArrowRightLeft style={{ color: theme.primary }} className="w-4 h-4" />
            <span>Devise d'affichage :</span>
          </div>
          <div className="flex gap-1">
            {(['EUR', 'USD', 'JPY', 'GBP'] as const).map((curr) => (
              <button
                key={curr}
                onClick={() => setTargetCurrency(curr)}
                style={{
                  backgroundColor: targetCurrency === curr ? theme.primary : 'transparent',
                  color: targetCurrency === curr ? theme.primaryText : theme.textBody,
                }}
                className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer shadow-xs"
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        {/* Main Gauge & Metrics */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
            }}
            className="p-4 rounded-2xl border flex flex-col justify-between"
          >
            <span style={{ color: theme.textMuted }} className="text-[11px] font-semibold">Dépenses actuelles</span>
            <div style={{ color: theme.primary }} className="mt-2 font-mono text-2xl font-bold">
              {convert(totalSpent)}
            </div>
            <span style={{ color: theme.textMuted }} className="text-[10px] mt-1">
              Activités & réservations
            </span>
          </div>

          <div
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
            }}
            className="p-4 rounded-2xl border flex flex-col justify-between"
          >
            <span style={{ color: theme.textMuted }} className="text-[11px] font-semibold">Enveloppe cible</span>
            <div style={{ color: theme.textHeading }} className="mt-2 font-mono text-2xl font-bold">
              {convert(currentBudget)}
            </div>
            <span style={{ color: theme.textMuted }} className="text-[10px] mt-1">
              Reste {convert(remainingBudget)}
            </span>
          </div>

          <div
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
            }}
            className="p-4 rounded-2xl border flex flex-col justify-between"
          >
            <span style={{ color: theme.textMuted }} className="text-[11px] font-semibold">Coût / pers. / jour</span>
            <div style={{ color: theme.accent }} className="mt-2 font-mono text-2xl font-bold">
              {convert(costPerPersonPerDay)}
            </div>
            <span style={{ color: theme.textMuted }} className="text-[10px] mt-1">
              Pour {travelers} voyageur(s)
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span style={{ color: theme.textBody }}>Consommation du budget</span>
            <span
              style={{ color: percentageSpent > 90 ? '#E11D48' : theme.primary }}
              className="font-bold"
            >
              {percentageSpent}%
            </span>
          </div>
          <div
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
            }}
            className="w-full h-3 rounded-full overflow-hidden border"
          >
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${percentageSpent}%`,
                backgroundColor: percentageSpent > 90 ? '#E11D48' : theme.primary,
              }}
            />
          </div>
        </div>

        {/* Budget Tiers Preset Selection */}
        <div className="mt-6">
          <label style={{ color: theme.textBody }} className="text-xs font-semibold block mb-2">
            Ajuster mon profil de dépenses :
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {budgetTiers.map((tier) => (
              <button
                key={tier.label}
                onClick={() => onChangeBudget(tier.amount)}
                style={{
                  backgroundColor: currentBudget === tier.amount ? theme.badgeBg : theme.bgSurfaceSubtle,
                  borderColor: currentBudget === tier.amount ? theme.primary : theme.border,
                }}
                className="p-3 rounded-2xl border text-left transition-all cursor-pointer"
              >
                <div style={{ color: theme.textHeading }} className="font-heading font-bold text-xs">
                  {tier.label}
                </div>
                <div style={{ color: theme.primary }} className="font-mono text-sm font-bold mt-0.5">
                  {tier.amount} €
                </div>
                <div style={{ color: theme.textMuted }} className="text-[10px] mt-1 line-clamp-1">
                  {tier.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Slider */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs mb-1">
            <span style={{ color: theme.textBody }}>Curseur personnalisé :</span>
            <span style={{ color: theme.primary }} className="font-mono text-xs font-bold">
              {currentBudget} €
            </span>
          </div>
          <input
            type="range"
            min="200"
            max="3000"
            step="50"
            value={currentBudget}
            onChange={(e) => onChangeBudget(Number(e.target.value))}
            style={{ accentColor: theme.primary }}
            className="w-full cursor-pointer"
          />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            backgroundColor: theme.primary,
            color: theme.primaryText,
            boxShadow: `0 4px 14px ${theme.accentGlow}`,
          }}
          className="mt-6 w-full py-2.5 font-bold text-xs rounded-2xl hover:brightness-110 transition-all cursor-pointer"
        >
          Appliquer & Retourner au carnet
        </button>
      </div>
    </div>
  );
};
