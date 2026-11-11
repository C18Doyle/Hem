// #5 Industry news only: trade press on business, supply chain, regulation and sustainability.
// Consumer and shopping titles are deliberately left out. Edit freely: any RSS or Atom feed works.
// Feeds that fail are skipped and listed in the app.
export const FEEDS = [
  { name: "WWD", url: "https://wwd.com/feed/", tag: "Business" },
  { name: "FashionUnited", url: "https://fashionunited.uk/rss-news", tag: "Business" },
  { name: "Retail Gazette", url: "https://www.retailgazette.co.uk/feed/", tag: "Retail" },
  { name: "Sourcing Journal", url: "https://sourcingjournal.com/feed/", tag: "Supply chain" },
  { name: "Just Style", url: "https://www.just-style.com/feed/", tag: "Supply chain" },
  { name: "The Fashion Law", url: "https://www.thefashionlaw.com/feed/", tag: "Law and regulation" },
  { name: "Ecotextile News", url: "https://www.ecotextile.com/feed", tag: "Sustainability" },
  { name: "The Guardian, fashion industry", url: "https://www.theguardian.com/business/fashion-industry/rss", tag: "Business" },
];

// Anything that reads like a shopping piece is dropped, even from trade sources.
export const SHOPPING = /\b(best\s+\w+(\s+\w+)?\s+(to buy|for (men|women|him|her))|shop (the|our|now)|gift guide|deals?\b|on sale|sale picks|under £\d+|we tried|editor'?s picks|buy now|discount code|black friday|cyber monday|wishlist|must-haves?)\b/i;
