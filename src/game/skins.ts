import cyberBladeArt from "@/assets/cyber-blade.png.asset.json";
import ogModel from "@/assets/og-model.glb.asset.json";
import ogmodelArt from "@/assets/skins/ogmodel.png.asset.json";
import emberArt from "@/assets/skins/ember.png.asset.json";
import frostlineArt from "@/assets/skins/frostline.png.asset.json";
import voltageArt from "@/assets/skins/voltage.png.asset.json";
import jungleArt from "@/assets/skins/jungle.png.asset.json";
import midnightArt from "@/assets/skins/midnight.png.asset.json";
import aurumArt from "@/assets/skins/aurum.png.asset.json";

export interface Skin {
  id: string;
  name: string;
  tag: string;
  suit: string;
  accent: string;
  trim: string;
  visor: string;
  price: number;
  rarity: "Standard" | "Selten" | "Episch" | "Legendär";
  /** optional key art shown instead of the procedural 3D bust */
  art?: string;
  /** optional GLB model used as the in-game character */
  model?: string;
}

export const SKINS: Skin[] = [
  {
    id: "ogmodel",
    price: 0,
    rarity: "Legendär",
    name: "OG MODEL",
    tag: "Original 1v1.LOL Style",
    suit: "#3a5a3a",
    accent: "#6ea8ff",
    trim: "#2b3242",
    visor: "#6ea8ff",
    model: ogModel.url,
    art: ogmodelArt.url,
  },
  {
    id: "cyberblade",
    price: 0,
    rarity: "Episch",
    name: "CYBERBLADE",
    tag: "Neon-Klinge Operator",
    suit: "#2b3242",
    accent: "#3ff0d0",
    trim: "#131823",
    visor: "#5ffbe4",
    model: ogModel.url,
    art: cyberBladeArt.url,
  },
  {
    id: "ember",
    price: 800,
    rarity: "Selten",
    name: "GLUTKERN",
    tag: "Vulkan-Einheit",
    suit: "#3b2320",
    accent: "#ff7a3c",
    trim: "#1b1210",
    visor: "#ffb066",
    model: ogModel.url,
    art: emberArt.url,
  },
  {
    id: "frostline",
    price: 800,
    rarity: "Selten",
    name: "FROSTLINIE",
    tag: "Polar-Späher",
    suit: "#243447",
    accent: "#7fd6ff",
    trim: "#141d28",
    visor: "#bdefff",
    model: ogModel.url,
    art: frostlineArt.url,
  },
  {
    id: "voltage",
    price: 1200,
    rarity: "Episch",
    name: "HOCHSPANNUNG",
    tag: "Sturm-Techniker",
    suit: "#2a2440",
    accent: "#c08bff",
    trim: "#171326",
    visor: "#e2c4ff",
    model: ogModel.url,
    art: voltageArt.url,
  },
  {
    id: "jungle",
    price: 1200,
    rarity: "Episch",
    name: "DSCHUNGELJÄGER",
    tag: "Verdeckte Aufklärung",
    suit: "#2d3a24",
    accent: "#9ede4f",
    trim: "#161d11",
    visor: "#d3ff8f",
    model: ogModel.url,
    art: jungleArt.url,
  },
  {
    id: "midnight",
    price: 1800,
    rarity: "Legendär",
    name: "MITTERNACHTSKLINGE",
    tag: "Schattenprotokoll",
    suit: "#14161f",
    accent: "#ff3d71",
    trim: "#0a0b10",
    visor: "#ff8fae",
    model: ogModel.url,
    art: midnightArt.url,
  },
  {
    id: "aurum",
    price: 2400,
    rarity: "Legendär",
    name: "AURUM PRIME",
    tag: "Champion-Ausrüstung",
    suit: "#2b2416",
    accent: "#ffd166",
    trim: "#171208",
    visor: "#fff0b8",
    model: ogModel.url,
    art: aurumArt.url,
  },
];

export const DEFAULT_SKIN = SKINS[0]!;

export function getSkin(id: string | undefined): Skin {
  return SKINS.find((s) => s.id === id) ?? DEFAULT_SKIN;
}

/** the opponent always reads a bit warmer so you can tell fighters apart */
export const ENEMY_FALLBACK_SKIN = SKINS[0]!;

export const FREE_SKINS = SKINS.filter((s) => s.price === 0).map((s) => s.id);
