# 🐕 Hundefutter-Planer

Eine responsive Web-App (PC & Handy) für die Futterplanung deines Hundes. Inspiriert von der Schäferhund-Welpe-BARF/TF-Tabelle.

## Features

- **Eingabe & automatische Berechnung** – Geburtsdatum, Gewicht, Futterart → BARF/TF-Menge pro Tag & Mahlzeit
- **Trockenfutter-Vorrat** – mit 1-Klick "Heute gefüttert"-Button, der den Vorrat automatisch reduziert
- **Fütterungs-Erinnerungen** – Browser-Notifications zu frei einstellbaren Uhrzeiten (Morgens/Mittags/Nachmittags/Abends)
- **Wochenplan** – pro Tag wählbare Futterart (BARF oder Trockenfutter), Wochenmenge, aktueller Tag hervorgehoben
- **Empfohlene Zusätze** – Lachsöl, Seealgen, Eierschalen, Bierhefe, Lebertran
- **Einkaufsliste** – automatisch aus Wochenplan berechnet, inkl. eigener Einträge & Erledigt-Häkchen
- **Gewichtsentwicklung** – Richtwerte für Deutscher Schäferhund Hündin (8-78 Wochen)
- **Termine & Impfungen** – vorgefüllte Impf-/Entwurmungs-Timeline mit Status-Dropdown + eigene Termine
- **Offline-fähig** – alle Daten im localStorage, als PWA auf dem Handy installierbar

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4

## Entwicklung

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Produktions-Build
npm run lint
npm run preview
```

## Deployment

Reine Static-Site — funktioniert auf jeder Static-Hosting-Plattform (Vercel, Netlify, Cloudflare Pages, GitHub Pages, devinapps.com, …).

```bash
npm run build
# dist/ hochladen
```

## PWA

Die App enthält ein `manifest.webmanifest` + Icons und ist auf dem Handy über "Zum Home-Bildschirm hinzufügen" installierbar.

## Datenschutz

Alle Eingaben (Gewicht, Vorrat, Termine, eigene Einträge etc.) werden ausschließlich lokal im Browser (localStorage) gespeichert. Es gibt keinen Server, kein Tracking, keine Cloud.
