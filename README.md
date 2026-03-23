# Volata Web – Frontend

Next.js 14 + Tailwind CSS + Mapbox GL + Supabase

## Setup (einmalig)

### 1. Dependencies installieren
```bash
cd volata-web
npm install
```

### 2. Environment Variables
```bash
cp .env.local.example .env.local
```
Dann in `.env.local` eintragen:

| Variable | Woher? |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | https://account.mapbox.com → Public Token |

### 3. Mapbox Account
Kostenloser Account auf [mapbox.com](https://account.mapbox.com).
Free Tier reicht für Entwicklung + kleine Nutzerzahlen (50.000 map loads/Monat gratis).

### 4. Supabase Auth Redirect URL
Im Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:3000`
- **Redirect URL hinzufügen**: `http://localhost:3000/auth/callback`

Für Production: gleiche URLs mit deiner echten Domain.

## Starten
```bash
npm run dev
# → http://localhost:3000
```

## Struktur
```
volata-web/
├── app/
│   ├── layout.tsx           # Root Layout, Fonts, Metadata
│   ├── page.tsx             # Hauptseite (Single Page App)
│   ├── globals.css          # Tailwind + Mapbox CSS Overrides
│   └── auth/callback/       # OAuth Redirect Handler
├── components/
│   ├── AuthButton.tsx       # Google Login / Logout
│   ├── RouteForm.tsx        # Airport Picker + Form
│   ├── MapView.tsx          # Mapbox Karte + Waypoint Popup
│   └── WaypointPanel.tsx    # Route-Ergebnis + FPL Export
├── lib/
│   ├── supabase.ts          # Supabase Client
│   ├── types.ts             # TypeScript Interfaces + Konstanten
│   └── wikimedia.ts         # Wikipedia Foto API
├── .env.local.example       # Environment Template
└── package.json
```

## Features
- **Google OAuth** via Supabase (PKCE Flow)
- **Airport Suche** – Live-Autocomplete aus Supabase DB (432 deutsche Airports)
- **Route Form** – Flugzeugtyp, Blockzeit (Slider), Luftraum-Modus
- **Mapbox Karte** – Outdoors Style mit Terrain, Route als gestrichelte Linie
- **Waypoint Marker** – Amber Pins mit Nummern, animierter Hover
- **Wikipedia Popup** – Klick auf Marker → Foto + Info + Wikipedia Link
- **FPL Export** – ForeFlight .fpl (Garmin FlightPlan XML) Download
- **Route Caching** – Identische Anfragen kommen gecacht zurück

## Production Deploy (Vercel)
```bash
npm install -g vercel
vercel
# → Environment Variables in Vercel Dashboard setzen
```
Dann in Supabase Redirect URLs die Vercel Domain hinzufügen.
