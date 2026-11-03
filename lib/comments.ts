// Reader comments on recipes. Pure code: the public form, the panel, the API and the tests share it.
export const commentStatuses = [
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Aprobados" },
  { id: "hidden", label: "Ocultos" },
] as const;
export type CommentStatus = (typeof commentStatuses)[number]["id"];
export const isCommentStatus = (value: unknown): value is CommentStatus => commentStatuses.some(s => s.id === value);

export type RecipeComment = { id: string; recipeId: string; name: string; body: string; status: CommentStatus; createdAt: string };
/** What the public form sends. `website` is a honeypot (people never see it) and `startedAt` is when the form was shown. */
export type CommentInput = { name: string; body: string };

export const maxCommentBody = 1000;
export const maxCommentName = 60;
/** A form sent sooner than this after it was shown was filled by a script, not a person. */
export const minFillMs = 3000;
/** Comments one person (by address hash) can send per hour. */
export const maxCommentsPerHour = 3;
export const anonymousName = "Anónimo";

function fail(message: string): never { throw new Error(message); }

/** Links are the mark of spam in a cooking blog: they are refused. */
export const hasLink = (text: string) => /https?:\/\/|www\./i.test(text);

/** Checks what the form sent and returns the clean values. Throws a message for the person. */
export function cleanComment(value: unknown): CommentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Comentario inválido.");
  const data = value as Record<string, unknown>;
  const raw = (field: unknown, label: string) => {
    if (field === undefined || field === null) return "";
    if (typeof field !== "string") fail(`${label} inválido.`);
    // Control characters (except line breaks) are dropped.
    return field.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "");
  };
  const name = raw(data.name, "El nombre").replace(/\s+/g, " ").trim();
  const body = raw(data.body, "El comentario").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (name.length > maxCommentName) fail(`El nombre es demasiado largo (máximo ${maxCommentName} caracteres).`);
  if (body.length < 2) fail("Escribí tu comentario.");
  if (body.length > maxCommentBody) fail(`El comentario es demasiado largo (máximo ${maxCommentBody} caracteres).`);
  if (hasLink(name) || hasLink(body)) fail("Los comentarios no pueden llevar enlaces.");
  return { name, body };
}

/** True when the form was sent too soon after being shown, or without saying when. */
export function sentTooFast(startedAt: unknown, now = Date.now()) {
  return typeof startedAt !== "number" || !Number.isFinite(startedAt) || now - startedAt < minFillMs || startedAt > now + 60_000;
}

export const displayName = (comment: Pick<RecipeComment, "name">) => comment.name || anonymousName;
export const pendingCount = (comments: Pick<RecipeComment, "status">[]) => comments.filter(c => c.status === "pending").length;
