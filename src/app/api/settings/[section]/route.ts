import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validatePAYERef, validateAORef, validateSortCode, validateAccount } from "@/engine/payroll";

// ============ GET: return section payload ============
export async function GET(req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const url = req.nextUrl;
  const companyId = url.searchParams.get("companyId");
  const year = url.searchParams.get("year") || "2026-27";

  switch (section) {
    case "company":
      return NextResponse.json(await getCompanyPayload(companyId));
    case "tax":
      return NextResponse.json(await getTaxPayload(year, companyId));
    case "pension":
      return NextResponse.json(await getPensionPayload(companyId));
    case "bank":
      return NextResponse.json(await getBankPayload(companyId));
    case "users":
      return NextResponse.json(await getUsersPayload());
    case "security":
      return NextResponse.json(await getSecurityPayload(companyId));
    case "compliance":
      return NextResponse.json(await getCompliancePayload(companyId));
    case "notifications":
      return NextResponse.json(await getNotificationsPayload());
    case "system":
      return NextResponse.json(await getSystemPayload());
    default:
      return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }
}

// ============ PUT: update section ============
export async function PUT(req: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const body = await req.json();
  const { changes, companyId, reason } = body;

  // Apply section-specific writes (updaters return {ok,payload} or {error,status,fields})
  let result: any;
  switch (section) {
    case "company": result = await updateCompany(companyId, changes); break;
    case "tax": result = await updateTax(companyId, changes); break;
    case "pension": result = await updatePension(companyId, changes); break;
    case "bank": result = await updateBank(companyId, changes); break;
    case "users": result = await updateUsers(changes); break;
    case "security": result = await updateSecurity(changes); break;
    case "compliance": result = await updateCompliance(companyId, changes); break;
    case "notifications": result = await updateNotifications(changes); break;
    case "system": result = await updateSystem(changes); break;
    default: return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }

  // If updater returned an error, return it with the right status
  if (result?.error) {
    return NextResponse.json({ error: result.error, fields: result.fields }, { status: result.status || 422 });
  }

  // Audit each accepted change
  for (const change of changes || []) {
    await db.auditLog.create({
      data: {
        tenantId: "bureau_kedbyte",
        actorId: body.actorId || "user_admin",
        action: "SETTINGS_CHANGED",
        entityType: `settings:${section}`,
        entityId: companyId || "bureau",
        beforeJson: JSON.stringify(change.before || null),
        afterJson: JSON.stringify({ key: change.key, value: change.value }),
        reason: reason || null,
        prevHash: "0".repeat(64),
        currHash: "0".repeat(64),
        seq: Math.floor(Date.now() / 1000),
      },
    });
  }

  return NextResponse.json(result);
}

// ============ SECTION PAYLOAD BUILDERS ============

async function getCompanyPayload(companyId: string | null) {
  const companies = await db.company.findMany({ where: { status: { not: "deleted" } } });
  return {
    scope: companyId ? "company" : "bureau",
    version: new Date().toISOString(),
    defaults: {
      region: "england_wales",
      paySchedule: { rule: "monthly_last_working_day", day: null },
      earlyPay: true,
      overtimeMultiplier: 1.5,
      pilonDivisor: 260,
      holidayEntitlementBasis: "statutory_5_6_weeks",
      payslipTemplate: "void_standard",
      payrollIdPrefix: "EMP-",
    },
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      overridesCount: c.paySchedule !== "monthly_last_working_day" || c.region !== "england_wales" ? 2 : 0,
    })),
  };
}

async function getTaxPayload(year: string, companyId: string | null) {
  const thresholds = buildThresholds(year);
  let companyPaye = null;
  if (companyId) {
    const c = await db.company.findUnique({ where: { id: companyId } });
    if (c) {
      companyPaye = { payeRef: c.payeRef, aoRef: c.accountsOfficeRef, senderVerified: true };
    }
  }
  return {
    version: new Date().toISOString(),
    years: { active: "2026-27", available: ["2026-27", "2025-26"] },
    thresholds,
    scotlandBands: [
      { label: "Starter", rate: "19%", ceiling: 16537 },
      { label: "Basic", rate: "20%", ceiling: 29526 },
      { label: "Intermediate", rate: "21%", ceiling: 43662 },
      { label: "Higher", rate: "42%", ceiling: 75000 },
      { label: "Advanced", rate: "45%", ceiling: 125140 },
      { label: "Top", rate: "48%", ceiling: null },
    ],
    rukBands: [
      { label: "Basic", rate: "20%", ceiling: 37700 },
      { label: "Higher", rate: "40%", ceiling: 112570 },
      { label: "Additional", rate: "45%", ceiling: null },
    ],
    sync: { lastRunAt: "2026-07-01T03:00:00Z", status: "ok", source: "gov.uk rates page" },
    companyPaye,
  };
}

function buildThresholds(year: string) {
  const isCurrent = year === "2026-27";
  const rows = [
    { key: "personal_allowance", label: "Personal Allowance", value: 12570, unit: "£/yr", priorValue: 12570, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "basic_rate_limit", label: "Basic Rate Limit", value: 37700, unit: "£/yr", priorValue: 37700, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "higher_rate_limit", label: "Higher Rate Limit", value: 125140, unit: "£/yr", priorValue: 125140, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "ni_pt", label: "NI Primary Threshold", value: 1048, unit: "£/mo", priorValue: 1048, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "ni_st", label: "NI Secondary Threshold", value: 417, unit: "£/mo", priorValue: 417, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "ni_uel", label: "NI Upper Earnings Limit", value: 4189, unit: "£/mo", priorValue: 4189, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "ni_lel", label: "NI Lower Earnings Limit", value: 559, unit: "£/mo", priorValue: 559, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "ni_ee_main", label: "NI Employee Main Rate", value: 8, unit: "%", priorValue: 8, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "ni_er_rate", label: "NI Employer Rate", value: 15, unit: "%", priorValue: 13.8, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "employment_allowance", label: "Employment Allowance", value: 10500, unit: "£/yr", priorValue: 9950, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "sl_plan_1", label: "SL Plan 1 Threshold", value: 26900, unit: "£/yr", priorValue: 24000, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "sl_plan_2", label: "SL Plan 2 Threshold", value: 29385, unit: "£/yr", priorValue: 27295, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "sl_plan_4", label: "SL Plan 4 Threshold", value: 33795, unit: "£/yr", priorValue: 32300, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "sl_plan_5", label: "SL Plan 5 Threshold", value: 25000, unit: "£/yr", priorValue: 0, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "sl_postgrad", label: "Postgraduate Loan Threshold", value: 21000, unit: "£/yr", priorValue: 21000, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "ae_trigger", label: "AE Trigger", value: 10000, unit: "£/yr", priorValue: 10000, authority: "TPR", effectiveFrom: "2026-04-06" },
    { key: "ae_qel", label: "AE Qualifying Earnings Lower", value: 6240, unit: "£/yr", priorValue: 6240, authority: "TPR", effectiveFrom: "2026-04-06" },
    { key: "ae_qeu", label: "AE Qualifying Earnings Upper", value: 50270, unit: "£/yr", priorValue: 50270, authority: "TPR", effectiveFrom: "2026-04-06" },
    { key: "nlw_21", label: "National Living Wage (21+)", value: 12.71, unit: "£/hr", priorValue: 12.0, authority: "Low Pay Commission", effectiveFrom: "2026-04-06" },
    { key: "nmw_18_20", label: "NMW (18-20)", value: 10.85, unit: "£/hr", priorValue: 10.0, authority: "Low Pay Commission", effectiveFrom: "2026-04-06" },
    { key: "ssp_week", label: "SSP Weekly (max)", value: 123.25, unit: "£/wk", priorValue: 118.22, authority: "HMRC", effectiveFrom: "2026-04-06" },
    { key: "smp_std_week", label: "SMP Standard Weekly", value: 194.32, unit: "£/wk", priorValue: 187.18, authority: "HMRC", effectiveFrom: "2026-04-06" },
  ];
  return rows.map((r) => {
    const variancePct = r.priorValue > 0 ? Math.round(((r.value - r.priorValue) / r.priorValue) * 1000) / 10 : 0;
    return { ...r, variancePct, overridden: false, readOnly: !isCurrent };
  });
}

async function getPensionPayload(companyId: string | null) {
  let scheme = null;
  let enrolledCount = 0;
  let optedOutCount = 0;
  let providerConnection = null;
  if (companyId) {
    scheme = await db.pensionScheme.findFirst({ where: { companyId, status: "active" } });
    const emps = await db.employee.findMany({ where: { companyId, status: "active" } });
    enrolledCount = emps.filter((e) => e.pensionStatus === "enrolled").length;
    optedOutCount = emps.filter((e) => e.pensionStatus === "opted_out").length;
    if (scheme?.provider === "NEST") {
      providerConnection = {
        nestEmployerRef: scheme.schemeRef || "",
        directDebitActive: true,
        lastContributionRun: "2026-06-30",
      };
    }
  }
  return {
    version: new Date().toISOString(),
    scheme: scheme || {
      id: null,
      provider: "NEST",
      schemeRef: null,
      basis: "qualifying_earnings",
      relief: "relief_at_source",
      eeRate: 0.05,
      erRate: 0.03,
      status: "active",
    },
    statutoryFloor: { minTotal: 0.08, minEmployer: 0.03, aeTrigger: 10000, qel: 6240, qeu: 50270 },
    providerConnection,
    reEnrolment: { windowStart: "2026-09-01", windowEnd: "2027-03-01", due: false },
    enrolledCount,
    optedOutCount,
  };
}

async function getBankPayload(companyId: string | null) {
  if (!companyId) {
    return {
      version: new Date().toISOString(),
      account: { sortCodeMasked: "—", accountMasked: "—", accountName: null, modulusStatus: "untested", verifiedAt: null },
      bacs: { sun: null, leadDays: 2, submissionWindowNote: "Submit by 22:30 on processing day 1" },
      paymentRail: "bacs",
      linkedCards: [
        { label: "Pay schedule", href: "/bureau/settings/pay-schedule" },
        { label: "Bank holidays", href: "/bureau/settings/bank-holidays" },
      ],
    };
  }
  const c = await db.company.findUnique({ where: { id: companyId } });
  const sc = c?.bankSortCode || "";
  const ac = c?.bankAccount || "";
  return {
    version: new Date().toISOString(),
    account: {
      sortCodeMasked: sc ? `${sc.slice(0, 2)}-••-••` : "—",
      accountMasked: ac ? `••••${ac.slice(-4)}` : "—",
      accountName: c?.bankAccountName || null,
      modulusStatus: sc ? "passed" : "untested",
      verifiedAt: c?.updatedAt.toISOString() || null,
    },
    bacs: { sun: c?.bacsSun || null, leadDays: 2, submissionWindowNote: "Submit by 22:30 on processing day 1" },
    paymentRail: "bacs",
    linkedCards: [
      { label: "Pay schedule", href: "/bureau/settings/pay-schedule" },
      { label: "Bank holidays", href: "/bureau/settings/bank-holidays" },
    ],
  };
}

async function getUsersPayload() {
  const users = await db.user.findMany({ orderBy: { email: "asc" } });
  const companies = await db.company.findMany();
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  return {
    version: new Date().toISOString(),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.email.split("@")[0],
      role: u.role,
      companyScope: { all: u.role === "bureau_admin", companyIds: u.companyId ? [u.companyId] : [] },
      mfaEnabled: u.mfaEnabled,
      status: u.status,
      lastLogin: u.lastLogin?.toISOString() || null,
      companyName: u.companyId ? companyMap.get(u.companyId) || null : null,
    })),
    invites: [],
  };
}

async function getSecurityPayload(companyId: string | null) {
  const companies = await db.company.findMany();
  return {
    version: new Date().toISOString(),
    policy: {
      minPasswordLength: 12,
      breachCheck: true,
      mfaRequiredForRoles: ["bureau_admin"],
      sessionIdleMinutes: 30,
      refreshDays: 7,
    },
    mySessions: [
      { id: "sess_current", device: "Chrome · macOS", ip: "82.14.220.7", lastSeen: new Date().toISOString(), current: true },
      { id: "sess_mobile", device: "Safari · iOS", ip: "82.14.220.7", lastSeen: new Date(Date.now() - 86400000).toISOString(), current: false },
    ],
    hmrcCredentials: companies.map((c) => ({
      companyId: c.id,
      companyName: c.name,
      senderId: "KEDBYTE-BUREAU",
      hasPassword: true,
      lastVerified: "2026-07-01T03:00:00Z",
      status: "ok" as const,
    })),
    auditChain: { lastVerifiedAt: new Date().toISOString(), intact: true, rows: 0 },
  };
}

async function getCompliancePayload(companyId: string | null) {
  const empCount = companyId
    ? await db.employee.count({ where: { companyId, status: "active" } })
    : await db.employee.count({ where: { status: "active" } });
  const p60Count = await db.document.count({ where: { type: "p60" } });
  return {
    version: new Date().toISOString(),
    retention: { payrollYears: 6, statutoryMinimumYears: 3 },
    yearEnd: {
      taxYear: "2025-26",
      checklist: [
        { key: "final_fps", label: "Final FPS/EPS indicator sent", done: false, due: "2026-04-19", href: "/bureau/rti" },
        { key: "p60s", label: "P60s issued to all employed on 5 April", done: p60Count >= empCount, doneCount: p60Count, total: empCount, due: "2026-05-31" },
        { key: "p11ds", label: "P11D / P11D(b) submitted", done: false, due: "2026-07-06" },
        { key: "class1a", label: "Class 1A NIC paid", done: false, due: "2026-07-22" },
      ],
    },
    smallEmployer: { flag: false, basis: "prior-year Class 1 ≤ £45,000", recoveryRate: "92%" },
    employmentAllowance: { claimed: true, usedYtd: 4200, cap: 10500 },
    gdpr: { erasureRequests: [] },
  };
}

async function getNotificationsPayload() {
  return {
    version: new Date().toISOString(),
    rules: [
      { key: "payrun_input_due", label: "Pay run input due", offsetDays: -5, channels: { inApp: true, email: true }, enabled: true, locked: false },
      { key: "bacs_deadline", label: "BACS submission deadline", offsetDays: -2, channels: { inApp: true, email: true }, enabled: true, locked: false },
      { key: "fps_due", label: "FPS due (payday)", offsetDays: 0, channels: { inApp: true, email: true }, enabled: true, locked: false },
      { key: "rti_rejected", label: "RTI rejected", offsetDays: null, channels: { inApp: true, email: true }, enabled: true, locked: true },
      { key: "bank_change_request", label: "Employee bank change", offsetDays: null, channels: { inApp: true, email: true }, enabled: true, locked: true },
      { key: "ae_reenrolment", label: "Re-enrolment window", offsetDays: -30, channels: { inApp: true, email: false }, enabled: true, locked: false },
    ],
    myPreferences: { emailDigest: "immediate" },
  };
}

async function getSystemPayload() {
  const bureau = await db.bureau.findFirst();
  const bankHolidays = await db.bankHoliday.count();
  return {
    version: new Date().toISOString(),
    bureau: { name: bureau?.name || "Kedbyte Payroll Bureau", id: bureau?.id || "bureau_kedbyte" },
    dataExport: { lastExportAt: null, formats: ["csv-bundle", "json"] },
    jobs: [
      { queue: "payrun:calculate", waiting: 0, failed: 0, lastRun: new Date().toISOString() },
      { queue: "rti:submit", waiting: 1, failed: 0, lastRun: new Date().toISOString() },
      { queue: "pdf:payslips", waiting: 0, failed: 0, lastRun: new Date().toISOString() },
      { queue: "notify:paydates", waiting: 0, failed: 0, lastRun: new Date().toISOString() },
    ],
    bankHolidaySync: { lastRunAt: "2026-07-05T03:00:00Z", nextRunAt: "2026-07-06T03:00:00Z", source: "gov.uk/bank-holidays.json", count: bankHolidays },
    dpsFetch: { lastRunAt: "2026-07-05T05:00:00Z", highWaterMarks: { P6: 1247, SL1: 89, P9: 34 } },
    appVersion: "1.0.0",
    engineTaxYears: ["2026-27"],
  };
}

// ============ SECTION UPDATERS ============

async function updateCompany(companyId: string | null, changes: any[]) {
  if (companyId) {
    for (const c of changes) {
      if (c.key === "region") await db.company.update({ where: { id: companyId }, data: { region: c.value } });
      if (c.key === "payScheduleRule") await db.company.update({ where: { id: companyId }, data: { paySchedule: c.value } });
      if (c.key === "earlyPay") await db.company.update({ where: { id: companyId }, data: { earlyPay: c.value } });
    }
  }
  return { ok: true, payload: await getCompanyPayload(companyId) };
}

async function updateTax(companyId: string | null, changes: any[]) {
  if (companyId) {
    for (const c of changes) {
      if (c.key === "payeRef") {
        if (!validatePAYERef(c.value)) return { error: "Invalid PAYE ref", fields: { payeRef: "Format: 123/AB456" }, status: 422 };
        await db.company.update({ where: { id: companyId }, data: { payeRef: c.value } });
      }
      if (c.key === "aoRef") {
        if (!validateAORef(c.value)) return { error: "Invalid AO ref", fields: { aoRef: "Format: 123PA0001234X" }, status: 422 };
        await db.company.update({ where: { id: companyId }, data: { accountsOfficeRef: c.value } });
      }
    }
  }
  return { ok: true, payload: await getTaxPayload("2026-27", companyId) };
}

async function updatePension(companyId: string | null, changes: any[]) {
  if (!companyId) return { ok: true };
  let scheme = await db.pensionScheme.findFirst({ where: { companyId } });
  const data: any = {};
  for (const c of changes) {
    if (c.key === "eeRate") data.eeRate = c.value;
    if (c.key === "erRate") data.erRate = c.value;
    if (c.key === "basis") data.basis = c.value;
    if (c.key === "relief") data.relief = c.value;
    if (c.key === "provider") data.provider = c.value;
    if (c.key === "schemeRef") data.schemeRef = c.value;
  }
  // Statutory floor validation
  const eeRate = data.eeRate ?? scheme?.eeRate ?? 0.05;
  const erRate = data.erRate ?? scheme?.erRate ?? 0.03;
  const basis = data.basis ?? scheme?.basis ?? "qualifying_earnings";
  const floors: Record<string, { total: number; employer: number }> = {
    qualifying_earnings: { total: 0.08, employer: 0.03 },
    pensionable_full: { total: 0.09, employer: 0.04 },
    total_earnings: { total: 0.07, employer: 0.03 },
  };
  const floor = floors[basis] || floors.qualifying_earnings;
  if (eeRate + erRate < floor.total || erRate < floor.employer) {
    return { error: `Below auto-enrolment minimum (${(floor.total * 100).toFixed(0)}% total / ${(floor.employer * 100).toFixed(0)}% employer on ${basis.replace("_", " ")})`, fields: { erRate: "Below statutory floor" }, status: 422 };
  }
  if (scheme) {
    await db.pensionScheme.update({ where: { id: scheme.id }, data });
  } else {
    await db.pensionScheme.create({ data: { tenantId: "bureau_kedbyte", companyId, ...data, status: "active" } });
  }
  return { ok: true, payload: await getPensionPayload(companyId) };
}

async function updateBank(companyId: string | null, changes: any[]) {
  if (!companyId) return { ok: true };
  for (const c of changes) {
    if (c.key === "sortCode") {
      if (!validateSortCode(c.value)) return { error: "Invalid sort code", fields: { sortCode: "6 digits required" }, status: 422 };
      await db.company.update({ where: { id: companyId }, data: { bankSortCode: c.value.replace(/[-\s]/g, "") } });
    }
    if (c.key === "account") {
      if (!validateAccount(c.value)) return { error: "Invalid account number", fields: { account: "8 digits required" }, status: 422 };
      await db.company.update({ where: { id: companyId }, data: { bankAccount: c.value } });
    }
    if (c.key === "accountName") await db.company.update({ where: { id: companyId }, data: { bankAccountName: c.value } });
    if (c.key === "sun") await db.company.update({ where: { id: companyId }, data: { bacsSun: c.value } });
  }
  return { ok: true, payload: await getBankPayload(companyId) };
}

async function updateUsers(changes: any[]) {
  for (const c of changes) {
    if (c.key === "role" && c.entityId) {
      const targetUser = await db.user.findUnique({ where: { id: c.entityId } });
      if (targetUser?.role === "bureau_admin" && c.value !== "bureau_admin") {
        const adminCount = await db.user.count({ where: { role: "bureau_admin", status: "active" } });
        if (adminCount <= 1) return { error: "Cannot demote the last bureau admin", status: 409 };
      }
      await db.user.update({ where: { id: c.entityId }, data: { role: c.value, tokenVersion: { increment: 1 } } });
    }
    if (c.key === "status" && c.entityId) {
      const targetUser = await db.user.findUnique({ where: { id: c.entityId } });
      if (targetUser?.role === "bureau_admin" && c.value === "disabled") {
        const adminCount = await db.user.count({ where: { role: "bureau_admin", status: "active" } });
        if (adminCount <= 1) return { error: "Cannot disable the last bureau admin", status: 409 };
      }
      await db.user.update({ where: { id: c.entityId }, data: { status: c.value, tokenVersion: { increment: 1 } } });
    }
  }
  return { ok: true, payload: await getUsersPayload() };
}

async function updateSecurity(changes: any[]) {
  // Policy edits — in production these write to statutory_config or a policy table
  return { ok: true, payload: await getSecurityPayload(null) };
}

async function updateCompliance(companyId: string | null, changes: any[]) {
  if (companyId) {
    for (const c of changes) {
      if (c.key === "smallEmployer") await db.company.update({ where: { id: companyId }, data: { smallEmployer: c.value } });
      if (c.key === "employmentAllowance") await db.company.update({ where: { id: companyId }, data: { employmentAllowance: c.value } });
    }
  }
  return { ok: true, payload: await getCompliancePayload(companyId) };
}

async function updateNotifications(changes: any[]) {
  return { ok: true, payload: await getNotificationsPayload() };
}

async function updateSystem(changes: any[]) {
  for (const c of changes) {
    if (c.key === "bureauName") await db.bureau.updateMany({ data: { name: c.value } });
  }
  return { ok: true, payload: await getSystemPayload() };
}
