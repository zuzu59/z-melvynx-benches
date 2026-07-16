# Earthquake Explorer

Earthquake Explorer est un visualiseur en direct de l’activité sismique USGS.
Il affiche les séismes récents sur une vraie carte, avec un point par événement, coloré selon la magnitude et la profondeur.

## Ce que fait l’application

- Affiche les données sismiques en direct depuis l’API GeoJSON de l’USGS
- Place chaque séisme à ses vraies coordonnées géographiques
- Permet de filtrer par période, magnitude, profondeur, événements spéciaux, texte de recherche et zone visible de la carte
- Permet de trier les événements et de cliquer sur un point ou un élément de la liste pour voir les détails
- Se rafraîchit automatiquement toutes les 5 minutes

## Comment démarrer

C’est une application statique. Tu peux la servir avec n’importe quel serveur local.

### Avec Python

```bash
python3 -m http.server 4174 --bind 0.0.0.0
```

Puis ouvre :

```text
http://localhost:4174
```

## Comment l’utiliser

- Utilise les boutons **Période** pour choisir entre 24h, 7j et 30j
- Ajuste la **Magnitude minimale** pour afficher les séismes plus ou moins forts
- Filtre par **profondeur** ou par **événements spéciaux**
- Recherche un lieu, un pays ou une région
- Active **Limiter à la zone visible de la carte** pour ne garder que ce qui est à l’écran
- Clique sur un point de la carte ou sur un élément de la liste pour ouvrir le panneau de détails
- Utilise **Centrer sur la carte** pour recentrer l’événement sélectionné
- Utilise **Actualiser** pour recharger les données USGS en direct
- Utilise **Réinitialiser** pour revenir aux valeurs par défaut

## Tech

- HTML
- CSS
- JavaScript
- Leaflet
- API séismes USGS
