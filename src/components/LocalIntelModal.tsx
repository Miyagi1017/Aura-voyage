import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Search,
  BookOpen,
} from 'lucide-react';
import { Destination } from '../data/destinationsData';
import { ThemePalette } from '../utils/themeConfig';

interface LocalIntelModalProps {
  destination: Destination;
  isOpen: boolean;
  onClose: () => void;
  theme: ThemePalette;
}

export const LocalIntelModal: React.FC<LocalIntelModalProps> = ({
  destination,
  isOpen,
  onClose,
  theme,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredInsights = destination.insights.filter((item) => {
    const matchesCat =
      filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tip.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        style={{
          backgroundColor: theme.bgSurface,
          borderColor: theme.border,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        className="w-full max-w-2xl border rounded-3xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div style={{ borderColor: theme.border }} className="flex items-center justify-between pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div
              style={{
                background: theme.markerBg,
                color: theme.markerText,
                boxShadow: `0 4px 12px ${theme.accentGlow}`,
              }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold"
            >
              <BookOpen className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 style={{ color: theme.textHeading }} className="font-heading font-bold text-lg">
                Guide Local & Usages • {destination.name}
              </h3>
              <p style={{ color: theme.textMuted }} className="text-xs">
                Règles obligatoires, coutumes secrètes et bons plans transport
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

        {/* Search & Filter bar */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2 shrink-0">
          <div className="relative w-full sm:flex-1">
            <Search style={{ color: theme.textMuted }} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une règle, ZTL, pourboire..."
              style={{
                backgroundColor: theme.bgSurfaceSubtle,
                borderColor: theme.border,
                color: theme.textHeading,
              }}
              className="w-full border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-stone-500"
            />
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Tout' },
              { id: 'formalite', label: 'Formalités' },
              { id: 'transport', label: 'Transports' },
              { id: 'coutume', label: 'Coutumes' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                style={{
                  backgroundColor: filterCategory === tab.id ? theme.badgeBg : 'transparent',
                  borderColor: filterCategory === tab.id ? theme.primary : 'transparent',
                  color: filterCategory === tab.id ? theme.primary : theme.textBody,
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredInsights.length === 0 ? (
            <div style={{ color: theme.textMuted }} className="p-8 text-center text-xs">
              Aucun résultat pour cette recherche.
            </div>
          ) : (
            filteredInsights.map((insight) => (
              <div
                key={insight.id}
                style={{
                  backgroundColor: theme.bgSurfaceSubtle,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-2xl border hover:border-black/20 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        backgroundColor: theme.badgeBg,
                        color: theme.badgeText,
                        borderColor: theme.border,
                      }}
                      className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border"
                    >
                      {insight.badge}
                    </span>
                    <h4 style={{ color: theme.textHeading }} className="font-heading font-bold text-sm">
                      {insight.title}
                    </h4>
                  </div>
                </div>
                <p style={{ color: theme.textBody }} className="text-xs leading-relaxed mb-2">
                  {insight.description}
                </p>
                <div
                  style={{
                    backgroundColor: theme.bgSurface,
                    borderColor: theme.border,
                    color: theme.textHeading,
                  }}
                  className="p-2.5 rounded-xl border text-[11px] flex items-start gap-2 shadow-xs"
                >
                  <Sparkles style={{ color: theme.primary }} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Le conseil d'initié :</strong> {insight.tip}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ borderColor: theme.border }} className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span>Actualisé pour chaque destination</span>
          <button
            onClick={onClose}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              color: theme.textHeading,
              borderColor: theme.border,
            }}
            className="px-4 py-2 border rounded-xl font-semibold transition-colors cursor-pointer hover:bg-black/5"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
