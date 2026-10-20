import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Map the project's custom secret names onto the names the code reads.
function applySecretAliases(env: unknown) {
  if (typeof process === "undefined") return;
  const source = (env && typeof env === "object" ? env : {}) as Record<string, unknown>;
  const read = (k: string) =>
    (typeof source[k] === "string" ? (source[k] as string) : undefined) ?? process.env[k];
  const aliases: Record<string, string> = {
    SUPABASE_URL: "CUPAI_APP_SB_URL",
    SUPABASE_PUBLISHABLE_KEY: "CUPAI_APP_SB_ANON",
    SUPABASE_SERVICE_ROLE_KEY: "CUPAI_APP_SB_SERVICE",
  };
  for (const [target, alias] of Object.entries(aliases)) {
    const value = read(alias);
    if (value) process.env[target] = value;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      applySecretAliases(env);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
