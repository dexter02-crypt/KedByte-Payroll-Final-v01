# Task 8 — Pay Run Wizard (4 steps)

Agent: full-stack-developer
Task: Build Pay Run Wizard signature flow — 4 view components in `/src/components/kedbyte/views/`

## Files Delivered
- `payrun-input.tsx` — Step 1: company picker + editable entries table with 800ms autosave
- `payrun-calculation.tsx` — Step 2: THE SIGNATURE terminal log streaming screen (60/40 split)
- `payrun-review.tsx` — Step 3: audit table + payslip preview Modal + per-row approve/reject
- `payrun-submission.tsx` — Step 4: submission cards + BACS file generator + finalise flow

## API Integration
- `POST /api/payruns` — creates pay run from company picker (Step 1)
- `GET /api/payruns/[id]` — loads pay run + entries + totals (Steps 1, 3, 4)
- `PUT /api/payruns/[id]` — autosave edited entries, echo back provisional gross (Step 1)
- `POST /api/payruns/[id]/calculate` — runs engine, returns progressLog + totals + errors (Step 2)
- `POST /api/payruns/[id]/entries` — approve / reject individual entries (Step 3)
- `PUT /api/payruns/[id]/entries` — approve-all calculated entries (Step 3)
- `POST /api/payruns/[id]/finalize` — commits, rolls YTD, creates RTI + payslips (Step 4)

## Key Decisions
- **Step 2 streaming**: POST fires once on mount (guarded by `firedRef`). Boot lines pushed immediately, then progressLog entries streamed one-at-a-time with randomized 60–120ms delays. Right-side totals interpolated linearly by `processed/total` scale, then snapped to exact final totals on completion.
- **Step 1 autosave**: dirty-set tracking + 800ms debounce. Echo from server overwrites local provisional gross (basic + OT*1.5*approx-hourly + bonus + commission) for accuracy.
- **Step 3 gating**: "Continue to Submission" enabled only when every entry is `approved` OR `rejected` (covers partial-reject scenarios).
- **Step 4 BACS**: generates a Standard-18-ish text blob (108-char records, HDR1/VOL1/HDR2/UHL1 + per-approved-employee payment records + EOF1/UTL1/EOF2 footers) and triggers browser download.
- **Step 4 finalise**: after `POST /finalize`, card statuses are derived from `jobs` response (`fps→accepted`, `pension→accepted`, `bacs→generated`, `payslips→distributed`). Success state shows check-mark hero + job summary grid + View Reports / Return to Dashboard actions.
- All components are `"use client"`, use `useApp()` for navigation + helpers (`gbp()`, `fmtDate()`), and match the Void design system exactly (0px radius, mono numbers, hairline borders, no shadows, dark surfaces).

## Lint
`bun run lint` → 0 errors, 0 warnings on my 4 files (2 pre-existing warnings in `layout.tsx` from other work).
