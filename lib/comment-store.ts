import { createHmac } from "node:crypto";
import { isCommentStatus, type CommentStatus, type RecipeComment } from "./comments";
import { siteTable } from "./site-table";

// Server-only reads and writes of the recipe_comments table (supabase/schema.sql). Every query is scoped to one site by siteTable.
type Row = { id: string; recipe_id: string; site_id: string; name: string; body: string; status: string; created_at: string };
const fromRow = (row: Row): RecipeComment => ({
  id: row.id, recipeId: row.recipe_id, name: row.name, body: row.body,
  status: isCommentStatus(row.status) ? row.status : "hidden", createdAt: row.created_at,
});

const comments = (siteId: string) => siteTable<Row>("recipe_comments", siteId, "Falta la tabla recipe_comments en Supabase. Corré supabase/schema.sql en el SQL Editor.");
const eq = (value: string | number) => `eq.${encodeURIComponent(String(value))}`;

/** What a recipe page shows: approved comments, the oldest first so a conversation reads in order. */
export async function listApprovedComments(siteId: string, recipeId: string) {
  return (await comments(siteId)(`recipe_id=${eq(recipeId)}&status=eq.approved&select=*&order=created_at.asc&limit=200`)).map(fromRow);
}

/** The panel's list: every comment of a site, the most recent first. */
export async function listComments(siteId: string) {
  return (await comments(siteId)("select=*&order=created_at.desc&limit=500")).map(fromRow);
}

export async function setCommentStatus(siteId: string, id: string, status: CommentStatus) {
  const [updated] = await comments(siteId)(`id=${eq(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
  return updated ? fromRow(updated) : undefined;
}

export async function deleteComment(siteId: string, id: string) {
  await comments(siteId)(`id=${eq(id)}`, { method: "DELETE" });
}

/** A keyed hash of the visitor's address: enough to count comments per person, useless to find the person. */
export const hashAddress = (address: string) =>
  createHmac("sha256", process.env.ANKORA_SESSION_SECRET || "").update(`comment-ip:${address}`).digest("hex").slice(0, 32);

/** The bodies this address sent in the last hour (any status), to limit and to ignore a double click. */
export async function recentBodies(siteId: string, ipHash: string) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const found = await comments(siteId)(`ip_hash=${eq(ipHash)}&created_at=gte.${encodeURIComponent(since)}&select=body&limit=20`);
  return found.map(row => row.body);
}

export async function addComment(siteId: string, recipeId: string, comment: { name: string; body: string }, ipHash: string) {
  const [created] = await comments(siteId)("", { method: "POST", body: JSON.stringify({ recipe_id: recipeId, name: comment.name, body: comment.body, ip_hash: ipHash, status: "pending" }) });
  return fromRow(created);
}

/** Comments waiting for approval, for the panel's notices. Capped: past 99 the number only needs to say "many". */
export async function countPendingComments(siteId: string) {
  return (await comments(siteId)("status=eq.pending&select=id&limit=100")).length;
}
