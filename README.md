# 🇨🇴 Reporte CO

**An open-source, privacy-first citizen platform for mapping earthquake damage
and needs across Colombia**: trapped people, injuries, collapsed buildings,
shelter, blocked roads, and water/power/food outages.

Built for the **M7.4 earthquake of 10 August 2026**, epicenter near **San José
del Palmar, Chocó** (~103 km deep, 7:34 a.m. local), the strongest quake
recorded in Colombia in decades. It was felt nationwide, with the heaviest
damage in **Pereira, Manizales, Armenia, Cali and Chocó**.

Inspired by [**Mission 4636**](https://www.mission4636.org/), the 2010 Haiti
earthquake effort where thousands of diaspora volunteers translated,
categorized, and geolocated SMS reports to direct aid. Same pipeline:

> **Ingest → Categorize → Geolocate → Verify → Publish**

People report via **WhatsApp** (or an anonymous web form); a community of
volunteers structures and verifies each report; verified, **PII-scrubbed**
reports appear on a public, real-time map.

> If lives are at risk right now, call **123** first. This map coordinates
> help, it does not replace emergency services.

## Why privacy is the core requirement

Mission 4636's #1 documented lesson was that a public crisis map _exposed the
identities of at-risk people_. Disaster reporting is exactly when people are
most vulnerable, so this project is **private by default**:

- We **never store raw phone numbers**, only a salted HMAC hash.
- A reporter's **exact location is never published**: public pins are coarsened
  to a ~2 km grid (or the departamento centroid).
- Reports are **invisible until a moderator verifies and publishes** them.
- Free-text is **auto-scrubbed of PII** (phones, emails, cédulas: `CC`, `TI`,
  `CE`, `NIT`, and bare dotted ids) before it can go public, and the Realtime
  layer **broadcasts only public fields**, so raw rows never leave the server.
- Every state change is written to an **append-only audit log**.

For the `missing` category especially, moderators must write a summary that
locates the need without publishing full names of missing people.

## Architecture

```
 REPORTERS            INGEST                 STRUCTURING CROWD          OUTPUT
 WhatsApp ─webhook─▶ /api/webhooks/whatsapp ─┐                      ┌▶ Public map
 Web form ─POST───▶ /api/reports ───────────┼─▶ Moderation queue ──┤  (Realtime)
                                             │   • categorize       └▶ /api/reports
                    Supabase Postgres ◀──────┘   • geolocate           (PII-free feed)
                    (Drizzle ORM)                • verify (N agree)
                                                 • publish (scrub + coarsen)
```

## Domain model

`src/lib/taxonomy.ts` is the single source of truth. The DB schema, Zod
validators, and UI all derive from it.

| Piece            | Values                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Categories       | `rescue` `medical` `missing` `damage` `shelter` `water` `food` `electricity` `roads` `telecoms` `other`             |
| Severity         | `low` `medium` `high` `critical`                                                                                   |
| Status           | `pending` `in_review` `verified` `published` `rejected` `duplicate`                                                 |
| Geo              | 32 departamentos + Bogotá D.C., then `municipio` and `barrio`                                                      |
| Default map view | The affected corridor: Chocó (epicenter marked on the map) through the Eje Cafetero to Cali                        |

Reporters can also add free-text categories the taxonomy doesn't cover yet;
moderators recategorize them later.

## Tech stack

- **Next.js 16** (App Router; note: middleware is `proxy.ts` in v16) + React 19
- **Supabase**: Postgres + Realtime
- **Drizzle ORM** + **Zod** (typesafe schema ↔ validation, single source of truth)
- **Kapso**: WhatsApp Cloud API ([`@kapso/whatsapp-cloud-api`](https://www.npmjs.com/package/@kapso/whatsapp-cloud-api))
- **shadcn/ui** (new-york) + Tailwind v4
- **Mapbox GL JS v3**: maps (needs `NEXT_PUBLIC_MAPBOX_TOKEN`)
- **Biome** + **bun**

## Getting started

```bash
bun install
cp .env.local.example .env.local   # then fill in the values

# Push the Drizzle schema to your Supabase Cloud database (no migration files)
bun run db:push

bun run db:seed                     # optional: demo points across the quake zone
bun run dev                         # http://localhost:3000
```

We use `drizzle-kit push` against the Supabase Cloud project (the
`DATABASE_URL` connection-pooler string) rather than committed migration files.
`bun run db:studio` opens Drizzle Studio against the same database.

Generate secrets with `openssl rand -hex 32` for `REPORTER_HASH_SECRET` and
`MODERATOR_SESSION_SECRET`, and set a `MODERATOR_PASSWORD`.

### Key routes

| Route                    | What                                        |
| ------------------------ | ------------------------------------------- |
| `/`                      | Public real-time map of verified reports    |
| `/reportar`              | Anonymous web report form                   |
| `/ayudar`                | Volunteer sign-up ("quiero ayudar")         |
| `/ayudar/necesidades`    | Published needs as a triage list            |
| `/moderation`            | Volunteer moderation queue (password-gated) |
| `/api/reports`           | `GET` PII-free feed · `POST` web submission |
| `/api/volunteers`        | `POST` volunteer sign-up (no public `GET`)  |
| `/api/webhooks/whatsapp` | Kapso/WhatsApp inbound webhook (signed)     |

### WhatsApp setup (Kapso)

1. Create a number at [kapso.ai](https://kapso.ai); copy the API key + phone id.
2. Set `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_VERIFY_TOKEN`.
3. Point the webhook at `https://<your-host>/api/webhooks/whatsapp` (the `GET`
   handler answers the verification challenge; `POST` verifies
   `X-Hub-Signature-256`).

Without WhatsApp configured, the web form path works end-to-end on its own.

## Status & roadmap

MVP foundation. Working: WhatsApp + web ingest, moderation queue with N-of-M
verification, PII scrubbing + coarsened geo, real-time public map with the
epicenter marked, and volunteer sign-up with a triage list of published needs.

Next up: Supabase Auth for per-volunteer accounts (replacing the shared-password
gate), assignments so a moderator can hand a case to one volunteer and reveal
the exact address only to them, a municipio/barrio gazetteer for
sharper-but-safe geolocation, duplicate clustering, feeds for UNGRD and relief
NGOs (CSV/RSS), and Telegram intake.

### The volunteer side

`/ayudar` collects what someone can offer (capabilities drawn from the same
taxonomy as reports, plus departamento/municipio and how many cases they can
take at once). Two privacy notes:

- The volunteer's raw contact is stored **only** on explicit opt-in, and lives
  on the internal side alongside `rawText` and precise coordinates: no endpoint
  returns it, it never goes over Realtime, and `volunteers` has no public read
  path. A salted, domain-separated hash is always stored so a repeat sign-up
  updates the existing row instead of creating a second one.
- `/ayudar/necesidades` calls `getPublicReports()`, the same query behind the
  map, so it can only ever show data that is already public.

## Credits & sources

Event parameters from the [Servicio Geológico
Colombiano](https://www.sgc.gov.co/) and the
[USGS](https://earthquake.usgs.gov/). Sibling project:
[reporte-ve](https://github.com/crafter-station/reporte-ve), the Venezuela
edition this codebase was forked from.

## Contributing

Issues and PRs welcome at
[crafter-station/reporte-co](https://github.com/crafter-station/reporte-co).
Run `bun run lint` (Biome) and `bunx tsc --noEmit` before pushing.

## License

Open source. See `LICENSE` (to be added).
