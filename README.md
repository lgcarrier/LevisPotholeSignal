# Signalement de nids-de-poule sur le territoire de Lévis

Application web React qui permet de capturer des positions GPS de nids-de-poule pendant un parcours, puis de transmettre une sélection de points vers un service ArcGIS.

## Avis important

Ce code est fourni uniquement à des fins éducatives et de démonstration.

Cette application n'est pas une interface officielle de la Ville de Lévis et n'est pas destinée à remplacer les interfaces web officielles qui s'appuient sur le service ArcGIS de la Ville.

## Avertissement

L'utilisation de ce logiciel se fait entièrement aux risques de l'utilisateur, que ce soit en tout ou en partie.

Les auteurs, mainteneurs et contributeurs ne peuvent pas être tenus responsables des dommages, pertes, incidents, interruptions de service, erreurs de données ou conséquences légales pouvant résulter de son utilisation, de sa modification ou de sa redistribution.

## Fonctionnalités actuelles

- Configuration utilisateur (nom + courriel) avec persistance dans `localStorage`.
- Initialisation GPS au chargement de l'application avec état:
  - `initializing`
  - `ready`
  - `unavailable` (timeout ou erreur navigateur)
- Mode parcours:
  - démarrer/arrêter le trajet
  - enregistrer des points GPS à la demande
- Résumé des points capturés après arrêt du parcours:
  - sélection/désélection des points à envoyer
  - envoi de la sélection
- Mode débogage:
  - n'appelle pas ArcGIS
  - simule la soumission et vide la liste locale

## Stack technique

- React 19
- Vite 6
- ESLint 9 (configuration flat dans `eslint.config.js`)
- Déploiement Netlify (`netlify.toml`)

## Prérequis

- Node.js (version récente, recommandé: 18+)
- npm
- Navigateur avec permission de géolocalisation activée

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

1. Ouvrir l'application et enregistrer ses informations utilisateur.
2. (Optionnel) Activer le mode débogage.
3. Démarrer un parcours.
4. Appuyer sur "Signaler un nid-de-poule" pour ajouter des points GPS.
5. Arrêter le parcours.
6. Sélectionner les points à transmettre.
7. Envoyer la sélection.

## Intégration ArcGIS

La soumission est effectuée par `src/App.jsx` via:

- Endpoint:
  `https://services1.arcgis.com/niuNnVx0H92jOc5F/arcgis/rest/services/NidDePouleSignale/FeatureServer/0/applyEdits`
- Méthode: `POST`
- Format: `application/x-www-form-urlencoded`
- Attributs envoyés:
  - `Nom`
  - `courriel`
  - `Statut` (`Signale`)

Important: cette intégration est utilisée ici pour un projet éducatif seulement. Pour un usage réel, privilégier les interfaces officielles de la Ville de Lévis.

## Structure du projet

```text
src/
  App.jsx                    # Etat global, logique GPS, soumission ArcGIS
  main.jsx                   # Point d'entrée React
  components/
    Settings.jsx             # Formulaire utilisateur
    TravelControl.jsx        # Démarrage/arrêt du parcours
    PotholeLogger.jsx        # Capture d'un point GPS
    ReportSummary.jsx        # Sélection et envoi des points capturés
  styles.css                 # Styles principaux utilisés
```

## Vérification avant contribution

Le projet n'a pas de suite de tests automatisés pour le moment. Vérification minimale recommandée:

```bash
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
