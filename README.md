# NagNest

> **Keep Learning, Keep Building** — part of the Nagdista brand family.

NagNest is a personal news dashboard that collects all the sites and Twitter accounts you
read into one place — with a Twitter-style feed of the latest headlines, a live scrolling
news ticker, categories, and one-click JSON backups.

Built with **React + TypeScript + TailwindCSS + react-router-dom + lucide-react**, styled
with the official **Nagdista Brand Identity** (Midnight Navy `#0f172a`, Egyptian Teal
`#0d9488`, Cairo Gold `#f59e0b`, Poppins / Inter / JetBrains Mono / Tajawal).

## Features

- **Dashboard** — save any news site or X/Twitter account link in one click; the favicon /
  profile picture and title are fetched automatically from the link. Search, category
  filters, pinning, visit counters, and notes. Press `N` anywhere to add quickly.
- **Feed** — a Twitter-style timeline (avatar, verified badge, relative time, likes/reposts/
  views, link preview cards, tweet images) pulling the latest 5 headlines from every saved
  source via RSS. Retweets are displayed like Twitter (original author + repost line), and
  English tweets can be translated to Arabic with one click.
- **News ticker** — a scrolling breaking-news bar at the bottom showing the latest headline
  from each site, refreshed automatically with caching.
- **Categories** — color-coded folders (AI News, Tech News, Newsletters, X / Twitter…) with
  rename / recolor / delete.
- **Backup** — export, import, or **merge** JSON backups; undo restore for deletions.

## Data & privacy

Everything lives in your browser's `localStorage` — no accounts, no servers, no tracking.
Headlines are fetched from each source's public RSS feed through `rss2json.com`; profile
pictures come from `unavatar.io`; translation uses the free MyMemory API.

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Brand

- **Identity**: [Nagdista Brand Identity](https://github.com/nagdista-dev) — Navy is the
  foundation (60%), Teal is identity (30%), Gold is the accent (10%).
- **Symbol**: `{N}` — Navy background, Gold brackets, Teal N.
- **Colors**: `#0f172a` · `#0d9488` · `#f59e0b` · `#f5ece4`
- **Fonts**: Poppins (headings) · Inter (body) · JetBrains Mono (code) · Tajawal (Arabic)
