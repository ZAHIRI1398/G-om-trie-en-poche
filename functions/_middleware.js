/* ============================================================
   Middleware Cloudflare Pages — Maths en Poche
   Accès réservé aux enseignants de classesnumeriques.app.

   Entrée : URL signée par le serveur Flask
       https://www.mathsenpoche.site/?exp=<ts>&sig=<hmac>
   avec sig = HMAC-SHA256(MP_SECRET, "mp" + exp).

   Après vérification, un cookie HttpOnly est posé pour la session.
   Les sous-ressources (css, js, images…) chargées par la page sont
   aussi admises via l'en-tête Referer du même site — utile dans les
   navigateurs qui bloquent les cookies tiers en iframe (Safari).

   ⚙️  À configurer : variable d'environnement MP_SECRET dans
       Cloudflare Pages > Settings > Environment variables
       (la même valeur que MATHS_EN_POCHE_SECRET côté Flask).
   ============================================================ */

const COOKIE = "mp_auth";
const ASSET = /\.(css|js|mjs|map|json|txt|png|jpe?g|gif|svg|webp|ico|woff2?|webmanifest|mp3|wav)$/i;

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* vérifie exp (timestamp unix futur) + sig (comparaison en temps constant) */
async function validAuth(secret, exp, sig) {
  if (!/^\d{9,13}$/.test(exp || "") || !/^[0-9a-f]{64}$/.test(sig || "")) return false;
  if (Number(exp) <= Math.floor(Date.now() / 1000)) return false;
  const want = await hmacHex(secret, "mp" + exp);
  let d = 0;
  for (let i = 0; i < 64; i++) d |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

function denied(url) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accès réservé — Maths en Poche</title>
<style>
body{font-family:"Segoe UI",Arial,sans-serif;background:#2f3b4c;color:#e8edf2;
margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#3c4b60;border-radius:14px;padding:36px 44px;max-width:520px;
text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.4)}
h1{font-size:22px;margin:0 0 14px}
p{line-height:1.55;color:#c7d2de;margin:0}
a{color:#ffd76a}
</style></head><body><div class="card">
<h1>🔒 Maths en Poche est réservé aux enseignants</h1>
<p>Cet outil s'ouvre depuis votre compte enseignant sur
<b>classesnumeriques.app</b> (menu « Outils »).</p>
</div></body></html>`;
  return new Response(html, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const secret = env.MP_SECRET;

  // Secret non configuré : on refuse tout (page explicite pour l'admin)
  if (!secret) {
    return new Response(
      "Maths en Poche : MP_SECRET n'est pas configuré dans Cloudflare Pages " +
      "(Settings > Environment variables).", { status: 503 });
  }

  // 1) Porte d'entrée : URL signée ?exp=…&sig=…
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");
  if (exp || sig) {
    if (!(await validAuth(secret, exp, sig))) return denied(url);
    const resp = await next();
    const res = new Response(resp.body, resp);
    const maxAge = Math.max(60, Number(exp) - Math.floor(Date.now() / 1000));
    // SameSite=None + Secure : cookie utilisable dans l'iframe cross-site
    res.headers.append("Set-Cookie",
      `${COOKIE}=${exp}.${sig}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // 2) Session déjà authentifiée par cookie
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)mp_auth=([^;]+)/);
  if (m) {
    const [e, s] = m[1].split(".");
    if (await validAuth(secret, e, s)) return next();
  }

  // 3) Sous-ressources appelées par la page autorisée (Referer même site).
  //    Jamais pour les documents HTML : il faut l'URL signée ou le cookie.
  const ref = request.headers.get("Referer") || "";
  if (ASSET.test(url.pathname) && ref.startsWith(url.origin + "/")) return next();

  // 4) Sinon : refusé
  return denied(url);
}
