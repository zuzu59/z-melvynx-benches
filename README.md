# z-melvynx-benches

Collection de benches pour tester des IA/agets sur des mini-projets web.

## Bench actuel

### Earthquake Explorer
Application statique qui affiche les séismes récents du flux USGS sur une carte interactive.

#### Fonctionnalités
- Carte interactive avec fond de carte visible
- Séismes affichés individuellement à leurs vraies coordonnées
- Filtres par période, magnitude, profondeur, type d’événement et recherche texte
- Détails interactifs au clic sur un point ou un item de la liste
- Code couleur par magnitude et profondeur
- Données live USGS avec rafraîchissement automatique

---

## Lancer le projet

### Prérequis
- Python 3
- Un navigateur web

### Démarrage rapide

Depuis la racine du dépôt :

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Puis ouvrir :

```text
http://localhost:8000
```

Ou depuis une autre machine du réseau :

```text
http://<adresse-ip-de-la-machine>:8000
```

### Port utilisé
- `8000`

### Bind réseau
- `0.0.0.0` pour exposer le serveur sur toutes les interfaces

---

## Fichiers importants

- `index.html` : point d’entrée principal du bench
- `src/earthquake-app.css` : styles de l’application
- `src/earthquake-app.js` : logique de l’application
- `dist/` : anciens artefacts/build locaux générés, non utilisés comme source de vérité

> Note : il peut exister un `dist/index.html` en local, mais la version à modifier et à pousser est bien le `index.html` à la racine.

---

## Notes

- L’application consomme les API publiques USGS Earthquake, sans clé API.
- Une connexion internet est nécessaire pour charger les tuiles cartographiques et les données live.
