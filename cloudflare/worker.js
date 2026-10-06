/* Worker Cloudflare — API de sauvegarde de la bibliothèque
   Géométrie en Poche
   Route : /api/biblio?code=<code-de-classe>
     GET  -> { items: [...] }
     POST -> body { items: [...] }  (remplace la bibliothèque du code)
*/
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== "/api/biblio")
      return new Response("Géométrie en poche — API bibliothèque\n", { headers: cors });

    const code = (url.searchParams.get("code") || "").trim();
    if (!/^[a-z0-9][a-z0-9-_]{2,63}$/i.test(code))
      return Response.json(
        { error: "code invalide (3-64 caractères : lettres, chiffres, -, _)" },
        { status: 400, headers: cors });

    if (request.method === "GET") {
      const json = await env.BIBLIO.get(code);
      return Response.json({ items: json ? JSON.parse(json) : [] }, { headers: cors });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !Array.isArray(body.items) || body.items.length > 500)
        return Response.json({ error: "données invalides" }, { status: 400, headers: cors });
      const json = JSON.stringify(body.items);
      if (json.length > 20_000_000)          // ~20 Mo max par bibliothèque
        return Response.json({ error: "bibliothèque trop volumineuse" },
                             { status: 413, headers: cors });
      await env.BIBLIO.put(code, json);
      return Response.json({ ok: true, count: body.items.length }, { headers: cors });
    }

    return new Response("méthode non supportée", { status: 405, headers: cors });
  },
};
