import { createHash, randomBytes } from "node:crypto";
import { equal, isAdmin } from "@/platform/auth/server";
import { getPanelSite } from "@/platform/sites/server";
import { readAccount, removeAccount, saveAccount, type ConnectedAccount } from "../data/mercadopago-account";
import { accountName, exchangeCode, MercadoPagoError, mercadoPagoApp } from "../data/mercadopago";
import { authorizationUrl, readOauthCookie, tokensFrom } from "../domain/mercadopago";
import { fail, failure, panelWrite, type SiteContext } from "./route-tools";

// Connecting the Mercado Pago account a site charges into, from the panel (OAuth with PKCE, docs/SAUNA.md §6).
//
// The panel's session cookie is SameSite=Strict, so it does not come along when Mercado Pago sends the browser back. The answer is tied to the start
// instead: only an administrator can start, and the start leaves a short Lax cookie with a random `state` and the PKCE verifier. The return is accepted
// only with that same state, so nobody can link another account by sending someone a crafted link: that account is where the money would go.

const COOKIE = "sauna_mp_oauth";
const COOKIE_SECONDS = 600; // Mercado Pago's code lasts 10 minutes

/** The panel's own address, as the browser reached it. The return address has to be exactly one of those registered in the application. */
function panelOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

const callbackPath = (siteId: string) => `/api/sites/${siteId}/sauna/mercadopago/oauth`;

function cookie(siteId: string, value: string, maxAge: number, secure: boolean) {
  return `${COOKIE}=${value}; Path=/api/sites/${siteId}/sauna/mercadopago; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

/** Back to the configuration, on the tab of payments, saying how it went. */
function backToPanel(origin: string, siteId: string, result: "conectado" | "cancelado" | "error", secure: boolean) {
  return new Response(null, {
    status: 303,
    headers: { Location: `${origin}/${siteId}/ajustes?mercadopago=${result}#cobros`, "Set-Cookie": cookie(siteId, "", 0, secure), "Cache-Control": "no-store" },
  });
}

/** GET: starts connecting (or replacing) the account. A link, not a form: the browser has to leave for Mercado Pago anyway. */
export async function startMercadoPagoConnect(request: Request, context: SiteContext) {
  if (!await isAdmin()) return fail(401, "Ingresá como administrador.");
  const site = await getPanelSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  const origin = panelOrigin(request);
  const secure = origin.startsWith("https://");
  const app = mercadoPagoApp();
  if (!app) return backToPanel(origin, site.id, "error", secure);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const location = authorizationUrl({ clientId: app.clientId, redirectUri: `${origin}${callbackPath(site.id)}`, state, challenge });
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Set-Cookie": cookie(site.id, `${state}.${verifier}`, COOKIE_SECONDS, secure), "Cache-Control": "no-store" },
  });
}

const cookieOf = (request: Request) =>
  request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);

/** GET: where Mercado Pago sends the browser back, with `code` and `state`, or `error` when the person did not authorize. */
export async function finishMercadoPagoConnect(request: Request, context: SiteContext) {
  const site = await getPanelSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  const origin = panelOrigin(request);
  const secure = origin.startsWith("https://");
  const params = new URL(request.url).searchParams;
  const started = readOauthCookie(cookieOf(request));
  const state = params.get("state") ?? "";
  if (!started || !equal(started.state, state)) {
    console.error("[sauna mercadopago] oauth return without a matching start");
    return backToPanel(origin, site.id, "error", secure);
  }
  const code = params.get("code");
  if (!code || params.get("error")) return backToPanel(origin, site.id, "cancelado", secure);
  const app = mercadoPagoApp();
  if (!app || !/^[A-Za-z0-9_-]{1,300}$/.test(code)) return backToPanel(origin, site.id, "error", secure);
  try {
    const tokens = tokensFrom(await exchangeCode(app, code, `${origin}${callbackPath(site.id)}`, started.verifier), new Date().toISOString());
    if (!tokens) throw new MercadoPagoError("token answer incomplete");
    const nickname = await accountName(tokens.accessToken).catch(() => "");
    await saveAccount(site.id, tokens, nickname, true);
    return backToPanel(origin, site.id, "conectado", secure);
  } catch (error) {
    console.error("[sauna mercadopago] oauth failed:", error instanceof Error ? error.message.slice(0, 200) : "error");
    return backToPanel(origin, site.id, "error", secure);
  }
}

/** DELETE: the site stops charging with Mercado Pago. Payments already made stay in that account and in the ledger. */
export const disconnectMercadoPago = panelWrite(async (_request, site) => {
  try {
    await removeAccount(site.id);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error, "desconectar Mercado Pago"); }
});

export type MercadoPagoStatus = { configured: boolean; account: ConnectedAccount | null };

/** What the configuration shows: whether the application is set up on the server, and which account is connected. */
export async function mercadoPagoStatus(siteId: string): Promise<MercadoPagoStatus> {
  return { configured: mercadoPagoApp() !== null, account: await readAccount(siteId) };
}
