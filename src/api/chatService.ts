import { GoogleGenAI } from '@google/genai';

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  currentTrip?: {
    destination: string;
    day: number;
    budget: number;
    travelers: number;
    activities: Array<{ name: string; time: string; address: string; price: number }>;
  };
}

export interface RecommendedPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: 'culture' | 'food' | 'nature' | 'viewpoint' | 'walk' | 'secret';
  price: number;
  durationMinutes: number;
  description: string;
  tips?: string;
}

export interface ChatResponse {
  text: string;
  places: RecommendedPlace[];
}

const MODEL = 'gemini-2.5-flash';

export async function processChat(payload: ChatRequest): Promise<ChatResponse> {
  const { message, history = [], currentTrip } = payload;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateSmartFallback(message, currentTrip);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-aura-voyage' } },
    });

    const tripContext = currentTrip
      ? `Destination: ${currentTrip.destination}, Jour ${currentTrip.day}, Budget: ${currentTrip.budget}€, Voyageurs: ${currentTrip.travelers}.
Activités prévues aujourd'hui: ${
          currentTrip.activities
            ?.map((a) => `${a.time} - ${a.name} (${a.price}€)`)
            .join(', ') || 'Aucune'
        }`
      : 'Aucun voyage spécifique sélectionné.';

    const systemInstruction = `Tu es Aura Concierge, un expert en voyage ultra-précis, chaleureux et raffiné.
${tripContext}
Missions:
1. Répondre avec style, clarté et concision (conseils d'initié, secrets locaux, horaires malins, astuces pour éviter la foule).
2. Si tu suggères des lieux à visiter, manger ou admirer, inclus impérativement à la toute fin de ta réponse un bloc JSON pur nommé places :
\`\`\`places
[
  {
    "name": "Nom du lieu",
    "address": "Adresse ou quartier précis",
    "lat": 41.8902,
    "lng": 12.4922,
    "category": "culture" | "food" | "nature" | "viewpoint" | "secret",
    "price": 15,
    "durationMinutes": 60,
    "description": "Brève description en une phrase",
    "tips": "Astuce pratique"
  }
]
\`\`\`
L'application utilisera ce bloc pour permettre à l'utilisateur d'ajouter ces étapes en 1 clic sur sa carte et son itinéraire !`;

    const contents = [];
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const rawText = response.text || '';
    const { cleanText, places } = extractPlacesFromJsonBlock(rawText);

    return {
      text: cleanText,
      places,
    };
  } catch (err) {
    console.warn('Gemini chat error, falling back to smart local guide:', err);
    return generateSmartFallback(message, currentTrip);
  }
}

function extractPlacesFromJsonBlock(raw: string): { cleanText: string; places: RecommendedPlace[] } {
  let cleanText = raw;
  const places: RecommendedPlace[] = [];

  const placesRegex = /```places\s*([\s\S]*?)\s*```/;
  const match = raw.match(placesRegex);

  if (match && match[1]) {
    cleanText = raw.replace(match[0], '').trim();
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.name && item.lat && item.lng) {
            places.push({
              name: String(item.name),
              address: String(item.address || ''),
              lat: Number(item.lat),
              lng: Number(item.lng),
              category: item.category || 'culture',
              price: Number(item.price) || 0,
              durationMinutes: Number(item.durationMinutes) || 60,
              description: String(item.description || ''),
              tips: item.tips ? String(item.tips) : undefined,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed parsing places JSON block:', e);
    }
  }

  return { cleanText, places };
}

function generateSmartFallback(
  message: string,
  currentTrip?: ChatRequest['currentTrip']
): ChatResponse {
  const dest = currentTrip?.destination?.toLowerCase() || 'rome';
  const lower = message.toLowerCase();

  if (dest.includes('rome') || lower.includes('rome')) {
    if (lower.includes('manger') || lower.includes('restaurant') || lower.includes('dîner') || lower.includes('faim')) {
      return {
        text: `Pour une expérience culinaire inoubliable à **Rome**, voici deux adresses confidentielles très prisées des Romains :\n\n• **Trattoria Da Enzo al 29** (Trastevere) : La référence absolue pour les pâtes *Cacio e Pepe* et *Carciofo alla Giudia* (artichaut frit).\n• **Roscioli Salumeria con Cucina** : Épicerie fine centenaire avec une cave exceptionnelle et une Carbonara préparée avec du guanciale croustillant au millimètre.`,
        places: [
          {
            name: 'Trattoria Da Enzo al 29',
            address: 'Via dei Vascellari, 29, Rome',
            lat: 41.8885,
            lng: 12.4777,
            category: 'food',
            price: 28,
            durationMinutes: 75,
            description: 'Véritable institution du Trastevere pour la cuisine romaine authentique.',
            tips: 'Arrivez 15 minutes avant le service du midi.',
          },
          {
            name: 'Roscioli Salumeria con Cucina',
            address: 'Via dei Giubbonari, 21, Rome',
            lat: 41.8943,
            lng: 12.4742,
            category: 'food',
            price: 38,
            durationMinutes: 80,
            description: 'Comptoir gastronomique d’exception et sélection de charcuteries rares.',
            tips: 'Réservation impérative pour le dîner.',
          },
        ],
      };
    }

    if (lower.includes('sunset') || lower.includes('coucher') || lower.includes('vue') || lower.includes('photo')) {
      return {
        text: `Voici les deux spots les plus magiques pour admirer le coucher de soleil à **Rome** :\n\n• **Giardino degli Aranci** (Mont Aventin) : Parfum des orangers en fleur et panorama doré sur la coupole de Saint-Pierre.\n• **Belvédère du Janicule (Gianicolo)** : Vue plongeante à 180° sur les toits baroques de Rome lorsque les cloches du crépuscule sonnent.`,
        places: [
          {
            name: 'Giardino degli Aranci',
            address: 'Piazza Pietro D\'Illiria, Rome',
            lat: 41.8845,
            lng: 12.4795,
            category: 'viewpoint',
            price: 0,
            durationMinutes: 45,
            description: 'Parc perché avec vue crépusculaire féerique sur le dôme de Saint-Pierre.',
            tips: 'Regardez aussi par le trou de serrure des Chevaliers de Malte à 200m !',
          },
        ],
      };
    }

    return {
      text: `À **Rome**, la règle d'or est de regrouper vos visites par quartier pour minimiser la marche sur les pavés "sanpietrini". \n\n• **Matinée** : Privilégiez le Colisée et le Forum avant la chaleur et la foule.\n• **Après-midi** : Flânez vers le Panthéon et la Piazza Navona où l'atmosphère s'anime.\n• **Fin de journée** : Traversez le pont Sisto vers le Trastevere pour l'aperitivo.`,
      places: [
        {
          name: 'Piazza Navona',
          address: 'Piazza Navona, Rome',
          lat: 41.8992,
          lng: 12.4731,
          category: 'viewpoint',
          price: 0,
          durationMinutes: 45,
          description: 'Place baroque ornée de la fontaine des Quatre-Fleuves du Bernin.',
          tips: 'Idéal en fin d’après-midi pour les musiciens de rue.',
        },
      ],
    };
  }

  // Generic reply for other cities
  return {
    text: `Bienvenue dans votre atelier de voyage ! Je peux analyser vos étapes, calculer les temps de marche réels, vous proposer des adresses d'initiés méconnues ou résoudre immédiatement les conflits d'horaires. De quoi avez-vous envie maintenant ?`,
    places: [],
  };
}
