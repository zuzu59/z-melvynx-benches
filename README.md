# 🌍 Earthquake Explorer

Explorateur interactif d'activité sismique mondiale en temps réel, alimenté par les données publiques de l'USGS (United States Geological Survey).

![Earthquake Explorer](https://img.shields.io/badge/status-live-green) ![USGS Data](https://img.shields.io/badge/data-USGS-orange) ![Vite](https://img.shields.io/badge/vite-8.x-cyan)

## ✨ Fonctionnalités

- 🗺️ **Carte interactive** avec fond de carte sombre (CartoDB Dark)
- 📍 **Marqueurs individuels** pour chaque séisme — pas de regroupement
- 🎨 **Code couleur par magnitude** : du vert (mineur) au rouge foncé (majeur)
- 🔍 **Filtres** : plage temporelle (24h, 7j, 30j) et magnitude minimale
- 📋 **Panneau de détails** au clic sur un événement
- 🔄 **Actualisation automatique** toutes les 5 minutes
- 📱 **Interface responsive** et soignée

## 🛠️ Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build | [Vite](https://vite.dev) |
| Style | [Tailwind CSS v4](https://tailwindcss.com) |
| Carte | [Leaflet](https://leafletjs.com) + [react-leaflet](https://react-leaflet.js.org) |
| Données | [USGS FDSNWS API](https://earthquake.usgs.gov/fdsnws/event/1/) |

## 📦 Installation

```bash
# Cloner le dépôt
git clone https://github.com/zuzu59/z-melvynx-benches.git
cd z-melvynx-benches
git checkout tests-earthquake-ornith-1

# Installer les dépendances
npm install
```

## 🚀 Démarrage

```bash
# Mode développement (HMR inclus)
npm run dev

# Build de production
npm run build

# Prévisualiser le build
npm run preview
```

Le serveur de développement démarre sur `http://localhost:5173/`.

Pour exposer l'app sur le réseau local :

```bash
npx vite --host 0.0.0.0 --port 5173
```

## 🌐 Source de données

L'application utilise l'[API publique USGS](https://earthquake.usgs.gov/fdsnws/event/1/query) — aucune clé API n'est requise. Les données proviennent directement du [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/) et sont actualisées en continu.

### Exemple d'appel API

```
https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2&orderby=time
```

## 📖 Utilisation

1. **Ouvrir** l'application dans un navigateur
2. **Explorer** la carte mondiale remplie de marqueurs colorés
3. **Filtrer** la vue via :
   - Le sélecteur de **plage temporelle** (24h, 7 jours, 30 jours)
   - Le curseur de **magnitude minimale**
4. **Cliquer** sur un marqueur pour voir les détails dans le panneau latéral
5. **Consulter** la liste des événements triée par magnitude dans le panneau de gauche
6. **Suivre** les alertes (alertes USGS) et les signaux de tsunami

### Code couleur des magnitudes

| Magnitude | Couleur | Catégorie |
|-----------|---------|-----------|
| < 2 | 🟢 Vert | Très mineur |
| 2 – 2.9 | 🟢 Vert | Mineur |
| 3 – 3.9 | 🟡 Vert clair | Mineur |
| 4 – 4.9 | 🟡 Jaune | Modéré |
| 5 – 5.9 | 🟠 Orange | Modéré fort |
| 6 – 6.9 | 🔴 Rouge-orange | Fort |
| 7 – 7.9 | 🔴 Rouge | Majeur |
| ≥ 8 | 🔴 Rouge foncé | Très majeur |

## 🏗️ Structure du projet

```
├── index.html                # Point d'entrée HTML
├── package.json              # Dépendances du projet
├── vite.config.ts            # Configuration Vite + Tailwind
├── tsconfig.app.json         # Configuration TypeScript
├── src/
│   ├── main.tsx              # Montage de l'application
│   ├── App.tsx               # Composant principal (explorateur)
│   └── index.css             # Styles Tailwind
└── dist/                     # Build de production (généré)
```

## 📄 Licence

[LICENSE](./LICENSE) — Voir le fichier LICENSE pour les détails.

## 🙏 Crédits

- Données sismiques : [USGS](https://earthquake.usgs.gov/)
- Fond de carte : [CartoDB](https://carto.com/) / [OpenStreetMap](https://www.openstreetmap.org/)
- Bibliothèque cartographique : [Leaflet](https://leafletjs.com/) (MIT)

---

> Construit avec ❤️ pour explorer la dynamique de notre planète.
