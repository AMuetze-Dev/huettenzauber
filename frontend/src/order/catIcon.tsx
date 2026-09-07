import {
  Bread,
  BeerStein,
  Brandy,
  Carrot,
  Champagne,
  Cheers,
  Coffee,
  Cookie,
  Drop,
  Fish,
  ForkKnife,
  Hamburger,
  IceCream,
  Martini,
  Package,
  Pizza,
  Popcorn,
  ShoppingBag,
  Snowflake,
  Sparkle,
  Storefront,
  Wine,
  type Icon,
} from "@phosphor-icons/react";

/**
 * Kategorie-Icons.
 *
 * Am Ausschank wird auf das Bild getippt, nicht gelesen - deshalb ist das
 * Icon frei waehlbar (Verwaltung -> Katalog -> Kategorie). `key` steht im
 * Feld `icon` der Kategorie und darf sich nicht mehr aendern.
 */
export interface IconChoice {
  key: string;
  label: string;
  Icon: Icon;
}

export const CATEGORY_ICONS: IconChoice[] = [
  { key: "beer", label: "Bier", Icon: BeerStein },
  { key: "wine", label: "Wein", Icon: Wine },
  { key: "champagne", label: "Sekt", Icon: Champagne },
  { key: "cheers", label: "Anstoßen", Icon: Cheers },
  { key: "coffee", label: "Heißgetränk", Icon: Coffee },
  { key: "brandy", label: "Schnaps", Icon: Brandy },
  { key: "martini", label: "Cocktail", Icon: Martini },
  { key: "water", label: "Alkoholfrei", Icon: Drop },
  { key: "food", label: "Essen", Icon: ForkKnife },
  { key: "burger", label: "Burger", Icon: Hamburger },
  { key: "pizza", label: "Pizza", Icon: Pizza },
  { key: "bread", label: "Backwaren", Icon: Bread },
  { key: "fish", label: "Fisch", Icon: Fish },
  { key: "veggie", label: "Gemüse", Icon: Carrot },
  { key: "sweets", label: "Süßes", Icon: Cookie },
  { key: "icecream", label: "Eis", Icon: IceCream },
  { key: "popcorn", label: "Knabbern", Icon: Popcorn },
  { key: "winter", label: "Winter", Icon: Snowflake },
  { key: "special", label: "Besonderes", Icon: Sparkle },
  { key: "shop", label: "Verkauf", Icon: ShoppingBag },
  { key: "stand", label: "Stand", Icon: Storefront },
  { key: "other", label: "Sonstiges", Icon: Package },
];

const BY_KEY = new Map(CATEGORY_ICONS.map((c) => [c.key, c.Icon]));

/** Notnagel fuer Kategorien, denen noch niemand ein Icon gegeben hat. */
const RULES: [RegExp, string][] = [
  [/bier|beer|weizen|radler|helles|pils/i, "beer"],
  [/wein|wine|federweiss|federweiß/i, "wine"],
  [/sekt|prosecco|champagner/i, "champagne"],
  [/glüh|gluh|warm|kaffee|coffee|tee|punsch|jager|jäger/i, "coffee"],
  [/spiritu|schnaps|likör|likor|obstler/i, "brandy"],
  [/cocktail|aperol|longdrink/i, "martini"],
  [/alkoholfrei|wasser|water|spezi|saft|limo|soft|cola/i, "water"],
  [/eis|ice/i, "icecream"],
  [/süß|suess|sweet|dessert|kuchen|waffel|schoko|kaiserschmarrn/i, "sweets"],
  [/brot|brezel|semmel|weck/i, "bread"],
  [
    /küche|kueche|kuche|essen|food|wurst|pommes|schnitzel|spätzle|spaetzle|spatzle|imbiss/i,
    "food",
  ],
];

export function iconKeyFor(category: { name: string; icon?: string }): string {
  if (category.icon && BY_KEY.has(category.icon)) return category.icon;
  // Alt-Bestand: Icon war frueher aus dem Namen geraten.
  const hay = `${category.name} ${category.icon ?? ""}`;
  for (const [re, key] of RULES) if (re.test(hay)) return key;
  return "other";
}

export function catIcon(category: { name: string; icon?: string }): Icon {
  return BY_KEY.get(iconKeyFor(category)) ?? Package;
}
