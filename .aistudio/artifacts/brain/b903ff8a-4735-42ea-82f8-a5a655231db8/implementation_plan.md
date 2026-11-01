# Aura Voyage — Créateur de Trajet Sur Mesure & Découverte Jour/Soirée

Plan d'architecture et de conception pour transformer l'atelier Aura Voyage en un créateur d'itinéraire interactif complet, avec calcul multi-mode des temps de trajet entre étapes, carrousel de découverte jour/nuit en première page, carte interactive escamotable en coin flottant, et annulation rapide (Undo) des déplacements.

---

### Décisions Validées & Synthèse Utilisateur

> [!IMPORTANT]
> **Choix confirmés suite aux questions de cadrage :**
> - **Affichage cartographique** : Carte masquée par défaut, qui s'ouvre de manière fluide dans un **coin interactif flottant** (ou tiroir extensible) dès qu'un lieu ou une étape est sélectionné(e), avec possibilité de bascule en plein écran ou épinglage.
> - **Présentation des lieux alentour & vie nocturne** : **Carrousel direct en première page** trié par proximité et géolocalisation, séparé en activités diurnes et expériences nocturnes (dîner gastronomique, bars speakeasy, spectacles, rooftops).
> - **Calcul des trajets entre étapes** : Estimation **multi-modes dynamique (à pied et en voiture)** avec distance métrique exacte en kilomètres et temps estimé selon le profil de circulation.
> - **Annulation rapide (Undo)** : Pile d'historique instantanée permettant de défaire en 1 clic (ou raccourci `Ctrl+Z`) le dernier glisser-déposer ou réordonnancement d'étape.

---

### 1. Vue d'Ensemble & Proposition de Valeur

- **Ce que fait le produit** : Un studio de composition de voyage intuitif où l'utilisateur assemble son parcours sur mesure journée par journée. Il sélectionne ses activités parmi les spots phares et les lieux secrets alentour (matin, après-midi, dîner et nocturne), visualise les temps de transfert entre chaque arrêt, inspecte les coordonnées dans un coin cartographique réactif, et bénéficie d'un filet de sécurité grâce à l'annulation rapide des déplacements.
- **Utilisateurs cibles** : Voyageurs indépendants, couples ou groupes d'amis souhaitant concevoir une journée équilibrée sans temps mort, de l'exploration culturelle du matin jusqu'aux festivités de la nuit.
- **Bénéfice clé** : Fini les allers-retours fastidieux entre cartes et blocs-notes ; les trajets sont calculés automatiquement, les conflits horaires prévenus en temps réel, et la carte reste discrète pour préserver la clarté de navigation.

---

### 2. Expérience Utilisateur & Direction Visuelle

#### Parcours Utilisateur
1. **Première page & Carrousel Découverte** :
   - Bandeau supérieur interactif avec filtres d'ambiance : **Journée** (Monuments, Balades, Musées, Cafés) et **Soirée & Nuit** (Dîners réputés, Bars à cocktails, Clubs, Panoramas nocturnes).
   - Bouton d'ajout instantané `+ Ajouter à mon trajet` qui insère l'activité dans le jour actif avec créneau horaire optimal calculé.
2. **Timeline Vivante & Connecteurs de Trajet** :
   - Entre chaque étape consécutive, un connecteur visuel affiche la distance (ex: `1.8 km`), le temps à pied (ex: `22 min`) et en voiture (ex: `8 min`), avec bascule de mode préférée.
   - Glisser-déposer libre entre créneaux et entre jours avec notification discrète et bouton d'annulation immédiate `Annuler le déplacement`.
3. **Coin Cartographique Interactif (Floating Corner Map)** :
   - Discrète pastille d'appel flottante en bas à gauche de l'écran avec indicateur du nombre de lieux programmés.
   - Au clic sur n'importe quel lieu ou étape, le coin s'ouvre avec une animation soignée (380x320px sur desktop, extensible en volet complet), centré sur le marqueur du lieu, traçant l'itinéraire vers la prochaine étape.
   - Boutons de contrôle : recentrer, agrandir, masquer.

#### Charte Graphique & Palette "Regal Twilight"
- **Base Noble & Nuit** : `#131122` (Abyssal Twilight), `#18152B` (Surface Card), `#4D4865` (Améthyste Brumeuse).
- **Accents Or & Champagne** : `#CDB683` (Imperial Champagne), `#A08B62` (Antique Gold).
- **Nuances Claires & Lisibilité** : `#E0DCD1` (Marbre Crème), `#CCC0AD` (Tuffeau Lumineux), `#C8C6D2` (Reflet Argenté).
- **Typographie** : `Plus Jakarta Sans` pour les commandes et interfaces nettes, `Syne` pour les titres de destinations et moments forts, `JetBrains Mono` avec `tabular-nums` pour les distances, vitesses et durées.
- **Règles Anti-Slop** : Zéro badges multicolores empilés, zéro fausses jauges d'IA, bordures fines 1px texturées, retours d'actions en moins de 150ms.

---

### 3. Décisions Produit & Justifications

- **Décision 1 : Carte escamotable en coin flottant vs panneau gauche permanent**
  - *Choix* : Carte minimisée par défaut, avec fenêtre d'inspection flottante au format coin interactif (Coin inférieur gauche) s'animant lors de la sélection d'un lieu.
  - *Raison* : Offre un espace maximal à la timeline et au carrousel de découverte sur la page d'accueil, tout en permettant une consultation géographique instantanée au moindre clic.
- **Décision 2 : Calcul multi-modes réaliste (À pied vs Voiture)**
  - *Choix* : Algorithme géodésique de Haversine couplé à un profil d'allure urbaine (vitesse piétonne ~4.5 km/h avec coefficient de sinuosité urbaine 1.25x, et vitesse automobile urbaine ~22 km/h avec temps de stationnement/démarrage forfaitaire de 4 min).
  - *Raison* : Fournit une estimation fiable et actionnable sans dépendre d'une clé API externe payante, réactive hors-ligne en temps réel.
- **Décision 3 : Système d'Undo avec pile d'historique légère**
  - *Choix* : Mécanisme d'état immuable mémorisant les snapshots des étapes avant tout déplacement, avec toast d'annulation rapide (5 secondes) et raccourci clavier `Cmd/Ctrl+Z`.
  - *Raison* : Sécurise l'expérience utilisateur tactile et gestuelle sur desktop et tablette sans surcharger la mémoire.

---

### 4. Architecture Technique & Flux de Données

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AURA VOYAGE WORKSPACE                           │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand Aura Voyage · Sélecteur Thème · Export & Undo)  │
├────────────────────────────────────────────────────────────────────────┤
│  1. Carrousel Découverte Direct (Journée vs Soirée / Dîner / Nocturne) │
│     [Filtres Proximité] ─ [Cartes Lieux Alentour] ─ [Bouton + Trajet] │
├────────────────────────────────────────────────────────────────────────┤
│  2. Éditeur d'Itinéraire & Timeline Gestuelle                          │
│     ┌──────────────────────────────────────────────────────────────┐   │
│     │ Étape 1: 09:30 Visite Palais                                  │   │
│     │  └─ [Transit Connector: 1.2 km · 🚶 15 min · 🚗 6 min]       │   │
│     │ Étape 2: 12:30 Déjeuner Bistro Local                          │   │
│     │  └─ [Transit Connector: 2.4 km · 🚶 32 min · 🚗 9 min]       │   │
│     │ Étape 3: 20:00 Dîner & Soirée Rooftop                         │   │
│     └──────────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────────┤
│  3. Coin Cartographique Interactif (Floating Corner Map - Bas Gauche)  │
│     [Toggle Réduire/Agrandir] ─ [Vue Active / Trajet Tracé]            │
└────────────────────────────────────────────────────────────────────────┘
```

#### Modèle de Données & État
- `TransitMetrics` :
  ```ts
  interface TransitMetrics {
    distanceKm: number;
    walkMinutes: number;
    driveMinutes: number;
    originCoords: { lat: number; lng: number };
    destinationCoords: { lat: number; lng: number };
  }
  ```
- `UndoHistoryEntry` :
  ```ts
  interface HistoryAction {
    description: string;
    previousDays: DayPlan[];
    timestamp: number;
  }
  ```
- `DiscoveryPlace` : enrichi des attributs de soirée (`timeSlotCategory: 'day' | 'evening' | 'night'`, ambiances, fourchettes de prix, coordonnées GPS).

---

### 5. Plan de Déploiement & Validation

1. **Module de calcul des trajets (`src/utils/travelLogic.ts`)** :
   - Enrichissement avec calcul multi-modes (marche / voiture), distance kilométrique précise et temps de transfert.
   - Ajout des tests unitaires correspondants dans `travelLogic.test.ts`.
2. **Carrousel Découverte Journée & Soirée (`src/components/DiscoveryCarousel.tsx`)** :
   - Mise en avant directe en première page avec catégories Jour / Dîner / Nuit.
   - Ajout d'étape en 1 clic dans l'itinéraire avec recalcul automatique des trajets.
3. **Coin Cartographique Interactif (`src/components/CornerInteractiveMap.tsx`)** :
   - Carte flottante escamotable en bas à gauche avec animation d'ouverture douce, centrage au clic sur un lieu, et affichage du trajet sélectionné.
4. **Système d'Annulation Rapide (Undo)** :
   - Gestionnaire de pile d'annulation dans `App.tsx` avec barre d'état et raccourci clavier.
5. **Vérification & Robustesse** :
   - Tests unitaires `npx --yes tsx --test`, compilation TypeScript et validation du serveur de dev.
