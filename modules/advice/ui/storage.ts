// Where the device keeps today's advice. One key per site, read by the modal (which writes it) and by the home page's aside.
export const storageKey = (siteId: string) => `advice:${siteId}`;
