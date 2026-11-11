# Hem

A personal wardrobe tool: quality and sustainability scoring, cost per wear, a wear calendar, a stats dashboard, outfits that learn your taste, a daily suggestion, suggestions for what to add next, live prices, a pre-purchase check, wishlist price alerts, a care and repair log, and a fashion reading feed.

Stack: Vite + React, Supabase (auth, Postgres, storage), Vercel (static site, serverless functions, cron), Claude API.

## Set up

1. **Supabase.** Create a new project. In the SQL editor, run `supabase/schema.sql`. (If you ran an earlier version, run the files in `supabase/migrations/` that you haven't run yet, in order. Recent releases add `005_ops.sql`, `006_cost_new.sql` and `007_batches.sql`.) Under Authentication > URL Configuration, set the Site URL to your Vercel domain (and add `http://localhost:3000` for local work).
2. **Anthropic.** Create an API key in the Claude Console. Web search must be enabled for your organisation in the Console, or price search will fail.
3. **SerpAPI (optional).** Add `SERPAPI_KEY` for Google Shopping UK results. Prices are more reliable than web search, but it's a paid service. Without it, Hem falls back to Claude's web search.
4. **Vercel.** Import the repo, add every variable from `.env.example` in Project Settings > Environment Variables, then deploy. Vercel sends `CRON_SECRET` to the cron route automatically.
5. **Local.** `npm install`, copy `.env.example` to `.env`, then `npx vercel dev` (this runs the `/api` functions; `vite` alone does not).

## Where things live

All `/api/<name>` endpoints run in one serverless function, `api/[route].js`, which dispatches to `api/_routes/<name>.js`. Vercel's Hobby plan allows at most 12 functions, and this keeps the total at two (plus the daily job). Below, `api/<name>.js` means `api/_routes/<name>.js`.


| Feature | Front end | API |
|---|---|---|
| Structured tags from a photo | `components/AddItem.jsx`, `ItemForm.jsx` | `api/tag.js` |
| Cost per wear, condition check-ins | `pages/Item.jsx` | (database only) |
| Live prices | `pages/Shop.jsx` (Find it for less) | `api/search.js`, `api/_lib/prices.js` |
| Outfits that learn | `pages/Style.jsx`, `components/Outfit.jsx` | `api/outfits.js` |
| Before you buy | `pages/Shop.jsx` | `api/precheck.js` |
| Background removal | `lib/image.js` (in the browser) | none |
| Outfit of the day | `pages/Today.jsx` (Open-Meteo weather, no key) | `api/today.js` |
| Wishlist price alerts | `pages/Shop.jsx` | `api/cron/prices.js` (daily, 07:00 UTC), `api/wishlist-check.js` |
| Care and repair log | `pages/Item.jsx`, reminders on Today | (database only) |
| Quality and sustainability scores | `pages/Quality.jsx`, `lib/quality.js` | `api/quality.js` |
| Calendar (log, plan, copy and paste days) | `pages/Calendar.jsx` | (database only) |
| Dashboard | `pages/Dashboard.jsx` | (database only) |
| New or secondhand tag | `components/ItemForm.jsx` | (database only) |
| Light and dark mode, top menu | `components/Menu.jsx`, `lib/theme.js` | none |
| Industry news (shopping filtered out) | `pages/News.jsx` | `api/news.js`, sources and filter in `api/_lib/feeds.js` |
| Wardrobe gaps (evidence only) | `pages/Suggest.jsx` | `api/suggest.js` |
| Brand directory, profiles and ratings | `pages/Brands.jsx`, built-in profiles in `src/lib/brands.js` | `api/brand.js` (ratings only) |
| Fit and measurements, listing fit check | `pages/Fit.jsx`, `components/FitSection.jsx`, Before you buy in `pages/Shop.jsx`, `lib/fit.js` | (calculated in the browser) |
| Versatility score | Item page, wardrobe sort, dashboard, `lib/versatility.js` | (calculated in the browser) |
| Alteration rescue | `pages/Rescue.jsx` | `api/rescue.js` |
| What goes with this (owned or new piece) | `components/GoesWith.jsx`, `pages/Pair.jsx`, `lib/pairs.js` | `api/pairings.js` (stylist reasons only) |
| Batch entry (many photos, or one photo of several pieces) | `pages/AddBatch.jsx` | `api/tag.js`, `api/detect.js` |
| Automatic gap flags | `lib/gaps.js`, `components/Flags.jsx` (Today, Dashboard, Gaps) | none, rule-based |
| AI spend tracking and monthly cap | `pages/Settings.jsx` | metered in `api/_lib/claude.js` and `api/_lib/http.js` |
| Error logging | `lib/errors.js`, `components/ErrorBoundary.jsx`, Settings, Errors | logged in `api/_lib/http.js` |
| Export and restore | `lib/backup.js`, Settings, Backup | none |
| Price history and email alerts | `pages/Shop.jsx` (Wishlist) | `api/_lib/alerts.js` |
| Calendar day tags | `pages/Calendar.jsx` (feeds Today) | none |
| Installable app | `public/manifest.webmanifest`, `public/sw.js`, icons | none |
| Cost new against bought for | `components/ItemForm.jsx`, item page, wardrobe, dashboard, review, `saving()` in `lib/quality.js` | `api/rrp.js` (estimate only) |
| Condition tags (resale grading) | `lib/condition.js`, wardrobe cards, filters and sort, item page, add and batch, dashboard | none |
| Year in review | `pages/Review.jsx` | `api/review.js` (editor's letter only) |
| Technical vocabulary | (all Claude output) | `TERMS` in `api/_lib/style.js` |

## How the quality score works

Claude scores five dimensions from 1 to 10: fibre, fabric, construction, finishing and value. Each one is flagged as *observed* (backed by a photo, the label or your inspection answers) or *estimated*. The overall score is then calculated in `lib/quality.js`, not by Claude, using these weights: construction 30%, fabric 25%, fibre 20%, finishing 15%, value 10%.

Confidence comes from three things: how much of the score was observed, how many of the 12 inspection checks you answered, and how many of the three photo types you supplied (label, whole garment, inside seam).

After five or more wears, condition check-ins are compared with the wear curve the assessment predicted. The result is a revised lifespan based on how the garment is actually holding up.

## Sustainability score

This is kept separate from quality, because a well-made garment can still have a high impact. It's made up of six parts:

- **Durability (25%).** Computed from the expected lifetime wears.
- **Materials (20%).** Judged by Claude.
- **Acquisition (15%).** Computed: secondhand and vintage score highest.
- **End of life (12%).** Judged by Claude: whether it can be recycled or repaired.
- **Care impact (8%).** Judged by Claude.
- **Maker (20%).** From the brand rating, when the brand has been researched.

It's a relative score, where 5 is a typical high-street garment. It deliberately gives no carbon or water figures, because labels don't disclose supply-chain data and any number would be invented.

## Brand ratings

The directory in `src/lib/brands.js` holds 69 built-in profiles (written November 2026): country, founding, founders, tier, aesthetic, strengths and similar labels. It also maps alternative spellings, so "Totême", "toteme" and "TOTEME" count as one brand. Add brands by appending to the list. Profiles never include sustainability scores. When a directory brand is researched, its profile is passed to Claude and the search limit drops from 6 to 4.

Each brand is researched with web search. It's scored on five areas: transparency, labour, climate, materials and business model. Rules that keep it honest:

- **Sources must be real.** A source only counts if the search actually returned it. Unverified sources, ratings and controversies are shown but not scored.
- **Silence isn't neutral.** An area with no verifiable evidence scores 3 out of 10.
- **Controversies cost points.** Verified controversies from the last three years deduct 0.5 each, up to 2.
- **Results are cached for 180 days.** Each rating costs up to 10 searches.

The maker rating then feeds each garment's sustainability score at 20%. For secondhand pieces it counts for less, because buying used doesn't fund the maker.

## Fit check

A listing's measurements are compared with a piece you own marked "Fits well" in the same group (tops, bottoms or shoes). If you haven't marked one, they're compared with your body measurements plus standard ease, which is less reliable.

Each difference is rated as matches, slight or off, using tolerances set in `lib/fit.js`. Shoulders and rise can't be altered. For everything else, the check names the alteration needed and a typical UK cost.

## Versatility

This counts the plausible outfits each piece makes: top with bottom (or a dress), plus shoes if you own any. Layers and accessories are counted against those base outfits. Two pieces are treated as compatible when:

- their formality is within one step,
- they share a season, and
- at least one is a neutral colour, or both are the same colour.

It's set beside real pairings from your wear log. The rules are deliberately simple and live in `lib/versatility.js`, so you can tune them.

## Calendar rules

Past days, and today once marked worn, write real wears. Those count towards cost per wear and the dashboard. Future days are plans and count for nothing until you mark them worn. Pasting onto a day replaces whatever was on it.

## Cost control

Every Claude call records its tokens and web searches in `api_usage`, priced using the `PRICE_*` variables. Check these against current Claude pricing.

When this month's total reaches your cap (£10 by default, editable in Settings), AI features return a clear "budget used up" message until the 1st of the month. The daily price check skips anyone who is over budget. Efficiency measures:

- **Cheaper model for light tasks.** Tagging, search planning, the daily outfit, "Goes with", cost-new estimates and the year-in-review letter use `ANTHROPIC_FAST_MODEL`. Quality, batch detection, outfits, gaps, rescue, "Before you buy" and brand research use the main model.
- **Shorter prompts.** Pieces appear in prompts with short ids (p1, p2…) instead of UUIDs.
- **Smaller images.** Photos are downscaled before they're sent to Claude: 768 px for tagging, 900 px for most features, and 1200 px for label and seam photos, where detail matters.
- **One search call instead of four.** Without SerpAPI, a price search is a single Claude call with at most 5 web searches. Each wishlist check allows at most 3, and brand research at most 6.
- **Less frequent wishlist checks.** Without SerpAPI, each wishlist item is re-priced every 3 days instead of daily (set with `WISHLIST_CHECK_HOURS`).
- **Precise mode only where it's stored.** It's on by default only for pieces you own, and can be toggled.
- **Overnight batches at half price.** Without SerpAPI, the background wishlist checks go through the Message Batches API automatically, which charges half for tokens (the search fee is unchanged). Jobs are submitted at 07:00 and collected at 09:00. Everything you trigger yourself, including brand research, runs immediately.
- **Back-off for stable prices.** An item whose price hasn't changed in 3 checks is checked half as often, and after 5 checks a quarter as often, up to every 14 days.
- **Per-feature model override.** `FAST_ENDPOINTS=outfits,precheck` moves those features to the cheaper model, if you find its results good enough.
- **Results are reused.** Today's outfit for the day, price searches for 6 hours, brand ratings for 6 months, and "Goes with" until your wardrobe changes.

## Quality score consistency

Each dimension has fixed descriptions of what each score level looks like, and assessments run at temperature 0 (the setting that makes the model's answers as repeatable as possible).

Precise mode is on by default. It runs two assessments in parallel, plus a third if any dimension differs by more than 1.5, and takes the median of each sub-score. The result shows how many runs were used and how far apart they were. If even three runs disagree widely, confidence is lowered.

## Price alerts

Each check records the price in `price_history`. An alert fires when the price is at or below your target, or has dropped by your chosen percentage (15% by default) from the first price seen. An email is sent once per new low price, through Resend, if `RESEND_API_KEY` and `ALERT_FROM` are set. Resend only delivers to other addresses once your sending domain is verified; until then, it only sends to your own account email.

## Installing it on your phone

- **iPhone (Safari):** tap Share, then Add to Home Screen.
- **Android (Chrome):** use the install prompt or the menu.

Android also gets home-screen shortcuts, and can share screenshots or links into "Before you buy". iPhone doesn't support sharing into a web app.

## Things to know

- **News feed URLs.** Sources live in `api/_lib/feeds.js` and weren't verified from this environment. The app lists any feed that fails to load, so you can fix or replace it.

- **API cost.** Every tag, assessment, outfit and search is a paid Claude call. Price search makes four calls per search. The daily cron checks at most 25 wishlist items per run (`MAX_PER_RUN`).
- **Function timeouts.** `vercel.json` gives the cron 300 s. If your plan rejects that at deploy, lower it to 60 and reduce `MAX_PER_RUN`.
- **Background removal licence.** `@imgly/background-removal` is AGPL-3.0. That's fine for a personal tool, but it matters if you ever make the code closed-source or commercial. The first use downloads a model of roughly 40 MB, which is then cached.
- **Price alerts are in-app only.** To get emails, add a provider such as Resend in `api/cron/prices.js`.
- **Weather locations.** Edit the list of cities in `pages/Today.jsx`.
