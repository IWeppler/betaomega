import assert from "node:assert/strict";
import { test } from "node:test";
import { mapLocation, trustedMapUrl } from "./map-location.ts";

test("el mapa usa el marcador del lugar y no el centro de la cámara", () => {
  assert.deepEqual(mapLocation("https://www.google.com/maps/place/Local/@-29.23,-61.76,15z/data=!3d-29.2326036!4d-61.7645872"), { latitude: -29.2326036, longitude: -61.7645872 });
  assert.deepEqual(mapLocation("https://maps.google.com/?q=0,0"), { latitude: 0, longitude: 0 });
  assert.equal(mapLocation("https://www.google.com/maps/@-29,-61,15z"), null);
});
test("no se inventan coordenadas y solo se resuelven enlaces de Maps permitidos", () => {
  for (const value of ["https://evil.example/?q=1,2", "http://www.google.com/?q=1,2", "https://www.google.com.evil.example/", "https://user:pass@www.google.com/?q=1,2", "https://www.google.com:444/?q=1,2", "invalid"]) assert.equal(trustedMapUrl(value), null);
  for (const value of ["https://maps.app.goo.gl/example", "https://www.google.com/?q=91,0", "https://www.google.com/?q=0,181", "https://www.google.com/?q=una+dirección", "https://www.google.com/%xx"]) assert.equal(mapLocation(value), null);
});
