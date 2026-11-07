import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { siteTable } from "@/platform/db";
import { needsRefresh, tokensFrom, type AccountTokens } from "../domain/mercadopago";
import { MercadoPagoError, mercadoPagoApp, refreshTokens } from "./mercadopago";

// The Mercado Pago account a site charges into (docs/SAUNA.md §6). Its tokens are encrypted here, with a key derived from ANKORA_SESSION_SECRET: the
// table alone is not enough to charge. Changing that secret closes the panel's sessions and also disconnects the accounts, which are then connected again.

const missing = "Falta la tabla de cuentas de Mercado Pago: corré supabase/schema.sql.";

type AccountRow = {
  user_id: string; nickname: string; access_token: string; refresh_token: string; expires_at: string; live_mode: boolean; connected_at: string;
};

const accounts = (siteId: string) => siteTable<AccountRow>("sauna_mercadopago_accounts", siteId, missing);

function key(): Buffer {
  const secret = process.env.ANKORA_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ANKORA_SESSION_SECRET falta o es corto: no se pueden cifrar las credenciales de Mercado Pago.");
  return Buffer.from(hkdfSync("sha256", secret, "sauna", "mercadopago-tokens", 32));
}

/** `v1.<iv>.<tag>.<ciphertext>`, base64url. GCM also proves the text was not altered. */
function seal(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map(part => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/** Null when it cannot be opened: the secret changed, so the account has to be connected again. */
function open(sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch { return null; }
}

/** What the panel shows. Never the tokens. */
export type ConnectedAccount = { userId: string; nickname: string; connectedAt: string; liveMode: boolean };

/** A failure to read (the table missing before schema.sql runs, a database hiccup) reads as no account: pages degrade to not offering Mercado Pago (pattern 3). */
export async function readAccount(siteId: string): Promise<ConnectedAccount | null> {
  try {
    const [row] = await accounts(siteId)("select=user_id,nickname,connected_at,live_mode");
    return row ? { userId: row.user_id, nickname: row.nickname, connectedAt: row.connected_at, liveMode: row.live_mode } : null;
  } catch (error) {
    console.error("[sauna mercadopago] account not readable:", error instanceof Error ? error.name : "error");
    return null;
  }
}

/** Connecting another account replaces the one there was: a site charges into one account. */
export async function saveAccount(siteId: string, tokens: AccountTokens, nickname: string, connecting: boolean): Promise<void> {
  const fields = {
    user_id: tokens.userId, nickname, access_token: seal(tokens.accessToken), refresh_token: seal(tokens.refreshToken), expires_at: tokens.expiresAt,
    live_mode: tokens.liveMode, updated_at: new Date().toISOString(), ...(connecting ? { connected_at: new Date().toISOString() } : {}),
  };
  const [updated] = await accounts(siteId)("", { method: "PATCH", body: JSON.stringify(fields) });
  if (!updated) await accounts(siteId)("", { method: "POST", body: JSON.stringify(fields) });
}

export async function removeAccount(siteId: string): Promise<void> {
  await accounts(siteId)("", { method: "DELETE" });
}

/**
 * The token to charge with, renewed when it is a week from lapsing. Null when the site has no account, or when it can no longer be used: then the site
 * stops offering Mercado Pago until someone connects it again, instead of sending people to a checkout that fails.
 */
export async function accessTokenFor(siteId: string): Promise<string | null> {
  const app = mercadoPagoApp();
  if (!app) return null;
  const [row] = await accounts(siteId)("select=*");
  if (!row) return null;
  const accessToken = open(row.access_token);
  const refreshToken = open(row.refresh_token);
  if (!accessToken || !refreshToken) return null;
  const now = new Date().toISOString();
  if (!needsRefresh(row.expires_at, now)) return accessToken;
  try {
    const tokens = tokensFrom(await refreshTokens(app, refreshToken), now);
    if (!tokens) throw new MercadoPagoError("refresh without tokens");
    await saveAccount(siteId, tokens, row.nickname, false);
    return tokens.accessToken;
  } catch (error) {
    console.error("[sauna mercadopago] refresh failed:", error instanceof Error ? error.message : "error");
    // Another request may have renewed it a moment ago: what is saved now is the answer. If not, the old token still works until its date.
    const [again] = await accounts(siteId)("select=access_token,expires_at");
    const current = again ? open(again.access_token) : null;
    return current && Date.parse(again.expires_at) > Date.now() ? current : null;
  }
}
