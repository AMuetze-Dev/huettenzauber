import {
  Avocado,
  Balloon,
  Basket,
  BeerBottle,
  BeerStein,
  BowlFood,
  BowlSteam,
  Brandy,
  Bread,
  Cake,
  Campfire,
  Carrot,
  Champagne,
  Cheers,
  Cheese,
  Coffee,
  Coins,
  Confetti,
  Cookie,
  Cow,
  Crown,
  Drop,
  Egg,
  Fire,
  Fish,
  Flower,
  ForkKnife,
  Gift,
  Grains,
  Hamburger,
  IceCream,
  Jar,
  Leaf,
  Martini,
  MusicNote,
  Nut,
  Orange,
  Package,
  Pepper,
  PintGlass,
  Pizza,
  Popcorn,
  Shrimp,
  ShoppingBag,
  Snowflake,
  Sparkle,
  Star,
  Storefront,
  Sun,
  Tag,
  TeaBag,
  Tent,
  ThermometerHot,
  Ticket,
  TipJar,
  TreeEvergreen,
  Wine,
  type Icon,
} from "@phosphor-icons/react";

/**
 * Kategorie-Symbole.
 *
 * Am Ausschank wird auf das Bild getippt, nicht gelesen - deshalb ist das
 * Symbol frei waehlbar (Verwaltung -> Katalog -> Kategorie bearbeiten).
 * `key` steht im Feld `icon` der Kategorie und darf sich NIE mehr aendern,
 * sonst verlieren bestehende Kataloge ihr Bild.
 */
export interface IconChoice {
  key: string;
  label: string;
  group: string;
  Icon: Icon;
}

export const ICON_GROUPS = [
  "Bier",
  "Wein & Spirituosen",
  "Warmes",
  "Alkoholfrei",
  "Küche",
  "Süßes",
  "Fest & Saison",
  "Verkauf",
] as const;

export const CATEGORY_ICONS: IconChoice[] = [
  // --- Bier ---
  { key: "beer", label: "Bierkrug", group: "Bier", Icon: BeerStein },
  { key: "beerbottle", label: "Bierflasche", group: "Bier", Icon: BeerBottle },
  { key: "pint", label: "Bierglas", group: "Bier", Icon: PintGlass },
  { key: "cheers", label: "Anstoßen", group: "Bier", Icon: Cheers },

  // --- Wein & Spirituosen ---
  { key: "wine", label: "Wein", group: "Wein & Spirituosen", Icon: Wine },
  { key: "champagne", label: "Sekt", group: "Wein & Spirituosen", Icon: Champagne },
  { key: "brandy", label: "Schnaps", group: "Wein & Spirituosen", Icon: Brandy },
  { key: "martini", label: "Cocktail", group: "Wein & Spirituosen", Icon: Martini },

  // --- Warmes ---
  { key: "coffee", label: "Kaffee", group: "Warmes", Icon: Coffee },
  { key: "tea", label: "Tee", group: "Warmes", Icon: TeaBag },
  { key: "mulled", label: "Glühwein", group: "Warmes", Icon: ThermometerHot },
  { key: "soup", label: "Suppe", group: "Warmes", Icon: BowlSteam },

  // --- Alkoholfrei ---
  { key: "water", label: "Wasser", group: "Alkoholfrei", Icon: Drop },
  { key: "juice", label: "Saft", group: "Alkoholfrei", Icon: Orange },
  { key: "jar", label: "Krug", group: "Alkoholfrei", Icon: Jar },

  // --- Küche ---
  { key: "food", label: "Essen", group: "Küche", Icon: ForkKnife },
  { key: "burger", label: "Burger", group: "Küche", Icon: Hamburger },
  { key: "pizza", label: "Pizza", group: "Küche", Icon: Pizza },
  { key: "bread", label: "Backwaren", group: "Küche", Icon: Bread },
  { key: "bowl", label: "Schale", group: "Küche", Icon: BowlFood },
  { key: "meat", label: "Fleisch", group: "Küche", Icon: Cow },
  { key: "fish", label: "Fisch", group: "Küche", Icon: Fish },
  { key: "shrimp", label: "Meeresfrüchte", group: "Küche", Icon: Shrimp },
  { key: "cheese", label: "Käse", group: "Küche", Icon: Cheese },
  { key: "egg", label: "Ei", group: "Küche", Icon: Egg },
  { key: "veggie", label: "Gemüse", group: "Küche", Icon: Carrot },
  { key: "pepper", label: "Scharfes", group: "Küche", Icon: Pepper },
  { key: "grains", label: "Getreide", group: "Küche", Icon: Grains },
  { key: "nut", label: "Nüsse", group: "Küche", Icon: Nut },
  { key: "avocado", label: "Vegetarisch", group: "Küche", Icon: Avocado },

  // --- Süßes ---
  { key: "sweets", label: "Gebäck", group: "Süßes", Icon: Cookie },
  { key: "cake", label: "Kuchen", group: "Süßes", Icon: Cake },
  { key: "icecream", label: "Eis", group: "Süßes", Icon: IceCream },
  { key: "popcorn", label: "Knabbern", group: "Süßes", Icon: Popcorn },

  // --- Fest & Saison ---
  { key: "winter", label: "Winter", group: "Fest & Saison", Icon: Snowflake },
  { key: "tree", label: "Weihnachten", group: "Fest & Saison", Icon: TreeEvergreen },
  { key: "campfire", label: "Lagerfeuer", group: "Fest & Saison", Icon: Campfire },
  { key: "fire", label: "Gegrilltes", group: "Fest & Saison", Icon: Fire },
  { key: "sun", label: "Sommer", group: "Fest & Saison", Icon: Sun },
  { key: "flower", label: "Frühling", group: "Fest & Saison", Icon: Flower },
  { key: "leaf", label: "Herbst", group: "Fest & Saison", Icon: Leaf },
  { key: "confetti", label: "Fasching", group: "Fest & Saison", Icon: Confetti },
  { key: "balloon", label: "Kinderfest", group: "Fest & Saison", Icon: Balloon },
  { key: "music", label: "Musik", group: "Fest & Saison", Icon: MusicNote },
  { key: "tent", label: "Zelt", group: "Fest & Saison", Icon: Tent },
  { key: "gift", label: "Geschenke", group: "Fest & Saison", Icon: Gift },
  { key: "crown", label: "Männertag", group: "Fest & Saison", Icon: Crown },
  { key: "ticket", label: "Marken", group: "Fest & Saison", Icon: Ticket },
  { key: "star", label: "Highlights", group: "Fest & Saison", Icon: Star },
  { key: "special", label: "Besonderes", group: "Fest & Saison", Icon: Sparkle },

  // --- Verkauf ---
  { key: "shop", label: "Verkauf", group: "Verkauf", Icon: ShoppingBag },
  { key: "stand", label: "Stand", group: "Verkauf", Icon: Storefront },
  { key: "basket", label: "Korb", group: "Verkauf", Icon: Basket },
  { key: "tag", label: "Angebot", group: "Verkauf", Icon: Tag },
  { key: "coins", label: "Pfand", group: "Verkauf", Icon: Coins },
  { key: "tipjar", label: "Trinkgeld", group: "Verkauf", Icon: TipJar },
  { key: "other", label: "Sonstiges", group: "Verkauf", Icon: Package },
];

const BY_KEY = new Map(CATEGORY_ICONS.map((c) => [c.key, c.Icon]));

/**
 * Notnagel fuer Kategorien, denen noch niemand ein Symbol gegeben hat.
 * Reihenfolge zaehlt: die erste passende Regel gewinnt. Umlaute stehen jeweils
 * auch in der ue/oe/ae-Schreibweise, weil Katalognamen oft so getippt werden.
 */
const RULES: [RegExp, string][] = [
  [/glüh|gluh|gluehwein|punsch|jagertee|jaegertee|feuerzangen/i, "mulled"],
  [/bier|beer|weizen|radler|helles|pils|kölsch|koelsch|alt\b/i, "beer"],
  [/wein|wine|federweiss|federweiß|riesling|schorle/i, "wine"],
  [/sekt|prosecco|champagner|crémant|cremant/i, "champagne"],
  [
    /kaffee|coffee|cappuccino|espresso|kakao|schoko.?getränk|warme.?getr|heiss?getr|heiß.?getr/i,
    "coffee",
  ],
  [/\btee\b|tea|früchtetee|fruechtetee/i, "tea"],
  [/suppe|eintopf|gulasch|soup/i, "soup"],
  [/spiritu|schnaps|likör|likor|obstler|brand|korn\b/i, "brandy"],
  [/cocktail|aperol|longdrink|bowle/i, "martini"],
  [
    /alkoholfrei|wasser|water|spezi|saft|limo|soft|cola|brause|apfelschorle/i,
    "water",
  ],
  [/eis\b|ice|softeis|sorbet/i, "icecream"],
  [
    /süß|suess|sues|sweet|dessert|kuchen|torte|waffel|crepe|crêpe|schoko|kaiserschmarrn|schmalzgebäck/i,
    "sweets",
  ],
  [/brot|brezel|breze|semmel|weck|laugen|backware/i, "bread"],
  [/wurst|bratwurst|grill|steak|fleisch|schnitzel|hax|gyros|döner|doener/i, "meat"],
  [/fisch|fish|lachs|forelle|backfisch|matjes/i, "fish"],
  [/käse|kaese|kase|spätzle|spaetzle|spatzle|raclette/i, "cheese"],
  [/vegan|vegetar|salat|gemüse|gemuese/i, "veggie"],
  [/nuss|nüsse|nuesse|mandel|gebrannte/i, "nut"],
  [/popcorn|chips|knabber|snack/i, "popcorn"],
  [/küche|kueche|kuche|essen|food|imbiss|pommes|herzhaft|warme.?speis/i, "food"],
  [/weihnacht|advent|christkindl|glühweinmeile/i, "tree"],
  [/winter|schnee|frost/i, "winter"],
  [/sommer|garten/i, "sun"],
  [/frühling|fruehling|ostern|mai\b/i, "flower"],
  [/herbst|kirmes|kerwe|erntedank/i, "leaf"],
  [/fasching|karneval|fastnacht|party/i, "confetti"],
  [/kinder/i, "balloon"],
  [/musik|konzert|band/i, "music"],
  [/männertag|maennertag|vatertag|herrentag/i, "crown"],
  [/pfand|leergut/i, "coins"],
  [/marke|gutschein|bon\b/i, "ticket"],
  [/trinkgeld/i, "tipjar"],
  [/verkauf|shop|laden|merch/i, "shop"],
  [/stand|bude|hütte|huette/i, "stand"],
];

export function iconKeyFor(category: { name: string; icon?: string }): string {
  if (category.icon && BY_KEY.has(category.icon)) return category.icon;
  // Alt-Bestand: das Symbol war frueher aus dem Namen geraten.
  const hay = `${category.name} ${category.icon ?? ""}`;
  for (const [re, key] of RULES) if (re.test(hay)) return key;
  return "other";
}

export function catIcon(category: { name: string; icon?: string }): Icon {
  return BY_KEY.get(iconKeyFor(category)) ?? Package;
}
