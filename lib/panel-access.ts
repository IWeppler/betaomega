// Which sections of a site's panel a session may see. Pure, so the same rule can run in the menu and in the routes.
// Today the only session is the administrator, who sees everything: `granted` undefined means "all". When panels get their own
// operators, their session lists the permissions it holds (like "sauna.agenda") and the sections that name another one disappear.

/** A section with no `permission` is open to anyone who can enter the panel of that site. */
export function visibleSections<S extends { permission?: string }>(sections: readonly S[], granted?: readonly string[]): S[] {
  if (!granted) return [...sections];
  return sections.filter(section => !section.permission || granted.includes(section.permission));
}

/** True when `path` ("" is the summary) is a section the session may open. */
export function canOpen(sections: readonly { path: string; permission?: string }[], path: string, granted?: readonly string[]) {
  return visibleSections(sections, granted).some(section => section.path === path);
}
