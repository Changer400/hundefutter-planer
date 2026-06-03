---
name: testing-hundefutter-planer
description: End-to-end testing procedure for the Hundefutter-Planer (dog food planner) app. Use when verifying UI features like meal planning, food stock management, or weekly plan calculations.
---

# Testing Hundefutter-Planer

## Local Dev Setup

1. Install dependencies:
   ```bash
   cd /home/ubuntu/repos/hundefutter-planer
   npm install
   ```

2. Initialize local D1 database (required before first run):
   ```bash
   npx wrangler d1 migrations apply hundefutter-planer --local
   ```
   This applies all migrations in `migrations/` (0001_init.sql, 0002_push.sql, 0003_push_fired_time.sql).

3. Start local dev server:
   ```bash
   npx wrangler pages dev dist --d1=DB=hundefutter-planer --port 8788
   ```
   Note: You may need to run `npm run build` first to generate the `dist/` directory.

4. App runs at `http://localhost:8788`

## Test Account

Register a test account via the UI at `/` — click "Registrieren", enter username/password. The app uses a simple username/password auth stored in D1.

Suggested test credentials: `testuser` / `testpass123`

## Key Test Scenarios

### Meals-per-Day Dropdown
- Located in "Eingabe" section as "Mahlzeiten pro Tag" dropdown
- Options: Automatisch (age-based), 1x-5x pro Tag
- Verify: "Berechnete Werte" table updates Mahlzeiten pro Tag, BARF/Mahlzeit, TF/Mahlzeit
- Verify: WeekPlan table columns dynamically show/hide based on selection
- Verify: Reminders section shows only relevant meal time cards
- Math check: TF/Tag divided by mealsPerDay = TF/Mahlzeit (e.g., 213g / 2 = ~107g)

### Meal Column Mapping (from `visibleMeals()` in calc.ts)
- 1x → [Morgens]
- 2x → [Morgens, Abends]
- 3x → [Morgens, Mittags, Abends]
- 4x/Auto → [Morgens, Mittags, Nachmittags, Abends]
- 5x → [Morgens, Mittags, Nachmittags, Abends] (same as 4)

### Save Button + Confirmation Banner (Futter-Vorrat)
- Click "Futter hinzufuegen" to open the add-food form
- "Speichern" button should be disabled when Name or Menge is empty
- After filling Name + Menge and clicking Speichern:
  - Green confirmation banner appears: `„{name}" wurde gespeichert!`
  - Banner auto-dismisses after 3 seconds
  - Entry appears in the stock list with amount, unit, and category
  - Stock summary shows total amount and estimated days remaining

### Calculation Baseline (8kg puppy, no birth date)
- BARF rate: 8% of 8kg = 640g/day
- TF rate: 640g / 3 = ~213g/day
- At 4 meals: 213/4 = ~53g/meal
- At 2 meals: 213/2 = ~107g/meal
- At 1 meal: 213/1 = 213g/meal

## Deployment

The app is deployed on Cloudflare Pages at https://hundefutter-planer.pages.dev

To deploy:
```bash
npm run build
npx wrangler pages deploy dist --project-name=hundefutter-planer --branch=main
```

## Devin Secrets Needed

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages + D1 + Workers Scripts permissions. Required for deploying to production.

## Common Issues

- **500 error on registration/login**: D1 database not initialized. Run `npx wrangler d1 migrations apply hundefutter-planer --local`.
- **Stale UI after deploy**: Hard refresh (Ctrl+Shift+R) or clear browser cache.
- **Speichern button not visible**: Make sure you clicked "Futter hinzufuegen" first — the form opens inline with the button at the bottom.
