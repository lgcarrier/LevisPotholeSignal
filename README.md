# Signalement de nids-de-poule sur le territoire de Lévis

Application web React mobile-first qui permet a un passager de capturer des positions GPS de nids-de-poule pendant un parcours, puis de transmettre une liste de points vers un service ArcGIS.

## Avis important

Ce code est fourni uniquement à des fins éducatives et de démonstration.

Cette application n'est pas une interface officielle de la Ville de Lévis et n'est pas destinée à remplacer les interfaces web officielles qui s'appuient sur le service ArcGIS de la Ville.

## Avertissement

L'utilisation de ce logiciel se fait entièrement aux risques de l'utilisateur, que ce soit en tout ou en partie.

Les auteurs, mainteneurs et contributeurs ne peuvent pas être tenus responsables des dommages, pertes, incidents, interruptions de service, erreurs de données ou conséquences légales pouvant résulter de son utilisation, de sa modification ou de sa redistribution.

## Fonctionnalités actuelles

- Parcours mobile simplifie en 5 ecrans:
  - entree de contexte
  - preparation du parcours
  - parcours actif
  - revision de la liste
  - resultat
- Entree securisee par contexte au demarrage:
  - `Je suis passager`
  - `Je suis a l'arret`
  - `Je conduis` (etat bloque, sans acces au signalement)
- Configuration utilisateur (nom + courriel) avec persistance dans `localStorage`.
- Initialisation GPS au chargement de l'application avec état:
  - `initializing`
  - `ready`
  - `unavailable` (timeout ou erreur navigateur)
- Mode parcours actif:
  - demarrer un trajet depuis l'ecran de preparation
  - suivi de mouvement en continu (`watchPosition`)
  - verrouillage de capture si vitesse estimee `>= 5 km/h` sans confirmation passager
  - action principale `Ajouter un nid-de-poule`
  - action secondaire `Revoir (n)` des qu'au moins un element est capture
- Ecran de revision:
  - liste preselectionnee par defaut
  - details optionnels pour ajuster la selection
  - action finale `Simuler la liste` ou `Soumettre la liste`
- Mode simulation sécurisé (par défaut):
  - n'appelle pas ArcGIS
  - simule la soumission et vide la liste locale
  - permet d'ajouter un nid-de-poule simule via `Outils de simulation`
- Soumission réelle protégée:
  - nécessite `VITE_ALLOW_REAL_SUBMISSION=true`
  - nécessite une confirmation utilisateur avant envoi
- Barre d'actions mobile fixe:
  - une seule action principale contextuelle par ecran
  - libelles orientes flux: `Commencer le parcours`, `Ajouter un nid-de-poule`, `Revoir`, `Simuler la liste`, `Soumettre la liste`

## Stack technique

- React 19
- Vite 6
- ESLint 9 (configuration flat dans `eslint.config.js`)
- Déploiement Netlify (`netlify.toml`)

## Prérequis

- Node.js (version récente, recommandé: 18+)
- npm
- Navigateur avec permission de géolocalisation activée
- Optionnel pour activer l'envoi réel ArcGIS: variable d'environnement `VITE_ALLOW_REAL_SUBMISSION=true`

## Installation et démarrage

```bash
npm install
npm run dev
```

L'application sera disponible sur l'URL locale affichée par Vite (habituellement `http://localhost:5173`).

## Scripts disponibles

- `npm run dev`: démarre le serveur de développement.
- `npm run build`: génère le build de production dans `dist/`.
- `npm run preview`: sert localement le build de production.
- `npm run lint`: exécute ESLint sur le projet.

## Flux utilisateur

1. Ouvrir l'application et choisir le contexte de depart (`passager`, `a l'arret`, `conducteur`).
2. Valider ou modifier le profil utilisateur.
3. Verifier le mode simulation (active par defaut).
4. Commencer le parcours.
5. Pendant le trajet, ajouter des nids-de-poule un par un.
6. Si mouvement detecte (`>= 5 km/h`), confirmer qu'un passager utilise l'application.
7. Appuyer sur `Revoir` pour ouvrir la liste capturee.
8. Ajuster la selection si necessaire.
9. Simuler la liste (par defaut) ou soumettre la liste si la soumission reelle est activee.

## Intégration ArcGIS

La soumission est effectuée par `src/App.jsx` via:

- Endpoint:
  `https://services1.arcgis.com/niuNnVx0H92jOc5F/arcgis/rest/services/NidDePouleSignale/FeatureServer/0/applyEdits`
- Méthode: `POST`
- Format: `application/x-www-form-urlencoded`
- Géométrie:
  - les positions GPS restent en latitude/longitude dans l'interface
  - la soumission projette chaque point en Web Mercator (`wkid: 102100`) au moment de l'envoi
- Profil:
  - l'application collecte `Prenom`, `Nom de famille` et `Courriel`
  - l'attribut ArcGIS `Nom` est envoye au format `Nom de famille + Prenom`
- Attributs envoyés:
  - `Nom`
  - `courriel`
  - `Statut` (`Signale`)

Par défaut, l'application reste en mode simulation et ne soumet aucun signalement réel.
L'envoi réel n'est possible que si `VITE_ALLOW_REAL_SUBMISSION=true`.

Important: cette intégration est utilisée ici pour un projet éducatif seulement. Pour un usage réel, privilégier les interfaces officielles de la Ville de Lévis.

## Structure du projet

```text
src/
  App.jsx                    # Etat global, flow mobile 5 ecrans, parcours, suivi mouvement, soumission ArcGIS
  main.jsx                   # Point d'entrée React
  utils/
    movement.js              # Calculs vitesse/état de mouvement + anti-jitter
  components/
    PassengerConfirmationModal.jsx # Confirmation passager en mouvement
    ...                      # Composants secondaires et iterations precedentes conserves dans le repo
  styles.css                 # Styles principaux utilisés
  index.css                  # Base CSS neutre (sans preset Vite)
```

## Vérification avant contribution

Le projet inclut un test Node léger pour la projection ArcGIS. Vérification recommandée:

```bash
npm test
npm run lint
npm run build
```

Puis validation manuelle en navigateur pour les scénarios GPS et soumission.

## Déploiement

Netlify est configuré avec:

- Build command: `npm run build`
- Publish directory: `dist`

## Limites connues

- Aucun test automatisé n'est configuré dans `package.json`.
- Endpoint ArcGIS codé en dur dans `src/App.jsx`.
- Aucune file d'attente hors-ligne pour les signalements.

## Licence

Ce projet est distribué sous licence MIT. Voir `LICENSE`.
