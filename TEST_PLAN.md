# Test Plan – Hundefutter-Planer (PR #1)

**Target:** https://dist-gzkspxox.devinapps.com (production build of the PR head)
**Today:** 2026-04-22 (Wednesday / Mittwoch)

## What I will test

One primary end-to-end flow that exercises the main promised behaviour: **inputs → automatic calculation → weekly plan propagation → stock deduction → persistence**. If any of these are broken, the app is unusable.

---

## Test 1 — Automatic calculation from birthdate + weight

**Why this matters:** the core promise of the app. Every other feature (week plan, shopping list, stock) depends on `dailyAmounts()` in `src/lib/calc.ts:39-49` returning the right numbers.

**Steps:**
1. Open https://dist-gzkspxox.devinapps.com in a fresh Chrome profile (cleared localStorage).
2. In section **🐾 Eingabe**, set **Geburtsdatum** to `02.03.2026`.
3. Set **Aktuelles Gewicht** to `8`.
4. Leave **Futterart** at `🥣 Trockenfutter` (default).

**Expected in the right-hand "Berechnete Werte" table (exact values):**

| Feld | Expected value |
|---|---|
| Alter (Wochen) | `7.3` |
| Alter (Monate) | `1.7` |
| BARF-Anteil | `8%` |
| BARF-Menge / Tag | `640 g` |
| Trockenfutter / Tag | `213 g` |
| Mahlzeiten pro Tag | `4` |
| BARF pro Mahlzeit | `160 g` |
| Trockenfutter / Mahlzeit | `53 g` |

**Fail criteria:** any of the 8 values differs. (A broken age-to-phase function would show `2` or `3` meals instead of `4`; a broken % rule would show `7%` or `5%`; a broken TF ratio would show anything ≠ 213 g.)

---

## Test 2 — Week plan: today highlighted, BARF switch propagates

**Why this matters:** verifies `todayKey()` and week-plan-driven recomputation of the shopping list and BARF/TF day counters.

**Steps (continuing from Test 1):**
5. Scroll to **📅 Wochenplan**. Observe which row is highlighted.
6. In the row for **Mittwoch**, change the Futterart dropdown to `🥩 BARF`.
7. Scroll to footer of the Wochenplan table.
8. Scroll to **🛒 Einkaufsliste**.

**Expected:**
- The **Mittwoch** row is highlighted in green with label `◀ Heute` and no other day is highlighted.
- After switching Mittwoch → BARF:
  - Mittwoch row's *Tages-Menge* shows `640 g` (BARF value), not `212 g`.
  - Wochenplan footer: `Anzahl BARF-Tage: 1`, `Anzahl TF-Tage: 6`.
  - `Wochenmenge gesamt` = 640 + 6×212 = **`1.912 g`** (displayed as `1.912 g` with German thousand-dot).
  - Einkaufsliste row **Muskelfleisch (Rind/Huhn)** shows `320` (= 640 × 50 %).
  - Einkaufsliste row **Pansen / Blättermagen** shows `96` (= 640 × 15 %).
  - Einkaufsliste row **Trockenfutter (hochwertig)** shows `1.336` (= round(6 × 213 × 1.05) = 1342; acceptable ±2 due to rounding order — recording the actual value).

**Fail criteria:** heute-row is wrong day, BARF-Tage counter doesn't update, or Einkaufsliste still shows `–` for BARF rows (would mean reactivity is broken).

---

## Test 3 — "Heute gefüttert" deducts from stock + persistence

**Why this matters:** verifies stock mutation + the promise that "alle Daten werden lokal gespeichert".

**Steps (continuing from Test 2):**
9. Scroll to **📦 Trockenfutter-Vorrat**. Enter `5000` as *Aktueller Vorrat (g)*.
10. Note the button label — it should read `☑️ Heute gefüttert (−213 g)`.
11. Click the button.
12. Reload the page (Ctrl+R / F5).

**Expected:**
- After click: Vorrat input shows `4787` (= 5000 − 213), button becomes disabled and shows `✓ Heute gefüttert (−213 g)`, a small `↩︎` undo button appears next to it.
- "Reicht für ca. 22 Tage." appears below (floor(4787 / 213) = 22).
- After reload: birthdate `2026-03-02`, weight `8`, Vorrat `4787`, Mittwoch still BARF, button still disabled (lastFedDate preserved for today).

**Fail criteria:** Vorrat doesn't change, button still clickable, values reset to defaults after reload (=> localStorage broken).

---

## What I will NOT test (scope control)

- Supplements table (static data).
- Gewichtsentwicklung table (static data; only the "current row" highlight depends on birthDate which is already covered in Test 1's age calc).
- Custom shopping/appointment rows (editable text inputs — covered implicitly by reload-persistence test).
- Actual time-triggered notification firing at `07:00/12:00/…` (requires waiting; the `Test 🔔` button is verified only incidentally if granted).
- Mobile viewport separately — same code path, responsive CSS only. I'll take one mobile-width screenshot as regression evidence.

---

## Recording plan

Single continuous recording (~2 min):
1. Setup annotation: "Opening live preview"
2. `test_start`: "It should auto-calculate daily/per-meal amounts from birthdate + weight"
3. `assertion` passed/failed for Test 1
4. `test_start`: "It should propagate BARF switch to week totals + shopping list"
5. `assertion` passed/failed for Test 2
6. `test_start`: "It should deduct stock on 'Heute gefüttert' and persist across reload"
7. `assertion` passed/failed for Test 3
8. Take one 390-px-wide screenshot for mobile regression (labelled Regression).
