# Déployer l'API de sauvegarde sur Cloudflare

Sauvegarde les bibliothèques de constructions dans le cloud (KV Cloudflare),
accessibles depuis n'importe quel navigateur.

## Prérequis

- Un compte Cloudflare (gratuit) — déjà fait ✅
- Node.js installé — déjà fait ✅

## Étapes (5 min, dans ce dossier `cloudflare/`)

```bash
cd "C:\Users\KOA\Desktop\Géometrie en poche\cloudflare"

# 1. Se connecter à Cloudflare (ouvre le navigateur)
npx wrangler login

# 2. Créer l'espace de stockage KV
npx wrangler kv namespace create BIBLIO
#    -> notez l'« id » affiché (ex. ab12cd34...)

# 3. Coller cet id dans wrangler.toml à la place de REMPLACER_PAR_ID_KV

# 4. Déployer
npx wrangler deploy
#    -> affiche l'URL du worker, ex. https://geometrie-biblio.<compte>.workers.dev
```

## Brancher l'application

Dans `js/app.js`, renseignez l'URL au tout début de la section cloud :

```js
const CLOUD_API = "https://geometrie-biblio.<compte>.workers.dev";
```

Puis `git add -A && git commit -m "..." && git push origin main`.

## Sécurité

- Chaque bibliothèque est identifiée par un **code de classe** choisi dans
  l'application (ex. `6eA-zahiri`). Celui qui connaît le code peut lire et
  écraser la bibliothèque : choisissez un code pas trop évident.
- Le quota gratuit KV (100 000 lectures/jour, 1 000 écritures/jour) est
  largement suffisant pour un usage classe.
