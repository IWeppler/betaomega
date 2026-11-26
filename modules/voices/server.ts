import "server-only";

// Server public entry: the build fails if a client component imports this file.
export { getComments, getMetrics, patchComment, postComment, postMetric, removeComment } from "./api/voices-api";
export { listApprovedComments } from "./data/comments";
export { videoStats } from "./data/video-stats";
