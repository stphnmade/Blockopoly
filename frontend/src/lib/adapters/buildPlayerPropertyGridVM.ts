/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlayerPropertyGridVM, PropertySetVM, CardVM } from "../../types/viewmodels";

// Map of canonical set sizes for completion rules
const SET_SIZES: Record<string, number> = {
  "DARK_BLUE": 2,
  "GREEN": 3,
  "BROWN": 2,
  "LIGHT_BLUE": 3,
  "MAGENTA": 3,
  "ORANGE": 3,
  "RED": 3,
  "YELLOW": 3,
  "BLACK": 4, // railroad
  "MINT": 2, // utility
};

function canonicalKeyForSetName(name: string) {
  // normalize backend set id/name to an uppercase canonical key
  return (name || "UNKNOWN").toString().toUpperCase();
}

function computeIsComplete(key: string, cards: CardVM[]) {
  const k = canonicalKeyForSetName(key);
  const need = SET_SIZES[k];
  if (!need) return false;
  return cards.length >= need;
}

export function buildPlayerPropertyGridVM(playerStateOrProperties: any): PlayerPropertyGridVM {
  const sets: PropertySetVM[] = [];
  if (!playerStateOrProperties) return { sets: [], overflow: [] };

  // If the input is the lightweight map produced by PlayScreen.playerCardMap (setId -> string[])
  let rawMap: Record<string, any> | null = null;
  if (typeof playerStateOrProperties === "object" && !Array.isArray(playerStateOrProperties)) {
    // has propertyCollection? use that shape
    if ((playerStateOrProperties as any).propertyCollection) {
      const pc = (playerStateOrProperties as any).propertyCollection;
      rawMap = pc.collection ? pc.collection : pc;
    } else {
      // assume it's already a map of setId -> array (strings or server card objects)
      rawMap = playerStateOrProperties as Record<string, any>;
    }
  }
  if (!rawMap) return { sets: [], overflow: [] };

  for (const setId of Object.keys(rawMap)) {
    const val = rawMap[setId];
    // If value is array of strings (asset URLs), convert accordingly
    let cardArr: any[] = [];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
      cardArr = (val as string[]).map((url, i) => ({ id: `u${i}`, image: url, name: `Property` }));
    } else if (Array.isArray(val)) {
      cardArr = val;
    } else if (val && Array.isArray(val.properties)) {
      cardArr = val.properties;
    }

    const cards: CardVM[] = cardArr.map((c: any, idx: number) => ({
      id: String((c && (c as any).id) ?? `x${idx}`),
      name: (c && (c as any).name) ? String((c as any).name) : `#${(c && (c as any).id) ?? idx}`,
      imageUrl: (c && (c as any).image) ? String((c as any).image) : (typeof c === "string" ? c : undefined),
      setColors: (c && (c as any).colors) ? (c as any).colors : [],
      value: (c && (c as any).value) ? Number((c as any).value) : undefined,
    }));

    const key = canonicalKeyForSetName(setId);
    const vm: PropertySetVM = {
      key,
      displayName: setId.toString(),
      colorToken: undefined,
      cards,
      isComplete: computeIsComplete(key, cards),
    };
    sets.push(vm);
  }

  // sort as requested: complete first, size desc, color priority, alphabetical
  const COLOR_PRIORITY = ["RED","BLUE","GREEN","YELLOW","ORANGE","MAGENTA","LIGHT_BLUE","BROWN","BLACK","MINT"];
  sets.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length;
    const ai = COLOR_PRIORITY.indexOf(a.key as string);
    const bi = COLOR_PRIORITY.indexOf(b.key as string);
    if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.displayName.localeCompare(b.displayName);
  });

  const primary = sets.slice(0, 10);
  const overflow = sets.slice(10);
  return { sets: primary, overflow };
}
