import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Plus,
  Compass,
  MapPin,
  X,
} from 'lucide-react';
import { ActivityStep } from '../utils/travelLogic';
import { Destination } from '../data/destinationsData';
import { processChat, RecommendedPlace } from '../api/chatService';
import { ThemePalette } from '../utils/themeConfig';

interface AuraConciergeProps {
  destination: Destination;
  activeDay: number;
  currentSteps: ActivityStep[];
  currentBudget: number;
  travelers: number;
  isOpen: boolean;
  onClose: () => void;
  onAddStepFromAi: (place: RecommendedPlace) => void;
  theme: ThemePalette;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  places?: RecommendedPlace[];
}

export const AuraConcierge: React.FC<AuraConciergeProps> = ({
  destination,
  activeDay,
  currentSteps,
  currentBudget,
  travelers,
  isOpen,
  onClose,
  onAddStepFromAi,
  theme,
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Bonjour ! Je suis **Aura**, votre concierge voyage à **${destination.name}**. Je connais chaque ruelle secrète, le temps de marche réel entre vos étapes et les meilleurs créneaux sans foule. Que souhaitez-vous ajuster ou découvrir ?`,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (userPrompt?: string) => {
    const textToSend = userPrompt ?? inputValue;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: MessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!userPrompt) setInputValue('');
    setIsLoading(true);

    try {
      let result;
      try {
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            history: messages.map((m) => ({ sender: m.sender, text: m.text })),
            currentTrip: {
              destination: destination.name,
              day: activeDay,
              budget: currentBudget,
              travelers,
              activities: currentSteps.map((s) => ({
                name: s.name,
                time: s.time,
                address: s.address,
                price: s.price,
              })),
            },
          }),
        });
        if (resp.ok) {
          result = await resp.json();
        }
      } catch (err) {
        console.warn('Backend fetch failed, using local processor:', err);
      }

      if (!result) {
        result = await processChat({
          message: textToSend,
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
          currentTrip: {
            destination: destination.name,
            day: activeDay,
            budget: currentBudget,
            travelers,
            activities: currentSteps.map((s) => ({
              name: s.name,
              time: s.time,
              address: s.address,
              price: s.price,
            })),
          },
        });
      }

      const assistantMessage: MessageItem = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: result.text,
        places: result.places,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      console.error('Chat error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Une erreur est survenue lors de la communication. Veuillez réessayer.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    '🍽️ Trouver une pépite resto à 5 min à pied',
    '🌄 Spot coucher de soleil sans touriste',
    '⚡ Réduire les trajets et le temps de marche',
    '🏛️ Rappel des règles & réservations à Rome',
  ];

  if (!isOpen) return null;

  return (
    <div
      style={{
        backgroundColor: theme.bgSurface,
        borderColor: theme.border,
      }}
      className="fixed inset-y-0 right-0 w-full sm:w-[440px] border-l shadow-2xl z-50 flex flex-col transition-transform duration-300"
    >
      {/* Header */}
      <div
        style={{
          borderColor: theme.border,
          backgroundColor: theme.bgSurfaceSubtle,
        }}
        className="p-4 border-b flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{
              background: theme.markerBg,
              color: theme.markerText,
              boxShadow: `0 4px 12px ${theme.accentGlow}`,
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
          >
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 style={{ color: theme.textHeading }} className="font-heading font-bold text-sm flex items-center gap-1.5">
              <span>Aura Concierge</span>
              <span
                style={{
                  backgroundColor: theme.badgeBg,
                  color: theme.badgeText,
                  borderColor: theme.border,
                }}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-mono border font-bold"
              >
                IA Live
              </span>
            </h3>
            <p style={{ color: theme.textMuted }} className="text-[11px]">
              Guide expert & grounding géolocalisé
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ color: theme.textMuted }}
          className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Prompts Bar */}
      <div
        style={{
          borderColor: theme.border,
          backgroundColor: theme.bgSurface,
        }}
        className="p-3 border-b overflow-x-auto no-scrollbar flex items-center gap-2"
      >
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSend(prompt)}
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textBody,
            }}
            className="shrink-0 text-xs px-2.5 py-1 rounded-xl border hover:border-black/30 transition-all cursor-pointer text-left whitespace-nowrap"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div style={{ backgroundColor: theme.bgApp }} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              style={{
                backgroundColor: m.sender === 'user' ? theme.primary : theme.bgSurface,
                color: m.sender === 'user' ? theme.primaryText : theme.textHeading,
                borderColor: m.sender === 'user' ? 'transparent' : theme.border,
                boxShadow: m.sender === 'user' ? `0 4px 14px ${theme.accentGlow}` : '0 2px 8px -2px rgba(0,0,0,0.05)',
              }}
              className="max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed border"
            >
              <div className="whitespace-pre-line space-y-1">
                {m.text.split('\n').map((line, i) => {
                  const formatted = line.replace(
                    /\*\*(.*?)\*\*/g,
                    `<strong>$1</strong>`
                  );
                  return (
                    <p
                      key={i}
                      dangerouslySetInnerHTML={{ __html: formatted }}
                    />
                  );
                })}
              </div>

              {/* Recommended Places Cards */}
              {m.places && m.places.length > 0 && (
                <div style={{ borderColor: theme.border }} className="mt-3 pt-3 border-t space-y-2">
                  <div style={{ color: theme.primary }} className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                    <Compass className="w-3 h-3" />
                    <span>Lieux recommandés par Aura</span>
                  </div>
                  {m.places.map((place, pIdx) => (
                    <div
                      key={pIdx}
                      style={{
                        backgroundColor: theme.bgSurfaceSubtle,
                        borderColor: theme.border,
                      }}
                      className="p-2.5 rounded-xl border flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 style={{ color: theme.textHeading }} className="font-heading font-bold text-xs">
                            {place.name}
                          </h5>
                          <p style={{ color: theme.textMuted }} className="text-[11px] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-stone-400" />
                            <span>{place.address}</span>
                          </p>
                        </div>
                        <span style={{ color: theme.primary }} className="font-mono text-xs font-bold">
                          {place.price > 0 ? `${place.price} €` : 'Gratuit'}
                        </span>
                      </div>
                      <p style={{ color: theme.textBody }} className="text-[11px]">
                        {place.description}
                      </p>
                      {place.tips && (
                        <p style={{ color: theme.accent }} className="text-[10px] font-medium italic">
                          💡 {place.tips}
                        </p>
                      )}
                      <button
                        onClick={() => onAddStepFromAi(place)}
                        style={{
                          backgroundColor: theme.primary,
                          color: theme.primaryText,
                          boxShadow: `0 4px 10px ${theme.accentGlow}`,
                        }}
                        className="mt-1 w-full py-1.5 font-bold text-xs rounded-xl shadow-xs hover:brightness-110 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Ajouter à la journée</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              backgroundColor: theme.bgSurface,
              borderColor: theme.border,
              color: theme.textMuted,
            }}
            className="flex items-center gap-2 p-3.5 rounded-2xl border text-xs w-fit shadow-xs"
          >
            <Sparkles style={{ color: theme.primary }} className="w-4 h-4 animate-spin" />
            <span>Aura prépare vos recommandations...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div
        style={{
          borderColor: theme.border,
          backgroundColor: theme.bgSurface,
        }}
        className="p-3.5 border-t"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Posez une question ou demandez une suggestion..."
            style={{
              backgroundColor: theme.bgSurfaceSubtle,
              borderColor: theme.border,
              color: theme.textHeading,
            }}
            className="flex-1 border rounded-xl px-3.5 py-2.5 text-xs placeholder-stone-400 focus:outline-none focus:border-stone-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            style={{
              backgroundColor: theme.primary,
              color: theme.primaryText,
              boxShadow: `0 4px 12px ${theme.accentGlow}`,
            }}
            className="p-2.5 rounded-xl font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4 fill-current" />
          </button>
        </form>
      </div>
    </div>
  );
};
