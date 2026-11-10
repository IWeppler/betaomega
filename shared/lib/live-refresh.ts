// How often an open screen asks the server again for data other people may have changed (bookings, catalogue, notices).
// Each ask is one function run on Vercel, billed in Active CPU, and a tab left open all day adds up: five minutes keeps it cheap.
// The screens also refresh when the window gets the focus back, so whoever returns to a tab sees fresh data at once.
export const liveRefreshMs = 5 * 60_000;
