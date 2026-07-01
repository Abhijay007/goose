import type { AddonEntry } from "../types/addon";

const ADDONS_URL = "/add-ons.json";

export async function fetchAddons(): Promise<AddonEntry[]> {
  const response = await fetch(ADDONS_URL);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function searchAddons(query: string): Promise<AddonEntry[]> {
  const addons = await fetchAddons();
  const normalizedQuery = query.toLowerCase();

  return addons.filter((addon) => {
    const haystack = [
      addon.name,
      addon.description,
      addon.id,
      ...addon.contributions,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
