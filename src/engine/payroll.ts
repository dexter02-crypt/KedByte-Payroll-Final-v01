// ============================================================
// KEDBYTE PAYROLL — CALCULATION ENGINE
// Pure functions, zero I/O. 2026/27 statutory constants.
// Worked proof (§5.13) verified: £36k → net £2,305.44
// ============================================================

// ============ 5.1 STATUTORY CONSTANTS (2026/27) ============
export const TAX_YEAR = "2026-27";

export const STAT = {
  personalAllowance: 12570, // frozen → 2031
  emergencyCode: "1257L",
  // rUK bands (annual taxable)
  rukBasicRate: 0.2,
  rukBasicCeiling: 37700,
  rukHigherRate: 0.4,
  rukHigherCeiling: 112570, // PA withdrawn by 100k+£1:2
  rukAdditionalRate: 0.45,
  // NI monthly thresholds
  niLelMonthly: 559,
  niPtMonthly: 1048,
  niStMonthly: 417, // employer secondary threshold
  niUelMonthly: 4189,
  niFreeportUstMonthly: 2083,
  // NI rates
  niEeMainRate: 0.08,
  niEeUpperRate: 0.02,
  niEeReducedRate: 0.0185, // cat B
  niErRate: 0.15,
  // Employment Allowance
  employmentAllowance: 10500,
  // Auto-enrolment
  aeTriggerAnnual: 10000,
  aeTriggerMonthly: 833,
  aeQeLowerMonthly: 520,
  aeQeUpperMonthly: 4189.17,
  aeMinTotal: 0.08,
  aeMinEmployer: 0.03,
  // Student loans (annual thresholds)
  slPlan1Annual: 26900,
  slPlan2Annual: 29385,
  slPlan4Annual: 33795,
  slPlan5Annual: 25000,
  slRate: 0.09,
  pglAnnual: 21000,
  pglRate: 0.06,
  // Statutory pay
  sspWeeklyMax: 123.25,
  sspWeeklyMinFraction: 0.8,
  smpWeeklyFlat: 194.32, // weeks 7-39
  // NMW
  nlw21: 12.71,
  nmw18to20: 10.85,
  nmw16to17: 8.0,
  nmwApprentice: 8.0,
} as const;

// ============ 5.2 MONEY ROUNDING ============
/** Floor to whole pounds — taxable pay to date; student loan deduction */
export function floorPound(v: number): number {
  return Math.floor(v);
}

/** Floor to penny (truncate) — tax due to date */
export function floorPenny(v: number): number {
  return Math.floor(v * 100) / 100;
}

/** Nearest penny, half-penny rounds DOWN — every NI product */
export function niRound(v: number): number {
  // round half toward zero (half DOWN) — i.e. 0.5¢ → 0¢
  const cents = v * 100;
  const floored = Math.floor(cents);
  const frac = cents - floored;
  if (frac > 0.5) return (floored + 1) / 100;
  return floored / 100; // includes exact 0.5 → rounds down
}

/** Commercial 2dp — pension contributions, display sums */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ============ 5.3 TAX CODE PARSER ============
export interface ParsedTaxCode {
  raw: string;
  regime: "ruk" | "scotland" | "wales";
  week1Month1: boolean;
  isNt: boolean;
  isKCode: boolean;
  isFlat: boolean;
  flatRate?: number;
  annualFreePay: number; // for suffix codes (L/M/N/T)
  annualAdditionalPay: number; // for K codes
  code: string;
}

const FLAT_CODES: Record<string, { rate: number; regime: string }> = {
  BR: { rate: 0.2, regime: "ruk" },
  D0: { rate: 0.4, regime: "ruk" },
  D1: { rate: 0.45, regime: "ruk" },
  SBR: { rate: 0.2, regime: "scotland" },
  SD0: { rate: 0.21, regime: "scotland" },
  SD1: { rate: 0.42, regime: "scotland" },
  SD2: { rate: 0.45, regime: "scotland" },
  SD3: { rate: 0.48, regime: "scotland" },
  CBR: { rate: 0.2, regime: "wales" },
  CD0: { rate: 0.4, regime: "wales" },
  CD1: { rate: 0.45, regime: "wales" },
};

export function parseTaxCode(input: string): ParsedTaxCode {
  let raw = (input || "").toUpperCase().replace(/\s+/g, "");
  let regime: "ruk" | "scotland" | "wales" = "ruk";
  if (raw.startsWith("S")) {
    regime = "scotland";
    raw = raw.slice(1);
  } else if (raw.startsWith("C")) {
    // C prefix = Wales only if followed by flat code or number
    if (/^C\d/.test(raw) || raw === "C0T" || raw === "CBR" || raw === "CD0" || raw === "CD1") {
      regime = "wales";
      raw = raw.slice(1);
    }
  }

  // W1/M1 detection
  let week1Month1 = false;
  if (raw.endsWith("W1") || raw.endsWith("M1")) {
    week1Month1 = true;
    raw = raw.slice(0, -2);
  } else if (raw.endsWith("X") && raw.length > 1 && !FLAT_CODES[raw]) {
    week1Month1 = true;
    raw = raw.slice(0, -1);
  }

  // NT — no tax
  if (raw === "NT") {
    return {
      raw: input,
      regime,
      week1Month1,
      isNt: true,
      isKCode: false,
      isFlat: false,
      annualFreePay: 0,
      annualAdditionalPay: 0,
      code: input.toUpperCase().replace(/\s+/g, ""),
    };
  }

  // Flat codes
  if (FLAT_CODES[raw]) {
    return {
      raw: input,
      regime: FLAT_CODES[raw].regime as any,
      week1Month1,
      isNt: false,
      isKCode: false,
      isFlat: true,
      flatRate: FLAT_CODES[raw].rate,
      annualFreePay: 0,
      annualAdditionalPay: 0,
      code: input.toUpperCase().replace(/\s+/g, ""),
    };
  }

  // 0T — zero free pay
  if (raw === "0T") {
    return {
      raw: input,
      regime,
      week1Month1,
      isNt: false,
      isKCode: false,
      isFlat: false,
      annualFreePay: 0,
      annualAdditionalPay: 0,
      code: input.toUpperCase().replace(/\s+/g, ""),
    };
  }

  // K codes: K{n} → annualAdditionalPay = n×10+9
  const kMatch = raw.match(/^K(\d+)$/);
  if (kMatch) {
    return {
      raw: input,
      regime,
      week1Month1,
      isNt: false,
      isKCode: true,
      isFlat: false,
      annualFreePay: 0,
      annualAdditionalPay: parseInt(kMatch[1]) * 10 + 9,
      code: input.toUpperCase().replace(/\s+/g, ""),
    };
  }

  // Suffix codes: {n}[L|M|N|T] → annualFreePay = n×10+9
  const suffixMatch = raw.match(/^(\d+)([LMNT])$/);
  if (suffixMatch) {
    return {
      raw: input,
      regime,
      week1Month1,
      isNt: false,
      isKCode: false,
      isFlat: false,
      annualFreePay: parseInt(suffixMatch[1]) * 10 + 9,
      annualAdditionalPay: 0,
      code: input.toUpperCase().replace(/\s+/g, ""),
    };
  }

  // Unknown — throw (surface as field validation)
  throw new Error(`Unrecognised tax code: ${input}`);
}

// ============ 5.4 PAYE ============
export interface PayeInput {
  taxCode: string;
  period: number; // tax month 1..12 (W1/M1 ⇒ p=1)
  grossTaxableThisPeriod: number;
  ytdTaxable: number;
  ytdTaxPaid: number;
}

export interface PayeResult {
  tax: number;
  taxablePayToDate: number;
  freePayToDate: number;
  regulatoryLimited: boolean;
  code: string;
}

export function calculatePAYE(inp: PayeInput): PayeResult {
  const parsed = parseTaxCode(inp.taxCode);
  if (parsed.isNt) {
    return { tax: 0, taxablePayToDate: 0, freePayToDate: 0, regulatoryLimited: false, code: parsed.code };
  }

  const p = parsed.week1Month1 ? 1 : inp.period;
  const grossToDate = inp.ytdTaxable + inp.grossTaxableThisPeriod;
  const freePayToDate = round2((parsed.annualFreePay * p) / 12);
  const addlToDate = round2((parsed.annualAdditionalPay * p) / 12);
  const taxableToDate = floorPound(Math.max(0, grossToDate - freePayToDate + addlToDate));

  let taxDueToDate: number;
  if (parsed.isFlat && parsed.flatRate !== undefined) {
    taxDueToDate = floorPenny(floorPound(grossToDate) * parsed.flatRate);
  } else if (parsed.regime === "scotland") {
    taxDueToDate = scottishTax(taxableToDate, p);
  } else {
    // rUK (wales mirrors rUK today)
    taxDueToDate = rukTax(taxableToDate, p);
  }

  let tax = floorPenny(taxDueToDate - inp.ytdTaxPaid);

  // REGULATORY LIMIT (K & 0T protection): tax ≤ 50% × grossTaxableThisPeriod
  let regulatoryLimited = false;
  const cap = inp.grossTaxableThisPeriod * 0.5;
  if (tax > cap) {
    tax = floorPenny(cap);
    regulatoryLimited = true;
  }

  // Refund (negative) allowed through payroll
  return { tax, taxablePayToDate: taxableToDate, freePayToDate, regulatoryLimited, code: parsed.code };
}

function rukTax(taxableToDate: number, p: number): number {
  const basicCeiling = (STAT.rukBasicCeiling * p) / 12;
  const higherCeiling = (STAT.rukHigherCeiling * p) / 12;
  let tax = 0;
  if (taxableToDate <= basicCeiling) {
    tax = taxableToDate * STAT.rukBasicRate;
  } else if (taxableToDate <= higherCeiling) {
    tax = basicCeiling * STAT.rukBasicRate + (taxableToDate - basicCeiling) * STAT.rukHigherRate;
  } else {
    tax =
      basicCeiling * STAT.rukBasicRate +
      (higherCeiling - basicCeiling) * STAT.rukHigherRate +
      (taxableToDate - higherCeiling) * STAT.rukAdditionalRate;
  }
  return floorPenny(tax);
}

function scottishTax(taxableToDate: number, p: number): number {
  // Scottish bands (annual total) — pro-rated by period
  const bands = [
    { ceiling: 16537, rate: 0.19 }, // starter
    { ceiling: 29526, rate: 0.2 }, // basic
    { ceiling: 43662, rate: 0.21 }, // intermediate
    { ceiling: 75000, rate: 0.42 }, // higher
    { ceiling: 125140, rate: 0.45 }, // advanced
    { ceiling: Infinity, rate: 0.48 }, // top
  ];
  let tax = 0;
  let prevCeiling = 0;
  for (const band of bands) {
    const bandCeilingToDate = (band.ceiling * p) / 12;
    if (taxableToDate <= prevCeiling) break;
    const slice = Math.min(taxableToDate, bandCeilingToDate) - prevCeiling;
    if (slice > 0) tax += slice * band.rate;
    prevCeiling = bandCeilingToDate;
  }
  return floorPenny(tax);
}

// ============ 5.5 NATIONAL INSURANCE ============
export interface NiInput {
  niableGross: number; // gross − salary-sacrifice (RAS/net-pay don't reduce)
  category: string; // A | B | C | H | J | M | V | X | Z
}

export interface NiResult {
  employee: number;
  employer: number;
  earningsAtLel: number;
  earningsLelToPt: number;
  earningsPtToUel: number;
}

export function calculateNI(inp: NiInput): NiResult {
  const E = inp.niableGross;
  const cat = (inp.category || "A").toUpperCase();

  // Band figures (mandatory even when NI=0)
  const earningsAtLel = Math.min(E, STAT.niLelMonthly);
  const earningsLelToPt = Math.max(0, Math.min(E, STAT.niPtMonthly) - STAT.niLelMonthly);
  const earningsPtToUel = Math.max(0, Math.min(E, STAT.niUelMonthly) - STAT.niPtMonthly);

  let employee = 0;
  let employer = 0;

  // EMPLOYEE
  if (["A", "H", "M", "V"].includes(cat)) {
    const mainBand = Math.max(0, Math.min(E, STAT.niUelMonthly) - STAT.niPtMonthly);
    const upperBand = Math.max(0, E - STAT.niUelMonthly);
    employee = niRound(mainBand * STAT.niEeMainRate) + niRound(upperBand * STAT.niEeUpperRate);
  } else if (cat === "B") {
    const mainBand = Math.max(0, Math.min(E, STAT.niUelMonthly) - STAT.niPtMonthly);
    const upperBand = Math.max(0, E - STAT.niUelMonthly);
    employee = niRound(mainBand * STAT.niEeReducedRate) + niRound(upperBand * STAT.niEeUpperRate);
  } else if (["J", "Z"].includes(cat)) {
    const band = Math.max(0, E - STAT.niPtMonthly);
    employee = niRound(band * STAT.niEeUpperRate);
  } else if (["C", "X"].includes(cat)) {
    employee = 0;
  }

  // EMPLOYER (15% above threshold)
  let erThreshold: number;
  if (["A", "B", "C", "J"].includes(cat)) {
    erThreshold = STAT.niStMonthly;
  } else if (["H", "M", "V", "Z"].includes(cat)) {
    erThreshold = STAT.niUelMonthly; // 0% below — replaces ST
  } else if (cat === "X") {
    erThreshold = Infinity;
  } else {
    erThreshold = STAT.niStMonthly;
  }
  const erBand = Math.max(0, E - erThreshold);
  employer = niRound(erBand * STAT.niErRate);

  return { employee, employer, earningsAtLel, earningsLelToPt, earningsPtToUel };
}

// ============ 5.6 STUDENT LOANS ============
export interface StudentLoanResult {
  studentLoan: number;
  postgradLoan: number;
}

export function calculateStudentLoan(
  niableGross: number,
  plan?: string | null,
  postgrad?: boolean
): StudentLoanResult {
  let studentLoan = 0;
  let postgradLoan = 0;

  if (plan) {
    let annualThreshold: number;
    switch (plan) {
      case "plan_1":
        annualThreshold = STAT.slPlan1Annual;
        break;
      case "plan_2":
        annualThreshold = STAT.slPlan2Annual;
        break;
      case "plan_4":
        annualThreshold = STAT.slPlan4Annual;
        break;
      case "plan_5":
        annualThreshold = STAT.slPlan5Annual;
        break;
      default:
        annualThreshold = STAT.slPlan5Annual;
    }
    const monthlyThreshold = annualThreshold / 12;
    studentLoan = floorPound(Math.max(0, niableGross - monthlyThreshold) * STAT.slRate);
  }

  if (postgrad) {
    const monthlyThreshold = STAT.pglAnnual / 12;
    postgradLoan = floorPound(Math.max(0, niableGross - monthlyThreshold) * STAT.pglRate);
  }

  return { studentLoan, postgradLoan };
}

// ============ 5.7 PENSIONS ============
export interface PensionInput {
  earnings: number;
  basis: string; // qualifying_earnings | pensionable_full | total_earnings
  relief: string; // relief_at_source | net_pay | salary_sacrifice
  eeRate: number;
  erRate: number;
}

export interface PensionResult {
  pensionableEarnings: number;
  eeGross: number;
  eeDeducted: number;
  er: number;
  reducesTaxable: number;
  reducesNIable: number;
}

export function calculatePension(inp: PensionInput): PensionResult {
  let base: number;
  if (inp.basis === "qualifying_earnings") {
    base = Math.max(0, Math.min(inp.earnings, STAT.aeQeUpperMonthly) - STAT.aeQeLowerMonthly);
  } else {
    base = inp.earnings;
  }
  let eeGross = round2(base * inp.eeRate);
  let er = round2(base * inp.erRate);

  let eeDeducted = 0;
  let reducesTaxable = 0;
  let reducesNIable = 0;

  if (inp.relief === "relief_at_source") {
    eeDeducted = round2(eeGross * 0.8);
  } else if (inp.relief === "net_pay") {
    eeDeducted = eeGross;
    reducesTaxable = eeGross;
  } else if (inp.relief === "salary_sacrifice") {
    eeDeducted = 0;
    er = round2(er + eeGross);
    reducesTaxable = eeGross;
    reducesNIable = eeGross;
  }

  return { pensionableEarnings: base, eeGross, eeDeducted, er, reducesTaxable, reducesNIable };
}

// ============ 5.7 AE ASSESSMENT ============
export function assessAutoEnrolment(age: number, monthlyEarnings: number): {
  result: "eligible" | "non_eligible" | "entitled";
  action: "enrolled" | "postponed" | "none";
} {
  const spa = 67;
  if (age >= 22 && age <= spa && monthlyEarnings > STAT.aeTriggerMonthly) {
    return { result: "eligible", action: "enrolled" };
  }
  if (age >= 16 && age <= 74 && monthlyEarnings > STAT.aeTriggerMonthly) {
    return { result: "non_eligible", action: "none" };
  }
  if (age >= 16 && age <= 74 && monthlyEarnings <= STAT.aeQeUpperMonthly && monthlyEarnings > 0) {
    return { result: "entitled", action: "none" };
  }
  return { result: "entitled", action: "none" };
}

// ============ 5.9 GROSS ASSEMBLY & NET ============
export interface GrossInput {
  salaryAnnual: number;
  contractedWeeklyHours: number;
  overtimeHours: number;
  overtimeMultiplier: number;
  bonus: number;
  commission: number;
  statutoryPay: number;
  adjustments: { label: string; amount: number; taxable: boolean; niable: boolean }[];
  workingDaysEmployed?: number;
  workingDaysInPeriod?: number;
}

export interface GrossResult {
  hourly: number;
  basic: number;
  overtime: number;
  gross: number;
  adjustmentsTotal: number;
}

export function assembleGross(inp: GrossInput): GrossResult {
  const hourly = inp.salaryAnnual / 52 / inp.contractedWeeklyHours;
  let basic = inp.salaryAnnual / 12;
  if (
    inp.workingDaysEmployed !== undefined &&
    inp.workingDaysInPeriod !== undefined &&
    inp.workingDaysInPeriod > 0 &&
    inp.workingDaysEmployed < inp.workingDaysInPeriod
  ) {
    basic = round2((basic * inp.workingDaysEmployed) / inp.workingDaysInPeriod);
  }
  const overtime = inp.overtimeHours * hourly * inp.overtimeMultiplier;
  const adjustmentsTotal = inp.adjustments.reduce((s, a) => s + a.amount, 0);
  const gross = round2(
    basic + overtime + inp.bonus + inp.commission + inp.statutoryPay + adjustmentsTotal
  );
  return { hourly: round2(hourly), basic: round2(basic), overtime: round2(overtime), gross, adjustmentsTotal: round2(adjustmentsTotal) };
}

// ============ ORCHESTRATOR ============
export interface CalculateEmployeeInput {
  salaryAnnual: number;
  contractedWeeklyHours: number;
  taxCode: string;
  niCategory: string;
  studentLoanPlan?: string | null;
  postgradLoan?: boolean;
  pensionEnrolled: boolean;
  period: number;
  overtimeHours: number;
  overtimeMultiplier: number;
  bonus: number;
  commission: number;
  statutoryPay: number;
  adjustments: { label: string; amount: number; taxable: boolean; niable: boolean }[];
  ytdTaxable: number;
  ytdTaxPaid: number;
  pensionBasis: string;
  pensionRelief: string;
  pensionEeRate: number;
  pensionErRate: number;
  prevNet?: number;
}

export interface CalculateEmployeeResult {
  hourly: number;
  basic: number;
  overtime: number;
  gross: number;
  taxableGross: number;
  niableGross: number;
  tax: number;
  niEmployee: number;
  niEmployer: number;
  pensionEmployee: number;
  pensionEmployer: number;
  pensionEeGross: number;
  studentLoan: number;
  postgradLoan: number;
  net: number;
  employerCost: number;
  earningsAtLel: number;
  earningsLelPt: number;
  earningsPtUel: number;
  variancePct: number | null;
  varianceFlag: "none" | "warn" | "error";
  log: EngineLogLine[];
}

export interface EngineLogLine {
  ts: string;
  text: string;
  level: "info" | "ok" | "warn" | "error";
}

export function calculateEmployee(inp: CalculateEmployeeInput): CalculateEmployeeResult {
  const log: EngineLogLine[] = [];
  const ts = () => new Date().toISOString().slice(11, 23);
  const push = (text: string, level: EngineLogLine["level"] = "info") =>
    log.push({ ts: ts(), text, level });

  push(`> INITIALIZING PAY RUN ENGINE…`);
  push(`> LOADING TAX CODES AND THRESHOLDS… OK`, "ok");
  push(`> Tax year 2026/27 · Period M${inp.period}`);

  const grossR = assembleGross({
    salaryAnnual: inp.salaryAnnual,
    contractedWeeklyHours: inp.contractedWeeklyHours,
    overtimeHours: inp.overtimeHours,
    overtimeMultiplier: inp.overtimeMultiplier,
    bonus: inp.bonus,
    commission: inp.commission,
    statutoryPay: inp.statutoryPay,
    adjustments: inp.adjustments,
  });
  push(`> Gross assembled: £${grossR.gross.toFixed(2)} (basic ${grossR.basic.toFixed(2)} + OT ${grossR.overtime.toFixed(2)} + adjustments ${grossR.adjustmentsTotal.toFixed(2)})`);

  let pensionR: PensionResult | null = null;
  if (inp.pensionEnrolled) {
    pensionR = calculatePension({
      earnings: grossR.gross,
      basis: inp.pensionBasis,
      relief: inp.pensionRelief,
      eeRate: inp.pensionEeRate,
      erRate: inp.pensionErRate,
    });
    push(`> Pension [${inp.pensionBasis}/${inp.pensionRelief}]: pensionable £${pensionR.pensionableEarnings.toFixed(2)} · EE deducted £${pensionR.eeDeducted.toFixed(2)} · ER £${pensionR.er.toFixed(2)}`);
  }

  const taxableGross = round2(grossR.gross - (pensionR?.reducesTaxable || 0));
  const niableGross = round2(grossR.gross - (pensionR?.reducesNIable || 0));
  push(`> Taxable gross £${taxableGross.toFixed(2)} · NI-able gross £${niableGross.toFixed(2)}`);

  const payeR = calculatePAYE({
    taxCode: inp.taxCode,
    period: inp.period,
    grossTaxableThisPeriod: taxableGross,
    ytdTaxable: inp.ytdTaxable,
    ytdTaxPaid: inp.ytdTaxPaid,
  });
  push(`> PAYE [${payeR.code}]: tax £${payeR.tax.toFixed(2)}${payeR.regulatoryLimited ? " (regulatory-limited 50%)" : ""}`);

  const niR = calculateNI({ niableGross, category: inp.niCategory });
  push(`> NI [cat ${inp.niCategory}]: EE £${niR.employee.toFixed(2)} · ER £${niR.employer.toFixed(2)}`);

  const slR = calculateStudentLoan(niableGross, inp.studentLoanPlan, inp.postgradLoan);
  if (inp.studentLoanPlan) {
    push(`> Student loan [${inp.studentLoanPlan}]: £${slR.studentLoan.toFixed(2)}`);
  }
  if (inp.postgradLoan) {
    push(`> Postgraduate loan: £${slR.postgradLoan.toFixed(2)}`);
  }

  const net = round2(
    grossR.gross -
      payeR.tax -
      niR.employee -
      (pensionR?.eeDeducted || 0) -
      slR.studentLoan -
      slR.postgradLoan
  );
  const employerCost = round2(grossR.gross + niR.employer + (pensionR?.er || 0));

  push(`> NET PAY £${net.toFixed(2)} · EMPLOYER COST £${employerCost.toFixed(2)}`, "ok");

  let variancePct: number | null = null;
  let varianceFlag: "none" | "warn" | "error" = "none";
  if (inp.prevNet !== undefined && inp.prevNet > 0) {
    variancePct = round2(((net - inp.prevNet) / inp.prevNet) * 100);
    if (Math.abs(variancePct) > 50) varianceFlag = "error";
    else if (Math.abs(variancePct) > 20) varianceFlag = "warn";
    if (varianceFlag !== "none") {
      push(`> Variance ${variancePct > 0 ? "+" : ""}${variancePct}% vs prior period — ${varianceFlag.toUpperCase()}`, varianceFlag === "error" ? "error" : "warn");
    }
  }

  push(`> Record complete ✓`, "ok");

  return {
    hourly: grossR.hourly,
    basic: grossR.basic,
    overtime: grossR.overtime,
    gross: grossR.gross,
    taxableGross,
    niableGross,
    tax: payeR.tax,
    niEmployee: niR.employee,
    niEmployer: niR.employer,
    pensionEmployee: pensionR?.eeDeducted || 0,
    pensionEmployer: pensionR?.er || 0,
    pensionEeGross: pensionR?.eeGross || 0,
    studentLoan: slR.studentLoan,
    postgradLoan: slR.postgradLoan,
    net,
    employerCost,
    earningsAtLel: niR.earningsAtLel,
    earningsLelPt: niR.earningsLelToPt,
    earningsPtUel: niR.earningsPtToUel,
    variancePct,
    varianceFlag,
    log,
  };
}

// ============ 5.10 PAY DATES / BACS ============
export function resolvePayDate(
  year: number,
  month: number,
  rule: string,
  fixedDay?: number,
  earlyPay = true,
  bankHolidays: Date[] = []
): Date {
  const isNonWorking = (d: Date) => {
    const day = d.getDay();
    if (day === 0 || day === 6) return true;
    return bankHolidays.some((bh) => bh.toDateString() === d.toDateString());
  };

  if (rule === "monthly_last_working_day") {
    const lastDay = new Date(year, month, 0);
    let d = new Date(lastDay);
    while (isNonWorking(d)) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  }
  if (rule === "fixed_date" && fixedDay) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const day = Math.min(fixedDay, daysInMonth);
    let d = new Date(year, month - 1, day);
    if (isNonWorking(d)) {
      if (earlyPay) {
        while (isNonWorking(d)) d.setDate(d.getDate() - 1);
      } else {
        while (isNonWorking(d)) d.setDate(d.getDate() + 1);
      }
    }
    return d;
  }
  return new Date(year, month, 0);
}

export function bacsSubmissionDate(payDate: Date, bankHolidays: Date[] = []): Date {
  const isNonWorking = (d: Date) => {
    const day = d.getDay();
    if (day === 0 || day === 6) return true;
    return bankHolidays.some((bh) => bh.toDateString() === d.toDateString());
  };
  let d = new Date(payDate);
  let count = 0;
  while (count < 2) {
    d.setDate(d.getDate() - 1);
    if (!isNonWorking(d)) count++;
  }
  return d;
}

// ============ 5.11 VALIDATORS ============
export function validateNINO(nino: string): boolean {
  const cleaned = (nino || "").replace(/\s+/g, "").toUpperCase();
  return /^(?!BG|GB|NK|KN|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/.test(cleaned);
}

export function maskNINO(nino?: string | null): string {
  if (!nino) return "—";
  const cleaned = nino.replace(/\s+/g, "").toUpperCase();
  if (cleaned.length < 8) return cleaned;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} •• •• ${cleaned.slice(7)}`;
}

export function validatePAYERef(ref: string): boolean {
  return /^\d{3}\/[A-Z0-9]{1,10}$/.test((ref || "").toUpperCase());
}

export function validateAORef(ref: string): boolean {
  return /^\d{3}P[A-Z]\d{7}[0-9X]$/.test((ref || "").toUpperCase());
}

export function validateSortCode(sc: string): boolean {
  return /^\d{6}$/.test((sc || "").replace(/[-\s]/g, ""));
}

export function validateAccount(acc: string): boolean {
  const digits = (acc || "").replace(/\s/g, "");
  return /^\d{6,8}$/.test(digits);
}

// ============ WORKED PROOF VERIFICATION (§5.13) ============
export function verifyWorkedProof(): {
  passed: boolean;
  results: Record<string, { expected: number; actual: number; ok: boolean }>;
} {
  const r = calculateEmployee({
    salaryAnnual: 36000,
    contractedWeeklyHours: 37.5,
    taxCode: "1257L",
    niCategory: "A",
    studentLoanPlan: "plan_2",
    postgradLoan: false,
    pensionEnrolled: true,
    period: 1,
    overtimeHours: 0,
    overtimeMultiplier: 1.5,
    bonus: 0,
    commission: 0,
    statutoryPay: 0,
    adjustments: [],
    ytdTaxable: 0,
    ytdTaxPaid: 0,
    pensionBasis: "qualifying_earnings",
    pensionRelief: "relief_at_source",
    pensionEeRate: 0.05,
    pensionErRate: 0.03,
  });

  const checks = {
    gross: { expected: 3000.0, actual: r.gross },
    tax: { expected: 390.2, actual: r.tax },
    niEmployee: { expected: 156.16, actual: r.niEmployee },
    niEmployer: { expected: 387.45, actual: r.niEmployer },
    pensionEmployee: { expected: 99.2, actual: r.pensionEmployee },
    pensionEmployer: { expected: 74.4, actual: r.pensionEmployer },
    studentLoan: { expected: 49.0, actual: r.studentLoan },
    net: { expected: 2305.44, actual: r.net },
    employerCost: { expected: 3461.85, actual: r.employerCost },
  };

  const results: any = {};
  let passed = true;
  for (const [k, v] of Object.entries(checks)) {
    const ok = Math.abs(v.actual - v.expected) < 0.01;
    results[k] = { expected: v.expected, actual: v.actual, ok };
    if (!ok) passed = false;
  }
  return { passed, results };
}
