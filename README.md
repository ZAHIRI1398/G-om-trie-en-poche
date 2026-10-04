# InstrumenPoche Web

Clone web des instruments virtuels de géométrie inspiré de
[instrumenpoche.sesamath.net](https://instrumenpoche.sesamath.net/).
Application 100 % HTML/CSS/JS, sans dépendance ni build.

## Lancer l'application

Ouvrez simplement `index.html` dans un navigateur, ou servez le dossier :

```
python -m http.server 8765
# puis http://localhost:8765
```

## Fonctionnalités

- **Instruments virtuels manipulables** : crayon, compas, règle graduée,
  équerre, rapporteur, règle-équerre coulissante.
- Glisser le corps pour déplacer, poignée bleue pour pivoter.
- **Tracer le long des bords** de la règle, de l'équerre et de la règle-équerre.
- **Compas** : réglage de l'ouverture par la pointe, mode « Tracer un arc »,
  cercle complet en un clic.
- **Rapporteur** : lecture d'angle en direct sous le curseur, tracé de rayon.
- **Points nommés** (A, B, C…), textes, gomme, aimantation du quadrillage.
- **Feuilles** : blanc, carreaux 5 mm, Seyès, papier millimétré, repère.
- **Enregistrement automatique** de toutes les actions dans un script JSON.
- **Lecteur d'animation** : la construction se rejoue comme un film —
  play, pause, pas à pas, vitesse, boucle, curseur de progression.
- **Export / import** de scripts (.json) et **exemples** de constructions
  (triangle équilatéral, médiatrice, angle de 60°, perpendiculaire).

## Structure

```
index.html      interface (barre d'instruments, feuille, lecteur, panneau script)
css/style.css   styles
js/render.js    rendu : quadrillages, objets, instruments
js/examples.js  scripts de constructions d'exemple
js/app.js       interactions, enregistrement, lecteur d'animation
test/smoke.js   test de fumée Node (faux DOM) — `node test/smoke.js`
```

## Format du script

Tableau JSON d'étapes : `paper`, `show`/`hide`/`pose` (instruments),
`segment`, `arc`, `circle`, `point`, `croix`, `text`, `stroke`, `movePoint`.
Le panneau de droite permet d'éditer le script à la main puis de cliquer
« Appliquer le script » pour reconstruire la figure.
