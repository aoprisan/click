// Hand-authored recipe AMOUNTS — the "richer config" layer over the CSV.
//
// The tech-tree CSV (docs/gamer_supply_chain_tech_tree.csv) only names a
// building's ingredients ("Iron Bricks + Coal -> Steel Alloys"), not how MANY of
// each. gen-catalog therefore emits every recipe as 1-in / 1-out. This file is
// the editable overlay that overrides those 1s with real per-batch quantities so
// supply chains have weight: a building consumes `inputs[r]` of each input and
// yields `outputs[r] × level` of each output per production batch (economy.ts).
//
// Rules for editing:
//   - Key = building id (the slug in catalog.data.ts, e.g. 'blast-furnace').
//   - Resource names must match the canonical names in that building's recipe
//     (see catalog.data.ts). You can only re-weight ingredients the CSV already
//     lists — you can't introduce a new one here.
//   - Anything you don't list stays at 1. Buildings absent from this map are
//     entirely 1-in / 1-out.
//   - catalog.ts validates every entry at load and console.warns on a typo'd id
//     or resource, so a bad override is loud, not silent.
//
// Balance note: raw producers (no material input) get a bumped output so the
// chains downstream have something to draw on; processors consume a little more
// than they emit, so value-add costs real upstream throughput.

export interface RecipeOverride {
  inputs?: Record<string, number>
  outputs?: Record<string, number>
}

export const RECIPE_AMOUNTS: Record<string, RecipeOverride> = {
  // --- Food & Population ---
  // crop-farm is intentionally left at 1-out: food is the happiness valve and
  // stays deliberately un-enriched (see docs/CORE_LOOP.md §3).
  'windmill': { inputs: { 'Grain': 2 }, outputs: { 'Flour': 1 } },

  // --- Metallurgy & Construction ---
  'primitive-forge': { inputs: { 'Timber': 1, 'Iron Ore': 2 }, outputs: { 'Iron Bricks': 2 } },
  'metal-works-shop': { inputs: { 'Iron Bricks': 2, 'Timber': 1 }, outputs: { 'Basic Tools': 1 } },
  'blast-furnace': { inputs: { 'Iron Bricks': 2, 'Coal': 1 }, outputs: { 'Steel Alloys': 1 } },

  // --- Apparel & Textiles ---
  'weaving-loom': { inputs: { 'Cotton': 2 }, outputs: { 'Basic Cloth': 2 } },

  // --- Mining & Resource Refining (raw producer, bumped throughput) ---
  'surface-dig-trench': { outputs: { 'Surface Ore & Coal': 3 } },

  // --- Chemicals & Plastics ---
  'potash-pit': { inputs: { 'Timber': 1 }, outputs: { 'Basic Alkaline': 2 } },

  // --- Electronics & Semiconductors (raw producer) ---
  'silica-quarry': { outputs: { 'Raw Quartz & Silica': 3 } },
}
