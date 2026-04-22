# Testing the Hundefutter-Planer

Single-page React+Vite app, no backend. All state in `localStorage`.

## How to run it

- Live preview (built PR head): check the PR description for the `devinapps.com` URL.
- Local dev: `pnpm install && pnpm dev` in the repo root (port 5173).
- Everything persists in `localStorage` under the `hundefutter.*` keys. **Clear it between runs** (DevTools → Application → Local Storage → clear, or open in an incognito profile) otherwise prior test data will bias the next run.

## Core arithmetic (for asserting)

Age phase → feeding rule (see `src/lib/calc.ts`):

| Age (months) | Phase | BARF % | Meals/day |
|---|---|---|---|
| < 4 | Welpe <4M | 8 % | 4 |
| 4 – <6 | Welpe 4-6M | 7 % | 3 |
| 6 – <12 | Jungh. 6-12M | 5 % | 2 |
| ≥ 12 | Erwachsen | 2.5 % | 2 |

Formulas:

- `barfGPerDay = round(weightKg * 1000 * barfPct)`
- `tfGPerDay = round(barfGPerDay * (1/3))`
- `weekTotal = sum over days of (BARF ? barfGPerDay : tfGPerDay)`
- Shopping list BARF splits (of `barfGPerDay × #BARF-days`): Muskelfleisch 50 %, Pansen 15 %, Knochen 15 %, Innereien 10 %, Gemüse 10 %.
- Shopping list TF row: `round(tfGPerDay × #TF-days × 1.05)` (5 % safety margin).
- Stock “Reicht für ca. X Tage” is `floor(Vorrat / tfGPerDay)`.

## Canonical fixture

Use this for golden-path checks — every number in the app is known:

- Geburtsdatum: `2026-03-02`
- Gewicht: `8 kg`
- Test date: **Mittwoch** (app marks today automatically — pick a Wednesday or switch BARF on a different day to match the actual wall-clock day)

Expected:

| Field | Value |
|---|---|
| Alter (Wochen) | 7.3 |
| Alter (Monate) | 1.7 |
| BARF % | 8 % |
| BARF / Tag | 640 g |
| TF / Tag | 213 g |
| Mahlzeiten | 4 |
| BARF / Mahlzeit | 160 g |
| TF / Mahlzeit | 53 g |

With Mittwoch = BARF, rest = TF:

- Wochenmenge gesamt: `640 + 6 × 213 = 1.918 g`
- Einkaufsliste: Muskelfleisch 320, Pansen 96, Knochen 96, Innereien 64, Gemüse 64, Trockenfutter 1.342.

`Vorrat = 5000` → click **Heute gefüttert** → Vorrat becomes `4787`, button disabled, `↩︎` undo appears, “Reicht für ca. 22 Tage”.

## Recording / interaction gotchas

- The weekday “Heute” marker depends on the real wall-clock day. If today ≠ Mittwoch, swap the assertion to whatever day is highlighted.
- Native `<select>` dropdowns are controlled React inputs. Clicking the select reliably opens the menu; programmatic `el.value = …; el.dispatchEvent(new Event('change',{bubbles:true}))` also works, but prefer native clicks for the recording.
- Date `<input type="date">` parses `MM/DD/YYYY` on en-US Chrome. Typing `03/02/2026` yields the German `02.03.2026` correctly — do NOT type `02/03/2026`.
- Reload test must be a real navigation reload (F5 / Ctrl+R), not just setState reset. That actually exercises the localStorage rehydration path.

## Regression-lite for responsive

Resize the Chrome window to ~440 px wide (via `xdotool windowsize $WID 440 900`) and screenshot the page top. Wide tables (Wochenplan, Einkaufsliste, Gewichtsentwicklung, Termine) must be horizontally scrollable rather than cut off.

## Out of scope by default

- Real time-based notifications — the browser permission prompt needs user interaction and the schedules fire at wall-clock times. Skip unless explicitly asked.
- Inhaltliche Prüfung der statischen Tabellen (Supplements, Gewichtsentwicklung, Termin-Defaults). These are static data and cheap to eyeball in a screenshot.

## Devin Secrets Needed

None — app is 100 % client-side, no external APIs.
