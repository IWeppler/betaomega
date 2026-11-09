import "server-only";

// Server public entry: the build fails if a client component imports this file.
export { getAgenda, getBookings, patchBooking } from "./api/bookings";
export { getManualAvailability, postManualBooking } from "./api/manual-bookings";
export { getAvailability, postReservation, publicHome, publicPage, publicReservation, SITE_IMAGE } from "./api/public";
export { getIcon, getManifest } from "./api/app-icon";
export { getCodes, postCode, postCodeCheck } from "./api/codes";
export { disconnectMercadoPago, finishMercadoPagoConnect, startMercadoPagoConnect } from "./api/mercadopago-connect";
export { postMercadoPagoNotice, postPayment, postPlanPayment } from "./api/payments";
export { getPlans, postPlan, postPlanReservation, publicPlan } from "./api/plans";
export { deleteClosure, getConfig, patchSettings, postClosure, putPage, putTypes, putWeek } from "./api/setup";
