export type SaunaHerb = { id: string; name: string; description: string };

/** Only herbs explicitly offered for sauna are public here; shop visibility is independent. */
export function saunaHerbs(plants: { id: string; name: string; published: boolean; saunaEnabled?: boolean; saunaDescription?: string }[]): SaunaHerb[] {
  return plants.filter(plant => plant.published && plant.saunaEnabled === true)
    .map(plant => ({ id: plant.id, name: plant.name, description: plant.saunaDescription ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

export function selectedHerb(herbs: SaunaHerb[], id: unknown): SaunaHerb | null {
  if (id === undefined || id === null || id === "") return null;
  const herb = typeof id === "string" ? herbs.find(item => item.id === id) : undefined;
  if (!herb) throw new Error("Esa hierba ya no está disponible. Elegí otra o continuá sin hierba.");
  return herb;
}
