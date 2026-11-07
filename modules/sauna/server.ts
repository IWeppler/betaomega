import "server-only";

// Server public entry: the build fails if a client component imports this file.
export { getAgenda, getBookings, patchBooking } from "./api/bookings";
export { getManualAvailability, postManualBooking } from "./api/manual-bookings";
export { getAvailability, postReservation, publicHome, publicPage, publicReservation, SITE_IMAGE } from "./api/public";
export { deleteClosure, getConfig, patchSettings, postClosure, putPage, putTypes, putWeek } from "./api/setup";
