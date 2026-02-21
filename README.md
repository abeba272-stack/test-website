# Parrylicious Studio Website

Produktionsstand der Website mit:
- statischem Frontend (GitHub Pages oder Vercel Static),
- Supabase Auth + Buchungsdaten,
- Stripe Checkout + Webhook,
- SMS/E-Mail-Benachrichtigungen via Twilio/Resend.

## Features
- Service-Katalog mit echten Style-Bildern
- Buchungs-Wizard mit Gastmodus oder Login
- Slot-Schutz gegen Doppelbuchungen (`slot_is_available`)
- Rollenbasiertes Dashboard (`customer`, `staff`, `admin`)
- Zahlungsstatus pro Buchung (`unpaid`, `pending`, `paid`, `failed`, `refunded`)
- Admin-Aktionen mit Benachrichtigungsversand (Bestätigung/Storno)

## Supabase Setup
1. `supabase-config.js` ausfüllen:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. In Supabase SQL Editor `supabase-schema.sql` komplett ausführen.
3. Auth Redirects setzen (`Authentication -> URL Configuration`):
   - `Site URL`: deine Live-Domain
   - `Redirect URLs`: mindestens `<LIVE_URL>/login.html`
   - lokal optional: `http://localhost:3000/login.html`
4. OAuth Provider aktivieren (`Authentication -> Providers`):
   - Google
   - Apple (nur wenn vollständig mit Apple Developer konfiguriert)
5. Rollen vergeben (mind. ein Staff/Admin):
   - `select id, email from auth.users order by created_at desc;`
   - `update public.profiles set role = 'staff' where id = '<USER_UUID>';`

## Backend Environment Variables
Für `/api/*` (z. B. auf Vercel):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGIN` (z. B. `https://parrylicious.store`)
- `RESEND_API_KEY` (optional, für E-Mail)
- `RESEND_FROM_EMAIL` (optional, für E-Mail)
- `TWILIO_ACCOUNT_SID` (optional, für SMS)
- `TWILIO_AUTH_TOKEN` (optional, für SMS)
- `TWILIO_FROM_NUMBER` (optional, für SMS)

## Frontend API Ziel setzen
Wenn Frontend und API nicht auf derselben Domain laufen:
1. In `backend-config.js` `BACKEND_API_BASE_URL` setzen, z. B. `https://parrylicious-api.vercel.app`
2. Backend `ALLOWED_ORIGIN` auf deine Frontend-Domain setzen.

## Stripe Setup
1. In Stripe ein Produkt für die Anzahlung ist nicht zwingend nötig; Checkout wird dynamisch pro Buchung erzeugt.
2. Webhook Endpoint anlegen:
   - URL: `<API_BASE_URL>/api/stripe-webhook`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
3. Signatur-Secret aus Stripe als `STRIPE_WEBHOOK_SECRET` setzen.

## Lokaler Start
Empfohlen mit Vercel CLI, damit Frontend und `/api/*` lokal zusammen laufen:
```bash
vercel dev
```
Dann öffnen: `http://localhost:3000`

## Deployment
- Nur Frontend (ohne `/api/*`): GitHub Pages möglich.
- Voller Produktivbetrieb mit Checkout/Webhook/Notifications: Vercel (oder anderes Hosting mit Node Functions) empfohlen.

## Rechtliches
- `impressum.html` und `privacy.html` sind auf produktive Inhalte umgestellt.
- Vor Livegang juristisch final prüfen lassen (insb. USt-/Steuerangaben, Auftragsverarbeiter, Formulierungen).

## QA-Checkliste vor Launch
- Login:
  - E-Mail/Passwort
  - Google OAuth
  - Apple OAuth (falls aktiviert)
- Buchung:
  - Gastbuchung ohne Login
  - Konto-Buchung mit Stripe Checkout
  - Rückkehr nach erfolgreicher Zahlung (`payment=success`)
  - Rückkehr bei Abbruch (`payment=cancel`)
- Slotlogik:
  - Doppelbuchungsschutz aktiv
  - Kalenderhorizont: `maxDaysAhead = 60` und Anzeige ebenfalls 60 Tage
- Admin:
  - Rollenrechte (`customer` vs `staff/admin`)
  - Bestätigen/Stornieren aktualisiert DB
  - Benachrichtigungen werden versendet
- Mobile:
  - Header, Wizard, Dashboard auf iOS/Android prüfen
