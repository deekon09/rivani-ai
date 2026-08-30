// RIVANI AI Model Delivery Proxy
// Purpose: remove browser CORS/Xet redirect problems when loading the public
// MossFormer2 ONNX model. This Worker does NO AI inference and uses NO GPU.

const MODEL_ORIGIN =
  "https://huggingface.co/TigreGotico/audiosronnx-mossformer2/resolve/main/mossformer2_48k.onnx?download=true";

const EXPECTED_MIN_BYTES = 200 * 1024 * 1024;
const SITE_ORIGIN = "https://rivani-ai.rivani.workers.dev";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const cors = {
      "Access-Control-Allow-Origin": SITE_ORIGIN,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges, ETag, X-RIVANI-Model",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {status:204, headers:cors});
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        ok:true,
        service:"rivani-models",
        model:"MossFormer2_SE_48K",
        inference:"browser",
        gpu:false
      }), {
        headers:{
          ...cors,
          "content-type":"application/json; charset=UTF-8",
          "cache-control":"no-store"
        }
      });
    }

    if (url.pathname !== "/mossformer2_48k.onnx") {
      return new Response("Not found", {status:404, headers:cors});
    }

    if (!["GET","HEAD"].includes(request.method)) {
      return new Response("Method not allowed", {status:405, headers:cors});
    }

    // Use a stable cache key. The ONNX is immutable enough for this pinned
    // RIVANI release; purge/change the worker if the model revision changes.
    const cache = caches.default;
    const cacheKey = new Request(
      "https://rivani-model-cache.invalid/mossformer2_48k.onnx",
      {method:"GET"}
    );

    if (request.method === "GET") {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const headers = new Headers(hit.headers);
        for (const [k,v] of Object.entries(cors)) headers.set(k,v);
        headers.set("X-RIVANI-Model","MossFormer2-48K-CACHE");
        return new Response(hit.body, {status:hit.status, headers});
      }
    }

    let upstream;
    try {
      upstream = await fetch(MODEL_ORIGIN, {
        method:request.method,
        redirect:"follow",
        headers:{
          "User-Agent":"RIVANI-AI-Model-Proxy/1.0",
          "Accept":"application/octet-stream,*/*"
        },
        cf:{
          cacheEverything:true,
          cacheTtl:2592000
        }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error:"UPSTREAM_FETCH_FAILED",
          message:String(error?.message || error)
        }),
        {
          status:502,
          headers:{...cors,"content-type":"application/json; charset=UTF-8"}
        }
      );
    }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({
          error:"MODEL_ORIGIN_ERROR",
          status:upstream.status
        }),
        {
          status:502,
          headers:{...cors,"content-type":"application/json; charset=UTF-8"}
        }
      );
    }

    const headers = new Headers(upstream.headers);
    for (const [k,v] of Object.entries(cors)) headers.set(k,v);

    headers.set("content-type","application/octet-stream");
    headers.set("cache-control","public, max-age=86400, s-maxage=2592000, immutable");
    headers.set("X-RIVANI-Model","MossFormer2-48K-ORIGIN");
    headers.delete("content-disposition");

    const response = new Response(upstream.body, {
      status:upstream.status,
      headers
    });

    // Cache only complete GET responses. Never buffer 229 MB in Worker memory;
    // clone() preserves streaming semantics.
    if (request.method === "GET" && upstream.status === 200) {
      ctx.waitUntil(
        cache.put(cacheKey, response.clone()).catch(err =>
          console.warn("Model edge cache put failed:", err)
        )
      );
    }

    return response;
  }
};
