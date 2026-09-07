import {
  BeerStein,
  Coffee,
  Cookie,
  Drop,
  ForkKnife,
  IceCream,
  Martini,
  Wine,
  type Icon,
} from "@phosphor-icons/react";

const RULES: [RegExp, Icon][] = [
  [/bier|beer|weizen|radler|helles/i, BeerStein],
  [/wein|wine|sekt|prosecco|aperol/i, Wine],
  [/glüh|gluh|warm|kaffee|coffee|tee|punsch|jager/i, Coffee],
  [/spiritu|schnaps|cocktail|likör|likor/i, Martini],
  [/alkoholfrei|wasser|water|spezi|saft|limo|soft|cola/i, Drop],
  [/küche|kuche|essen|food|wurst|pommes|schnitzel|spätzle|spatzle|brezel/i, ForkKnife],
  [/eis|ice/i, IceCream],
  [/süß|sus|sweet|dessert|kuchen|waffel|schoko|kaiserschmarrn/i, Cookie],
];

export function catIcon(category: { name: string; icon?: string }): Icon {
  const hay = `${category.name} ${category.icon ?? ""}`;
  for (const [re, Comp] of RULES) if (re.test(hay)) return Comp;
  return ForkKnife;
}
