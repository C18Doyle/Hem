// Instant, rule-based "goes with", grouped by role (same rules as versatility)
import { compatible } from "./versatility.js";
export const ROLES = [
  ["Tops", ["Tops", "Shirts", "Knitwear"]], ["Bottoms", ["Trousers", "Denim", "Skirts"]], ["Dresses", ["Dresses"]],
  ["Layers", ["Outerwear", "Tailoring", "Knitwear"]], ["Shoes", ["Shoes"]], ["Accessories", ["Bags", "Accessories"]],
];
export function goesWith(anchor, items) {
  const pool = items.filter(i => !i.retired && i.id !== anchor.id && compatible(anchor, i));
  return ROLES.map(([label, cats]) => [label, pool.filter(i => cats.includes(i.category) && i.category !== anchor.category)])
    .filter(([label, list]) => list.length && !(label === "Layers" && ["Outerwear", "Tailoring"].includes(anchor.category)));
}
