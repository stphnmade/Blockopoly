/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlayerPropertyGridVM, PropertySetVM, CardVM } from "../../types/viewmodels";

type ColorMeta = {
  label: string;
  token: string;
  required: number;
  rentTiers: number[];
};

const COLOR_META: Record<string, ColorMeta> = {
  BROWN: { label: "Brown", token: "#b08968", required: 2, rentTiers: [1, 2] },
  TURQOUISE: { label: "Light Blue", token: "#7dd3fc", required: 3, rentTiers: [1, 2, 3] },
  MAGENTA: { label: "Magenta", token: "#f472b6", required: 3, rentTiers: [1, 2, 4] },
  ORANGE: { label: "Orange", token: "#fb923c", required: 3, rentTiers: [1, 3, 5] },
  RED: { label: "Red", token: "#ef4444", required: 3, rentTiers: [2, 3, 6] },
  YELLOW: { label: "Yellow", token: "#facc15", required: 3, rentTiers: [2, 4, 6] },
  GREEN: { label: "Green", token: "#22c55e", required: 3, rentTiers: [2, 4, 7] },
  BLUE: { label: "Dark Blue", token: "#1e3a8a", required: 2, rentTiers: [3, 8] },
  RAILROAD: { label: "Railroad", token: "#0f172a", required: 4, rentTiers: [1, 2, 3, 4] },
  UTILITY: { label: "Utility", token: "#34d399", required: 2, rentTiers: [1, 2] },
};

const COLOR_ALIASES: Record<string, string> = {
  DARK_BLUE: "BLUE",
  LIGHT_BLUE: "TURQOUISE",
  BLACK: "RAILROAD",
  MINT: "UTILITY",
};

function canonicalKeyForSetName(name: string) {
  return (name || "UNKNOWN").toString().toUpperCase();
}

function normalizeColorKey(value?: string | null) {
  const key = canonicalKeyForSetName(value || "");
  return COLOR_ALIASES[key] ?? key;
}

function computeIsComplete(required: number | undefined, cardCount: number, isCompleteFlag?: boolean) {
  if (typeof isCompleteFlag === "boolean") return isCompleteFlag;
  if (!required) return false;
  return cardCount >= required;
}

function computeRentValue(meta: ColorMeta | undefined, cardCount: number, developmentValue: number) {
  if (!meta) return developmentValue;
  const cappedCount = Math.min(cardCount, meta.required);
  if (cappedCount <= 0) return developmentValue;
  const tier = meta.rentTiers[cappedCount - 1] ?? 0;
  return tier + developmentValue;
}

export function buildPlayerPropertyGridVM(
  playerStateOrProperties: any,
  cardImageForId?: (id: number) => string
): PlayerPropertyGridVM {
  const sets: PropertySetVM[] = [];
  if (!playerStateOrProperties) return { sets: [], overflow: [] };

  let rawMap: Record<string, any> | null = null;
  if (typeof playerStateOrProperties === "object" && !Array.isArray(playerStateOrProperties)) {
    if ((playerStateOrProperties as any).propertyCollection) {
      const pc = (playerStateOrProperties as any).propertyCollection;
      rawMap = pc.collection ? pc.collection : pc;
    } else {
      rawMap = playerStateOrProperties as Record<string, any>;
    }
  }
  if (!rawMap) return { sets: [], overflow: [] };

  for (const setId of Object.keys(rawMap)) {
    const val = rawMap[setId];
    let cardArr: any[] = [];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
      cardArr = (val as string[]).map((url, i) => ({ id: `u${i}`, image: url, name: "Property" }));
    } else if (Array.isArray(val)) {
      cardArr = val;
    } else if (val && Array.isArray(val.properties)) {
      cardArr = val.properties;
    }

    const setColor = val?.color ?? null;
    const colorKey = normalizeColorKey(setColor || setId);
    const meta = COLOR_META[colorKey];
    const requiredCount = meta?.required;

    const cards: CardVM[] = cardArr.map((c: any, idx: number) => {
      const idValue =
        typeof c === "number" || typeof c === "string"
          ? c
          : (c && (c as any).id) ?? `x${idx}`;
      const imageFromCard = (c && (c as any).image)
        ? String((c as any).image)
        : (c && (c as any).imageUrl) ? String((c as any).imageUrl) : undefined;
      const numericId =
        typeof idValue === "number"
          ? idValue
          : typeof idValue === "string" && /^\\d+$/.test(idValue)
            ? Number(idValue)
            : undefined;
      const resolvedById =
        typeof numericId === "number" ? cardImageForId?.(numericId) : undefined;
      const stringUrl =
        typeof c === "string" && !/^\\d+$/.test(c) ? c : undefined;
      const imageUrl = resolvedById ?? imageFromCard ?? stringUrl;
      const colors = (c && (c as any).colors) ? (c as any).colors : [];
      const value = (c && typeof (c as any).value === "number") ? Number((c as any).value) : undefined;
      return {
        id: String(idValue),
        name: (c && (c as any).name) ? String((c as any).name) : `#${idValue ?? idx}`,
        imageUrl,
        setColors: colors,
        value,
        isWild: Array.isArray(colors) && colors.length > 1,
        assignedColor: setColor ?? null,
      };
    });

    const developmentValue =
      (val && typeof val.house?.value === "number" ? val.house.value : 0) +
      (val && typeof val.hotel?.value === "number" ? val.hotel.value : 0);
    const hasHouse = Boolean(val?.house);
    const hasHotel = Boolean(val?.hotel);
    const currentCount = cards.length;
    const isComplete = computeIsComplete(requiredCount, currentCount, val?.isComplete);
    const rentValue = computeRentValue(meta, currentCount, developmentValue);
    const overage = requiredCount && currentCount > requiredCount ? currentCount - requiredCount : 0;
    const vm: PropertySetVM = {
      key: String(setId),
      colorKey,
      displayName: meta?.label ?? setId.toString(),
      colorToken: meta?.token,
      cards,
      isComplete,
      requiredCount,
      currentCount,
      rentValue,
      overage,
      hasHouse,
      hasHotel,
    };
    sets.push(vm);
  }

  const COLOR_PRIORITY = ["RED","BLUE","GREEN","YELLOW","ORANGE","MAGENTA","TURQOUISE","BROWN","RAILROAD","UTILITY"];
  sets.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length;
    const ai = COLOR_PRIORITY.indexOf((a.colorKey ?? a.key) as string);
    const bi = COLOR_PRIORITY.indexOf((b.colorKey ?? b.key) as string);
    if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.displayName.localeCompare(b.displayName);
  });

  const primary = sets.slice(0, 10);
  const overflow = sets.slice(10);
  return { sets: primary, overflow };
}
