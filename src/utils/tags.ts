import type { Group, Offer } from "../api/types";

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

export function normalizeTag(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(" ").toLowerCase().slice(0, MAX_TAG_LENGTH);
}

export function groupsForOffer(offer: Pick<Offer, "tags">, groups: Group[]): Group[] {
  const tags = new Set(offer.tags ?? []);
  return groups.filter((group) => !group.tags?.length || group.tags.some((tag) => tags.has(tag)));
}

export function collectTags(...lists: { tags?: string[] }[][]): string[] {
  const all = new Set<string>();
  lists.flat().forEach((item) => item.tags?.forEach((tag) => all.add(tag)));
  return [...all].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
