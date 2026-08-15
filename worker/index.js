/* ============================================================
   worker/index.js — the Worker that fronts the static site
   ============================================================
   The project used to deploy as a static-assets-ONLY Worker: a `dist`
   directory and nothing else. That shape has no server side at all, which
   is why functions/api/validate-license.js never ran. The functions/
   directory is a Cloudflare PAGES convention; a Worker with assets does
   not look at it, so the endpoint was simply absent and the Lemon Squeezy
   secrets had nowhere to live.

   Adding `main` to wrangler.jsonc is what turns the deployment into a
   Worker with assets AND code. This file is that entry point.

   HOW A REQUEST IS ROUTED, and why this file is so short:

     1. Cloudflare tries the static assets first and serves a match
        directly, without ever invoking this Worker. That is the whole
        site: every .html, the CSS, the images, the .dmg files. It also
        means _headers and _redirects keep working exactly as they did,
        because the asset server still handles those requests.

     2. /api/* is listed in run_worker_first, so those paths come here
        BEFORE the asset lookup. Nothing is served from dist/api today, so
        strictly this is belt and braces. It is worth having: without it, a
        file that ever landed at dist/api/validate-license would silently
        shadow the endpoint the Mac app depends on.

     3. Anything else that reaches this Worker did so because no asset
        matched. It is handed back to the asset server, which produces the
        404 rather than this file inventing one.

   The only thing that runs server-side is the licence endpoint. Keeping
   the Worker this thin is deliberate: the site is static, and every
   request that does not need code should never pay for it.
   ============================================================ */

import { validateLicense } from "./validate-license.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/validate-license") {
      return validateLicense(request, env);
    }

    /* Not an endpoint. Hand it back to the asset server rather than
       returning a bare 404 here, so the reply still goes through the
       configured not_found_handling and the _headers rules. */
    return env.ASSETS.fetch(request);
  }
};
