# Parrylicious Studio – Demo Website (GitHub Pages)

Diese Demo ist ein **statischer Prototype** (HTML/CSS/JS).  
Login/Buchung/Zahlung sind hier **simuliert** (LocalStorage), damit du sofort eine schöne, verkaufbare Demo hast.

## Features (Demo)
- Luxury Look (hellbraun/edel) + Logo
- Leistungen & Preise (ab) als Cards
- Buchungs-Wizard: Service → Stylist (optional) → Kalender/Slots → Daten → (Demo) Anzahlung
- Warteliste (Demo)
- Mitarbeiter-Dashboard (Demo): Bestätigen/Stornieren, CSV Export

## Deploy auf GitHub Pages
1. Neues GitHub-Repo erstellen (z. B. `parrylicious-demo`)
2. Dateien hochladen (alles aus diesem ZIP)
3. GitHub → **Settings** → **Pages**
4. **Source**: Deploy from a branch
5. Branch: `main` und Folder: `/root`
6. Speichern → GitHub gibt dir die URL.

## Wichtige Hinweise (Live Version)
Für echten Betrieb brauchst du ein Backend:
- Auth: Supabase (E‑Mail/Passwort + Google + Apple)
- DB: Postgres (Supabase)
- Payments: Stripe (Anzahlung, Belege)
- SMS: Twilio (oder Alternative)
- E‑Mail: Resend / Sendgrid
- Hosting: Vercel (aus GitHub) – Marketing kann trotzdem über GitHub Pages laufen.

## Assets
- `assets/IMAGE_PROMPTS.txt` enthält Prompts für editorial KI-Bilder, die du später ersetzen kannst.
