// src/utils/cardMapping.ts
// ————————————————————————————————————————————————————————————————
// Build a map of card-ID → asset URL, mirroring your Kotlin logic.
// Mono-color properties now pick distinct SVGs for each copy,
// and null-priced wildcards map to the card back.
// ————————————————————————————————————————————————————————————————

/** 1. Glob-import all your card SVGs as URLs */
// Vite changed import.meta.glob options; use query + import to get URLs
const modules = import.meta.glob("../assets/cards/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const svgByName: Record<string, string> = {};
for (const path in modules) {
  const file = path.split("/").pop()!;
  svgByName[file] = modules[path] as unknown as string;
}

/** 2. Build the mapping with proper counts & distinct names */
export const cardAssetMap: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  let id = 0;

  // ── Action cards ───────────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-dealbreaker.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["action-just-say-no.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["action-sly-deal.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["action-forced-deal.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["action-debt-collector.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["action-birthday.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["action-house.svg"];
  }
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-hotel.svg"];
  }
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-double-rent.svg"];
  }
  for (let i = 0; i < 10; i++) {
    id++;
    m[id] = svgByName["action-pass-go.svg"];
  }

  // ── Rent cards ─────────────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-rent-green-dark-blue.svg"];
  }
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-rent-brown-light-blue.svg"];
  }
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-rent-magenta-orange.svg"];
  }
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-rent-yellow-red.svg"];
  }
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["action-rent-mint-black.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["action-rent-any-color.svg"];
  } // wild rent

  // ── Properties (mono-color, distinct SVGs) ─────────────────────
  // Dark-blue (2): rpcc + josh
  id++;
  m[id] = svgByName["property-dark-blue-rpcc.svg"];
  id++;
  m[id] = svgByName["property-dark-blue-josh.svg"];

  // Green (3): quarry, stewart, university
  id++;
  m[id] = svgByName["property-green-quarry.svg"];
  id++;
  m[id] = svgByName["property-green-stewart.svg"];
  id++;
  m[id] = svgByName["property-green-university.svg"];

  // Brown (2): terrace, trillium
  id++;
  m[id] = svgByName["property-brown-terrace.svg"];
  id++;
  m[id] = svgByName["property-brown-trillium.svg"];

  // Turquoise (3) → light-blue assets (halal, louies, simple)
  id++;
  m[id] = svgByName["property-light-blue-halal.svg"];
  id++;
  m[id] = svgByName["property-light-blue-louies.svg"];
  id++;
  m[id] = svgByName["property-light-blue-simple.svg"];

  // Magenta (3)
  id++;
  m[id] = svgByName["property-magenta-711.svg"];
  id++;
  m[id] = svgByName["property-magenta-ctb.svg"];
  id++;
  m[id] = svgByName["property-magenta-liquor.svg"];

  // Orange (3)
  id++;
  m[id] = svgByName["property-orange-hideaway.svg"];
  id++;
  m[id] = svgByName["property-orange-level-b.svg"];
  id++;
  m[id] = svgByName["property-orange-moonies.svg"];

  // Red (3)
  id++;
  m[id] = svgByName["property-red-becker.svg"];
  id++;
  m[id] = svgByName["property-red-cook.svg"];
  id++;
  m[id] = svgByName["property-red-rose.svg"];

  // Yellow (3)
  id++;
  m[id] = svgByName["property-yellow-dos.svg"];
  id++;
  m[id] = svgByName["property-yellow-texas.svg"];
  id++;
  m[id] = svgByName["property-yellow-wings.svg"];

  // Railroad (4) → use the black-*.svg as railroad
  id++;
  m[id] = svgByName["property-black-ganedago.svg"];
  id++;
  m[id] = svgByName["property-black-jam.svg"];
  id++;
  m[id] = svgByName["property-black-morrison.svg"];
  id++;
  m[id] = svgByName["property-black-ujamaa.svg"];

  // Utility (2) → mint-*.svg
  id++;
  m[id] = svgByName["property-mint-duffield.svg"];
  id++;
  m[id] = svgByName["property-mint-olin.svg"];

  // ── Wild Properties (non-null price) ───────────────────────────
  id++;
  m[id] = svgByName["wproperty-dark-blue-green.svg"];
  id++;
  m[id] = svgByName["wproperty-light-blue-brown.svg"];
  id++;
  m[id] = svgByName["wproperty-magenta-orange.svg"];
  id++;
  m[id] = svgByName["wproperty-green-black.svg"];
  id++;
  m[id] = svgByName["wproperty-light-blue-black.svg"];
  id++;
  m[id] = svgByName["wproperty-mint-black.svg"];
  id++;
  m[id] = svgByName["wproperty-red-yellow.svg"];
  id++;
  m[id] = svgByName["wproperty-red-yellow.svg"];
  id++;
  // Wild card rainbow (null price, used for wilds)
  m[id] = svgByName["wproperty-rainbow.svg"];
  id++;
  m[id] = svgByName["wproperty-rainbow.svg"];

  // ── Money cards ─────────────────────────────────────────────────
  for (let i = 0; i < 6; i++) {
    id++;
    m[id] = svgByName["money-1.svg"];
  }
  for (let i = 0; i < 5; i++) {
    id++;
    m[id] = svgByName["money-2.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["money-3.svg"];
  }
  for (let i = 0; i < 3; i++) {
    id++;
    m[id] = svgByName["money-4.svg"];
  }
  for (let i = 0; i < 2; i++) {
    id++;
    m[id] = svgByName["money-5.svg"];
  }
  for (let i = 0; i < 1; i++) {
    id++;
    m[id] = svgByName["money-10.svg"];
  }

  return m;
})();
