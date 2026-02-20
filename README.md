# Parrylicious Studio – Demo Website (GitHub Pages)

Diese Demo ist ein **statischer Prototype** (HTML/CSS/JS).  
Login und Buchungsdaten laufen jetzt über **Supabase**. Die Anzahlung bleibt als Demo-Simulation.

## Features
- Luxury Look (hellbraun/edel) + Logo
- Leistungen & Preise (ab) als Cards
- Buchungs-Wizard: Service → Stylist (optional) → Kalender/Slots → Daten → (Demo) Anzahlung
- Buchungen und Warteliste in Supabase pro eingeloggtem User
- Kunden-Login mit Supabase (E-Mail/Passwort + Google + Apple)
- Passwort-Reset per E-Mail aus dem Login-Formular
- Mitarbeiter-Dashboard: Bestätigen/Stornieren, CSV Export (Auth-Guard aktiv)

## Supabase Setup
1. In `supabase-config.js` eintragen:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (Publishable key)
2. In Supabase unter `Authentication -> URL Configuration` setzen:
   - `Site URL`: deine Pages-URL, z. B. `https://abeba272-stack.github.io/test-website/`
   - `Redirect URLs`: mindestens `https://abeba272-stack.github.io/test-website/login.html`
   - lokal optional: `http://localhost:8080/login.html`
3. In Supabase unter `Authentication -> Providers` Google/Apple aktivieren und Client IDs/Secrets eintragen.
4. In Supabase SQL Editor `supabase-schema.sql` ausführen (Tabellen + RLS Policies).
5. Login testen auf `login.html` und danach Buchung/Admin testen.

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
