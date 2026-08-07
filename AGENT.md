# Car Brick Wall Crash - State Memory

## 🎯 OBJECTIF
Créer un fichier `Car_Brick_Wall_Crash/index.html` avec simulation physique 2D : voiture percute mur de briques.

## 📁 FICHIERS
- `Car_Brick_Wall_Crash/index.html` - Fichier principal (à corriger)
- `test-car-crash.spec.js` - Test Playwright pour validation
- `Résultats/` - Screenshots avec timestamps yyMMdd.HHmm

## ✅ BUGS CORRIGÉS

### 1. Inversion axe Y (CRITIQUE - CORRIGÉ)
**Problème** : Gravité appliquée positivement (`vel.y += 9.81`) mais axe Y inversé (y=0 en bas, y positif vers le haut). La voiture montait vers le ciel.

**Correction** :
```javascript
// Ligne ~340
b.vel.y -= DEFAULTS.gravity * dt;  // Négatif = vers le bas
```

**Vérification** : Screenshots montrent la voiture au sol (correct)

### 2. Friction au sol trop forte (CORRIGÉ)
**Problème** : Friction multipliée par 3 (`* 3`), arrêt instantané de la voiture.

**Correction** :
```javascript
// Ligne ~356
const frictionForce = b.friction * DEFAULTS.gravity * 0.2;  // Réduit
```

**Vérification** : À faire

### 3. Caméra (CORRIGÉ PARTIELLEMENT)
**Problème** : Caméra perd la voiture ou dézoome trop.

**Correction actuelle** :
```javascript
// Ligne ~619
// Centre sur la voiture, scroll vers le mur quand la voiture s'approche
if (carScreenX > wallX - this.w * 0.5) {
  camX = -(wallX - this.w * 0.5);
}
```

**Vérification** : À faire

## ❌ BUGS RESTANTS (CRITIQUES)

### 4. VOITURE NE SE DÉPLACE PAS (CRITIQUE - NON CORRIGÉ)
**Problème** : Speed: 0.0 m/s à 3s, 6s, 10s... La voiture reste à x=1.5m.

**Hypothèses** :
- `applyThrust()` est appelée (ligne 948)
- Mais la vélocité est peut-être écrasée par la friction avant la première frame
- Ou le game loop ne tourne pas correctement
- Ou `car.vel.x` est réinitialisé quelque part

**À VÉRIFIER** :
1. Line 948 : `car.applyThrust(p.carSpeed || DEFAULTS.carSpeed);`
2. Line 288-291 : `applyThrust` définit bien `this.vel.x = speed;`
3. Le game loop tourne-il ? (ligne 905+)
4. Y a-t-il un autre endroit où `vel.x` est remis à 0 ?

**Debug** : Ajouter `console.log` dans `applyThrust` et `gameLoop` pour tracer

## 📊 RÉSULTATS TESTS PLAYWRIGHT

### Format timestamps
```javascript
function getTimestamp() {
  const now = new Date();
  return `${yy}${mm}${dd}.${HH}${MM}${SS}`;
}
```

### Screenshots pris
- `*_initial.png` - État initial
- `*_01_approach.png` - 1s après début
- `*_02_approach2.png` - 2s
- `*_03_impact.png` - 3s (impact attendu)
- `*_04_debris.png` - 4s
- `*_05_settling.png` - 5s
- `*_06_final.png` - 6s

### Derniers résultats
- **Vitesse** : 0.0 m/s (devrait être ~22 m/s avant impact)
- **Temps** : 6.27s
- **Briques en mouvement** : 0/192
- **Mur** : Intact (pas d'impact)

## 🔧 PROCÉDURE DE TEST

```bash
cd /home/ubuntu/dev/z-melvynx-benches
rm Résultats/*.png
npx playwright test test-car-crash.spec.js --reporter=list --timeout=60000 --browser=chromium
ls Résultats/ | tail -8
```

## 📝 COMMITS PRÉCÉDENTS

```
feat: add Car Brick Wall Crash benchmark challenge
feat: implement Car Brick Wall Crash physics simulation
fix: yolo mode - fix physics energy gain, impact violence, camera tracking
fix: reduce restitution to 0.1, increase friction x3, fix brick stabilization
```

## 🎯 PROCHAINES ÉTAPES

1. **URGENT** : Faire bouger la voiture (bug #4)
   - Ajouter console.log pour debugger
   - Vérifier que `applyThrust` est appelée
   - Vérifier que le game loop tourne
   - Vérifier qu'aucun code ne réinitialise `vel.x`

2. **Ensuite** : Vérifier que l'impact se produit
   - La voiture doit atteindre x=12m (position du mur)
   - Les collisions doivent déclencher `unlockWall()`
   - Les briques doivent tomber

3. **Puis** : Affiner la physique
   - Réduire l'énergie gagnée (restitution déjà à 0.1)
   - Ajuster la friction brique-brique
   - Améliorer la caméra

## 💡 NOTES TECHNIQUES

- **Physics** : Impulse-based, 3 sub-steps/frame, 60Hz
- **Scale** : 80px = 1m
- **Wall position** : x=12m
- **Car start** : x=1.5m, y=0.725m (carH/2)
- **Brick size** : 0.50m × 0.24m
- **Wall size** : 12 cols × 8 rows × 2 layers = 192 briques

## ⚠️ ATTENTION

- Ne pas modifier la friction au sol au-dessus de 0.5x
- La restitution est déjà à 0.1 (très basse)
- Le mur est verrouillé jusqu'au premier impact (distance < 3m)
- Les couleurs de briques utilisent Math.random() (non-déterministe visuellement, OK)

---

**Dernière mise à jour** : 2026-08-07 18:02
**Statut** : En cours de debugging - voiture ne se déplace pas
