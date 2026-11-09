// Client-safe public entry. The notices module is only the panel screen: rules and sending are in platform/notifications, because
// the sauna and the existing recipes code both raise notices and neither may import a module.
export {};
