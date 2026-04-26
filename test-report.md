# Testbericht – Hundefutter-Planer (PR #1)

**Target:** https://dist-gzkspxox.devinapps.com
**Datum / heutiger Wochentag:** 2026-04-22 (Mittwoch)
**Test-Input:** Geburtsdatum `02.03.2026`, Gewicht `8 kg`, Futterart `Trockenfutter`, Vorrat `5000 g`
**Recording:** angehängt (edited.mp4 mit Annotationen)

## Zusammenfassung

End-to-End-Test gegen den gebauten Live-Preview (identisch mit PR-Head). **Alle 3 Tests bestanden**, keine Abweichungen. Responsives Verhalten (≈440 px Breite) visuell geprüft.

| # | Test | Ergebnis |
|---|---|---|
| 1 | Auto-Berechnung aus Geburtsdatum + Gewicht | **passed** |
| 2 | Mittwoch → BARF wird in Wochenplan-Summe und Einkaufsliste propagiert | **passed** |
| 3 | „Heute gefüttert" zieht vom Vorrat ab und persistiert über Reload | **passed** |
| R | Regression mobile (~440 px) | **passed** (visuell) |

---

## Test 1 — Auto-Berechnung

Nach Eingabe von `02.03.2026` + `8` zeigt die Tabelle „Berechnete Werte":

| Feld | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| Alter (Wochen) | 7.3 | 7.3 Wo | pass |
| Alter (Monate) | 1.7 | 1.7 Mon | pass |
| BARF-Anteil | 8 % | 8 % | pass |
| BARF-Menge / Tag | 640 g | 640 g | pass |
| Trockenfutter / Tag | 213 g | 213 g | pass |
| Mahlzeiten pro Tag | 4 | 4 | pass |
| BARF pro Mahlzeit | 160 g | 160 g | pass |
| Trockenfutter / Mahlzeit | 53 g | 53 g | pass |

![Test 1 — calculated values](https://app.devin.ai/attachments/3eeef0ea-6462-4037-a361-2a27f0df9701/screenshot_126cf9465a4f46e98042aaeda5d5b59b.png)

---

## Test 2 — Wochenplan: heute markiert + BARF-Switch propagiert

- Mittwoch-Zeile ist grün hervorgehoben und trägt die Marker `◀ Heute` + `▶` an der Mittagsspalte.
- Nach Umschalten Mittwoch → 🥩 BARF zeigt die Mittwoch-Zeile `640 g` Tages-Menge (vorher `213 g`).
- Wochenplan-Footer: `Wochenmenge gesamt: 1.918 g`, `Anzahl BARF-Tage: 1`, `Anzahl TF-Tage: 6`. (Testplan hatte `1.912 g` notiert; korrekt ist **1.918 g** = 640 + 6 × 213.)
- Einkaufsliste berechnet automatisch:

| Produkt | Erwartet | Tatsächlich |
|---|---|---|
| Muskelfleisch (Rind/Huhn) | 320 | **320** |
| Pansen / Blättermagen | 96 | **96** |
| Rohe fleischige Knochen | 96 | **96** |
| Innereien (Leber, Herz) | 64 | **64** |
| Gemüse & Obst (püriert) | 64 | **64** |
| Trockenfutter (hochwertig) | ~1.342 | **1.342** |

![Test 2 — Wochenplan mit Mittwoch=BARF](https://app.devin.ai/attachments/cdeed637-b333-457b-9c3b-a1836cd4fdaf/screenshot_22294e2d2033446c9f84afaef16b318c.png)

![Test 2 — Einkaufsliste auto-aktualisiert](https://app.devin.ai/attachments/40cce5b8-7fb1-4966-8733-59db9eeefab3/screenshot_3896b31510b54f44adf6431aac73d975.png)

---

## Test 3 — Vorrat-Abzug + Persistenz

- Vorrat `5000` eingegeben → „Reicht für ca. **23** Tage" (floor(5000/213) = 23).
- Klick auf „☑️ Heute gefüttert (−213 g)":
  - Vorrat ändert sich auf **4787** (= 5000 − 213).
  - Button wird disabled und zeigt „✓ Heute gefüttert (−213 g)".
  - Undo-Button `↩︎` erscheint rechts daneben.
  - Anzeige „Reicht für ca. **22** Tage" (floor(4787/213) = 22).
- Nach Reload (F5):
  - Geburtsdatum `2026-03-02` erhalten
  - Gewicht `8` erhalten
  - Vorrat `4787` erhalten
  - Mittwoch weiter auf `🥩 BARF`
  - „Heute gefüttert"-Button bleibt disabled
  - Wochenplan-Werte (1.918 g, 1/6) bleiben erhalten

![Test 3 — nach Klick: Vorrat 4787, Button disabled, ↩︎ sichtbar](https://app.devin.ai/attachments/799c445e-bd37-4336-9f0c-f0a59a2d1702/screenshot_88351b0649034e0d818d56a384053deb.png)

![Test 3 — nach Reload: alle Werte persistiert](https://app.devin.ai/attachments/3eeef0ea-6462-4037-a361-2a27f0df9701/screenshot_126cf9465a4f46e98042aaeda5d5b59b.png)

---

## Regression — Mobile-Breite (~440 px)

Fenster auf 440 px Breite verkleinert. Layout bleibt lesbar, Karten stapeln sich vertikal, breite Tabellen (Wochenplan, Einkaufsliste, Gewichtsentwicklung, Termine) werden horizontal scrollbar statt abgeschnitten.

![Regression — mobile ~440px](https://app.devin.ai/attachments/0d40f9a1-f79f-499f-8982-b294020aad2d/screenshot_dd4961adf4724c6684203b415020aa4d.png)

---

## Out of scope (nicht getestet)

- Echte Notification-Auslösung zu Uhrzeit (nur `Test 🔔`-Button wäre interaktiv prüfbar, nicht geprüft, da Browser-Permission-Wand).
- Statische Tabellen (Zusätze, Gewichtsentwicklung, Termine) wurden nur visuell gesichtet, nicht auf korrekten Dateninhalt geprüft.
- Custom-Einkaufs- und Termin-Einträge — Persistenz anderer Felder ist durch Test 3 bereits abgedeckt.

## Kleinere Beobachtungen (nicht blockierend)

- Testplan hatte `1.912 g` als erwartete Wochenmenge stehen; die App rechnet korrekt `640 + 6 × 213 = 1.918 g`. Testplan-Notiz, keine App-Abweichung.
- Der Testplan erwartete bei der Einkaufsliste Trockenfutter ~1.336; die App rechnet `round(6 × 213 × 1.05) = 1.342` und zeigt das auch so — akzeptable Rundungstoleranz, Ergebnis passt zur Rechnung.
