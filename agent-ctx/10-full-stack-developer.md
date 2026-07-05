# Task 10 — ESS Portal Views (7 components)

Agent: full-stack-developer
Task: Build the 7 ESS "My Pay" portal view components in `/src/components/kedbyte/views/`

## Components
- `portal-dashboard.tsx` — greeting, hero pay card (blur-until-tap), 4-stat strip, quick actions, YTD strip, holiday ring, upcoming events, manager approval badge
- `portal-payslips.tsx` — tax-year filter, list (period/date/net/status/download), modal payslip preview w/ hash verification
- `portal-holidays.tsx` — balance ring, request form (live Mon–Fri day calc), history table
- `portal-approvals.tsx` — manager pending queue, approve/reject with note modal, overlap warning
- `portal-details.tsx` — editable address/phone/emergency, bank change with 24h cooling-off, read-only NINO/DOB
- `portal-documents.tsx` — tabs (Payslips/P60/P45/Contracts), grid of doc cards, view modal
- `portal-notifications.tsx` — list w/ type-based icons, mark-read + mark-all-read, onChanged callback

## API Integration
- `GET /api/ess/dashboard?userId=X` — dashboard bundle
- `GET /api/ess/payslips?userId=X` — payslip + document list
- `GET /api/ess/holidays?userId=X` — holidays + balance
- `POST /api/ess/holidays` — submit holiday request
- `GET /api/ess/details?userId=X` — personal details
- `PUT /api/ess/details` — fields + bankChange (with cooling-off response)
- `GET /api/holidays/approve?userId=X` — manager pending list
- `PUT /api/holidays/approve` and `PUT /api/holidays/reject` — manager actions
- `GET /api/notifications?userId=X` and `PUT /api/notifications` — mark-read / mark-all-read

## Key Decisions
- All views use `useApp()` for `user.id`, navigation, and the `gbp()/gbpShort()/fmtDate()/fmtDateTime()` helpers
- Centered narrower layout is provided by `PortalShell` (max-w-[760px]); views themselves are flush (no extra wrapper)
- Privacy blur on dashboard net pay uses a local `showPay` state toggle — tap the value to reveal/collapse
- Holiday request live day-count counts Mon–Fri between dates client-side (matches backend POST logic)
- Bank cooling-off: on submit the response activatesAt + coolingOff flag triggers a countdown banner that re-renders every minute
- Notification icons mapped by `type` (payslip_ready→description, holiday_decision→event, bank_change→account_balance, p60_ready→task_alt, pay_date→payments, default→info)
- Material Symbols everywhere; no shadcn icons
- All currency uses `gbp()` + `font-mono` / `data-sm` / `data-lg`
- NINO masked via `maskNINO()` from `@/engine/payroll`
- Modal preview shows truncated sha256 with full value on title hover; "Download PDF" → toast
