# DOMVIBES

Dom Coryell's personal brand site. Live at https://domvibes.ai (also aliased at
https://domvibes.vercel.app). Static HTML + a small Convex backend. No build
step, no framework. Keep it that way unless Dom says otherwise.

## Layout

- `site/` — the whole website, plain HTML/CSS/JS. Each page is a folder with
  an `index.html`. Deployed as-is to the Vercel project `domvibes`.
  - `/` — homepage with email capture
  - `/shopify-claude-code` — field guide from the Shopify x Claude Code event
  - `/recharge` — 10-slide stage deck for the Recharge x Shopify talk, with a
    live audience Q&A bar (posts to Convex) and a Claude-generated question
    summary on the last slide
- `backend/` — Convex backend (project `domvibes` on team `domco`, prod
  deployment `dazzling-squid-751`). Handles email capture (`/subscribe`),
  audience questions (`/question`, `/summary`), and forwards every new
  subscriber to Kit tagged `domvibes`.
- `brand/` — logos and OG banners.
- `recharge-strategy/` — subscription-conversion strategy page for the
  Recharge Demo Coffee sandbox store (the 10% → 15% playbook shown alongside
  the Recharge talk). Deploys to its own Vercel project
  `recharge-demo-strategy` (same team), live at
  https://recharge-demo-strategy.vercel.app — NOT part of `site/`, so it
  never lands on domvibes.ai. Deploy: `cd recharge-strategy && vercel deploy
  --prod --yes` (folder must be linked to project `recharge-demo-strategy`).
- `recharge-workshop/` — "The 61% Workshop" hands-on demo page for the
  Recharge × Shopify AI Toolkit session. Currently run locally / deployed
  ad-hoc; also not part of `site/`.

## Workflow (important)

- Branch, then PR. Never commit straight to main. Ask Dom before merging
  anything big. Main is treated as prod.
- Merging does NOT deploy. Deploys are manual, from an authorized machine:
  - site: `cd site && vercel deploy --prod --yes` (the folder must already be
    linked to Vercel project `domvibes` — check `.vercel/project.json` says
    `"projectName":"domvibes"` first; deploying unlinked creates a junk
    project)
  - backend: `cd backend && npx convex deploy`
  If your machine isn't authed for Vercel/Convex, just push the PR and Dom
  deploys.
- This repo is public. Never commit secrets, .env files, API keys, or
  subscriber/customer data. Server secrets live as Convex env vars
  (`ANTHROPIC_API_KEY`, `KIT_API_KEY`) — set with
  `npx convex env set NAME value --prod`, never in code.
- Ask Dom before touching prod data (subscribers, questions tables) or
  anything that emails/texts real people.

## Backend notes

- Read `backend/convex/http.ts` before adding endpoints — follow the existing
  httpAction + CORS pattern. New frontend origins must be added to
  `ALLOWED_ORIGINS` there.
- `npx convex run questions:clear --prod` wipes audience questions (Dom runs
  this before going on stage).
- `npx convex run kit:backfill --prod` pushes all existing subscribers to Kit.

## Brand style

90s retro Memphis. Hot pink `#F52B8E` field, chunky white Titan One display
type with thick black (`#12000B`) outline, teal `#2EE6C8` drop shadows, yellow
`#FFE81A` / purple `#9B5DE5` / orange `#FF9F1C` squiggles, zigzags, triangles,
starbursts. Fonts: Titan One, Bungee, Space Grotesk, IBM Plex Mono for
terminals. Copy the CSS variables and patterns from an existing page when
building a new one.

## Voice

Scrappy-executive. Plain text, short sentences, no fluff, no em-dashes.
Lowercase starts are fine. Cursing is fine. Write like Dom talks.
