# Task 9 — Bureau secondary views (RTI, Pensions, Reports, Settings)

Agent: full-stack-developer
Task ID: 9

## Goal
Build 4 bureau view components in `src/components/kedbyte/views/`:
- `rti.tsx` — `export function RtiView()`
- `pensions.tsx` — `export function PensionsView()`
- `reports.tsx` — `export function ReportsView()`
- `settings.tsx` — `export function SettingsView()`

## APIs
- `GET /api/rti` → submissions + errorDictionary
- `GET /api/pensions?companyId=X` → employees + stats
- `POST /api/pensions` {action:"optout"} → {mode}
- `GET /api/reports?type=gross-to-net` → monthly, totals, departments, p32
- `GET /api/settings` → taxYear + config array
- `GET /api/bank-holidays` → bankHolidays array

## Shared primitives (already built)
`StatCard`, `StatusChip`, `DataTable`, `TableRow`, `TableCell`, `EmptyState`, `PearlButton`, `GhostButton`, `Field`, `TextInput`, `Select`, `Modal`, `toast` — all from `@/components/kedbyte/primitives`.

## Notes
- VOID design: dark, 0px radius, hairline borders, mono numbers.
- All `"use client"`, use `useApp()` for nav + helpers.
- Status colors: accepted/enrolled/eligible→green, polling/pending/submitted→amber, rejected/error/opted_out→red.
- For XML payload in RTI detail modal — `xmlPayload` isn't returned by API contract, so synthesize a representative IRenvelope+FPS XML from the submission fields.
- For charts in reports — pure CSS vertical bars + SVG donut, no recharts needed.
- Settings tab rail: 9 tabs (Company, Tax, Pension, Bank, Users, Security, Compliance, Notifications, System); default "Tax"; "Bank" + "Users" + "Compliance" have content; others show "Coming soon" empty state.
