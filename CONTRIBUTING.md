# Contribuer a LevisPotholeSignal

Merci de contribuer au projet. Ce depot contient une application React/Vite mobile-first pour capturer des nids-de-poule et preparer une soumission ArcGIS. Le projet est educatif: gardez les changements cibles, lisibles et prudents autour du GPS et des integrations externes.

## Installation locale

Prerequis:

- Node.js recent
- npm
- Un navigateur avec acces a la geolocalisation

Configuration recommandee:

```bash
npm install
cp .env.example .env
npm run dev
```

Par defaut, `.env.example` garde `VITE_ALLOW_REAL_SUBMISSION=false`. Conservez ce mode simulation pour le developpement habituel et pour la plupart des validations locales.

## Scripts utiles

- `npm run dev`: demarre l'application en local avec Vite.
- `npm test`: execute les tests Node du depot.
- `npm run lint`: execute ESLint.
- `npm run build`: produit le build Vite dans `dist/`.
- `npm run preview`: sert localement le build de production.

Verification attendue avant fusion:

```bash
npm test
npm run lint
npm run build
```

## Organisation du code

- `src/App.jsx`: etat partage, flux principal mobile, geolocalisation, soumission ArcGIS.
- `src/components/`: composants et comportements UI isoles.
- `src/utils/arcgis.js`: projection et composition du payload ArcGIS.
- `src/utils/movement.js`: calculs de vitesse et verrouillage lie au mouvement.

Regle pratique: si un changement reste local a un composant, preferez `src/components/`. Touchez `src/App.jsx` seulement quand le flux multi-ecrans, l'etat partage ou la logique de soumission doit vraiment changer.

## Attentes de contribution

- Gardez les changements limites a la demande traitee.
- Preservez la copie visible par les utilisateurs en francais, sauf demande explicite contraire.
- Evitez les envois ArcGIS reels inutiles. Le mode simulation doit rester le chemin par defaut.
- Mettez a jour la documentation et les tests si un comportement observable change.
- Mentionnez clairement tout risque, limite restante ou suivi propose dans la pull request.

## Validation manuelle

Ajoutez une verification manuelle quand vous touchez au flux UI, au GPS, au mouvement ou a la soumission. Selon le changement, couvrez si possible:

1. Chargement de l'application avec permission de geolocalisation accordee ou refusee.
2. Choix du contexte (`passager`, `a l'arret`, `conducteur`) et passage vers l'ecran de preparation.
3. Demarrage du parcours et capture d'un point en mode simulation.
4. Verrouillage de capture en mouvement et confirmation passager.
5. Revision de la liste, puis simulation de la soumission finale.

Si vous devez tester une soumission reelle, faites-le seulement quand c'est necessaire pour la fonctionnalite et documentez-le clairement dans la PR. Revenez ensuite au mode simulation dans votre environnement local.

## Pull requests et issues

- Utilisez le modele de pull request du depot et remplissez les sections de verification.
- Ouvrez un rapport de bogue avec le navigateur, l'appareil, l'etat de geolocalisation et le mode de soumission utilises.
- Pour une nouvelle fonctionnalite, decrivez le probleme, la proposition et l'impact sur le flux mobile.

Les workflows GitHub Actions executent `npm test`, `npm run lint` et `npm run build` sur chaque PR et sur chaque push vers `main`.
