## Resume

- Decrivez brievement le changement et le comportement attendu.

## Issue liee

- Reference: `Closes #...` ou `Refs #...`

## Verification

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Validation manuelle ajoutee si le flux UI, le GPS ou la soumission ArcGIS a change

## Validation manuelle

- Navigateur / appareil:
- Permission de geolocalisation:
- Mode utilise: `simulation` / `reel`
- Etapes testees:
- Captures d'ecran ou notes visuelles:

## Checklist repo-specifique

- [ ] La copie visible par les utilisateurs reste en francais, sauf demande contraire explicite
- [ ] Le changement reste local a `src/components/` si le comportement est isole; `src/App.jsx` n'est touche que pour le flux ou l'etat partage
- [ ] Le developpement habituel reste en mode simulation (`VITE_ALLOW_REAL_SUBMISSION=false`)
- [ ] Aucun envoi ArcGIS reel inutile n'a ete effectue
- [ ] Les risques, limites ou suivis restants sont notes ci-dessous

## Risques ou suivis

- Aucun / a preciser
