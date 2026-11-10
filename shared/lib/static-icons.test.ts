import assert from "node:assert/strict";
import { test } from "node:test";
import { appIcon, askedIconSize, redirectToStatic, staticIcon } from "./static-icons.ts";

const pair = { any: "/fropexio-icon.png", maskable: "/fropexio-icon-maskable.png" };

test("staticIcon names the file and refuses sources or sizes that are not pre-rendered", () => {
  assert.equal(staticIcon("/fropexio-icon-maskable.png", 512), "/icons/fropexio-icon-maskable-512.png");
  assert.equal(staticIcon("/yakuchil-icon.png", 192), undefined);
  assert.equal(staticIcon("/fropexio-icon.png", 100), undefined);
});

test("appIcon picks the full-bleed source only when asked", () => {
  assert.equal(appIcon(pair, 192), "/icons/fropexio-icon-192.png");
  assert.equal(appIcon(pair, 192, true), "/icons/fropexio-icon-maskable-192.png");
});

test("askedIconSize keeps the sizes on offer and falls back to 64", () => {
  assert.equal(askedIconSize("180"), 180);
  assert.equal(askedIconSize(null), 64);
  assert.equal(askedIconSize("9999"), 64);
});

test("the old routes redirect permanently to a relative path, cacheable by the CDN", () => {
  const response = redirectToStatic("/icons/fropexio-icon-192.png");
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("Location"), "/icons/fropexio-icon-192.png");
  assert.match(response.headers.get("Cache-Control") ?? "", /s-maxage=31536000/);
});
