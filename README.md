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
- **Explications par étape** : case « Expliquer chaque action » (commentaire
  demandé après chaque étape) ou bouton « Commenter » (dernière étape) —
  chaque étape peut porter un champ `msg` affiché en bas pendant la lecture.
- **Lecteur d'animation** : la construction se rejoue comme un film —
  play, pause, pas à pas, vitesse, boucle, curseur de progression.
- **Export / import** de scripts (.json) et **exemples** de constructions
  (triangle équilatéral, médiatrice, angle de 60°, perpendiculaire).

## Accès réservé aux enseignants (Worker Cloudflare)

Le site est servi par le **Worker** `g-om-trie-en-poche` (Workers Builds,
lié au dépôt Git — pas Cloudflare Pages). `site-worker.js` est le point
d'entrée déclaré dans `wrangler.jsonc` : il bloque l'accès direct et ne
sert les fichiers (`env.ASSETS`) qu'avec une **URL signée**
`?exp=…&sig=…` générée par classesnumeriques.app, ou le cookie `mp_auth`
qu'elle installe (valable 2 h). Un élève qui tape l'adresse obtient une
page « réservé aux enseignants ».

Mise en place (une fois) :

1. Choisir un secret long et aléatoire, ex. `python -c "import secrets; print(secrets.token_hex(32))"`
2. **Cloudflare Workers** → `g-om-trie-en-poche` → *Settings → Variables and Secrets* →
   ajouter `MP_SECRET` = ce secret (Production).
3. **Railway** (classesnumeriques.app) → variable `MATHS_EN_POCHE_SECRET` = le même secret.
4. Pousser ce dépôt pour déployer le worker.

Si `MP_SECRET` n'est pas défini, le site répond 503 — vérifiez la variable.

## Structure

```
index.html      interface (barre d'instruments, feuille, lecteur, panneau script)
css/style.css   styles
js/render.js    rendu : quadrillages, objets, instruments
js/examples.js  scripts de constructions d'exemple
js/app.js       interactions, enregistrement, lecteur d'animation
site-worker.js  worker du site : accès par URL signée (enseignants)
wrangler.jsonc  config du worker (assets statiques + script)
cloudflare/     worker KV pour la bibliothèque cloud
test/smoke.js   test de fumée Node (faux DOM) — `node test/smoke.js`
```

## Format du script

Tableau JSON d'étapes : `paper`, `show`/`hide`/`pose` (instruments),
`segment`, `arc`, `circle`, `point`, `croix`, `text`, `stroke`, `movePoint`.
Le panneau de droite permet d'éditer le script à la main puis de cliquer
« Appliquer le script » pour reconstruire la figure.
