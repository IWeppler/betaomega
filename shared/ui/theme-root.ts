/** Where popups are portaled. Tokens are set on the element holding data-theme, so a popup on <body> would lose the colours and fonts of its site. */
export const themeRoot = () => (typeof document === "undefined" ? undefined : document.querySelector<HTMLElement>("[data-theme]") ?? undefined);
