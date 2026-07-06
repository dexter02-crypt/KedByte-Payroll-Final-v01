import { db } from "@/lib/db";

// Seed Kedbyte Payroll with realistic UK payroll data for 2026/27
export async function seedDatabase() {
  // Check if already seeded
  const existing = await db.bureau.count();
  if (existing > 0) return { seeded: false, reason: "already seeded" };

  // ============ BUREAU ============
  const bureau = await db.bureau.create({
    data: { id: "bureau_kedbyte", name: "Kedbyte Payroll Bureau", status: "active" },
  });

  // ============ USERS ============
  // Simple hash for demo (NOT Argon2id — prod uses proper hashing)
  const demoHash = "$2a$demo$kedbyte$payroll$bureau$hash"; // placeholder
  await db.user.createMany({
    data: [
      {
        id: "user_admin",
        tenantId: bureau.id,
        email: "admin@kedbyte.co.uk",
        passwordHash: demoHash,
        role: "bureau_admin",
        status: "active",
      },
      {
        id: "user_smith_admin",
        tenantId: bureau.id,
        email: "admin@smithco.co.uk",
        passwordHash: demoHash,
        role: "company_admin",
        companyId: "comp_smith",
        status: "active",
      },
      {
        id: "user_eleanor",
        tenantId: bureau.id,
        email: "eleanor@smithco.co.uk",
        passwordHash: demoHash,
        role: "employee",
        employeeId: "emp_eleanor",
        companyId: "comp_smith",
        isManager: true,
        status: "active",
      },
      {
        id: "user_james",
        tenantId: bureau.id,
        email: "james@smithco.co.uk",
        passwordHash: demoHash,
        role: "employee",
        employeeId: "emp_james",
        companyId: "comp_smith",
        status: "active",
      },
      {
        id: "user_priya",
        tenantId: bureau.id,
        email: "priya@acme.io",
        passwordHash: demoHash,
        role: "employee",
        employeeId: "emp_priya",
        companyId: "comp_acme",
        status: "active",
      },
    ],
  });

  // ============ COMPANIES ============
  const smith = await db.company.create({
    data: {
      id: "comp_smith",
      tenantId: bureau.id,
      name: "Smith & Co Ltd",
      payeRef: "123/AB456",
      accountsOfficeRef: "123PA0001234X",
      addressLine1: "14 Cannon Street",
      addressCity: "London",
      addressPostcode: "EC4M 6XH",
      bankSortCode: "200000",
      bankAccount: "12345678",
      bankAccountName: "Smith & Co Ltd",
      region: "england_wales",
      paySchedule: "monthly_last_working_day",
      earlyPay: true,
      smallEmployer: false,
      employmentAllowance: true,
      status: "active",
    },
  });

  const acme = await db.company.create({
    data: {
      id: "comp_acme",
      tenantId: bureau.id,
      name: "Acme Corp UK Ltd",
      payeRef: "456/XY789",
      accountsOfficeRef: "456PA0009876X",
      addressLine1: "2 Finsbury Avenue",
      addressCity: "London",
      addressPostcode: "EC2M 2PA",
      bankSortCode: "404758",
      bankAccount: "87654321",
      bankAccountName: "Acme Corp UK Ltd",
      region: "england_wales",
      paySchedule: "fixed_date",
      payDateDay: 28,
      earlyPay: true,
      status: "active",
    },
  });

  const northwind = await db.company.create({
    data: {
      id: "comp_northwind",
      tenantId: bureau.id,
      name: "Northwind Trading plc",
      payeRef: "789/ZW012",
      accountsOfficeRef: "789PA0005555X",
      addressLine1: "5 Regent Street",
      addressCity: "Manchester",
      addressPostcode: "M1 4AF",
      bankSortCode: "070116",
      bankAccount: "33334444",
      bankAccountName: "Northwind Trading plc",
      region: "england_wales",
      paySchedule: "monthly_last_working_day",
      status: "active",
    },
  });

  // ============ PENSION SCHEMES ============
  await db.pensionScheme.createMany({
    data: [
      {
        tenantId: bureau.id,
        companyId: smith.id,
        provider: "NEST",
        schemeRef: "NEST-SMITH-001",
        basis: "qualifying_earnings",
        relief: "relief_at_source",
        eeRate: 0.05,
        erRate: 0.03,
      },
      {
        tenantId: bureau.id,
        companyId: acme.id,
        provider: "Aviva",
        schemeRef: "AVIVA-ACME-229",
        basis: "qualifying_earnings",
        relief: "relief_at_source",
        eeRate: 0.05,
        erRate: 0.03,
      },
      {
        tenantId: bureau.id,
        companyId: northwind.id,
        provider: "Smart",
        schemeRef: "SMART-NW-118",
        basis: "qualifying_earnings",
        relief: "net_pay",
        eeRate: 0.05,
        erRate: 0.03,
      },
    ],
  });

  // ============ EMPLOYEES ============
  const employees = [
    // Smith & Co
    {
      id: "emp_eleanor", companyId: smith.id, tenantId: bureau.id, managerId: null,
      payrollId: "EMP-00142", firstName: "Eleanor", lastName: "Vance",
      email: "eleanor@smithco.co.uk", dob: "1985-05-14", gender: "F",
      nino: "AB123456C", addressLine1: "22 Baker Street", addressCity: "London", addressPostcode: "W1U 3BW",
      phone: "+44 7700 900123", emergencyContact: "Mark Vance +44 7700 900456",
      startDate: "2021-03-01", salaryAnnual: 36000, contractedWeeklyHours: 37.5,
      department: "Finance", jobTitle: "Senior Accountant", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: "plan_2", postgradLoan: false,
      bankSortCode: "401201", bankAccount: "11223344", bankAccountName: "Eleanor Vance",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2021-03-01",
      holidayEntitlementDays: 28, holidayUsedDays: 6, status: "active",
    },
    {
      id: "emp_james", companyId: smith.id, tenantId: bureau.id, managerId: "emp_eleanor",
      payrollId: "EMP-00143", firstName: "James", lastName: "Okafor",
      email: "james@smithco.co.uk", dob: "1992-09-22", gender: "M",
      nino: "JW987654A", addressLine1: "8 Camden Road", addressCity: "London", addressPostcode: "N7 0JG",
      phone: "+44 7700 900789", emergencyContact: "Sarah Okafor +44 7700 900000",
      startDate: "2023-06-12", salaryAnnual: 42000, contractedWeeklyHours: 37.5,
      department: "Finance", jobTitle: "Accountant", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: "plan_1", postgradLoan: false,
      bankSortCode: "200265", bankAccount: "55667788", bankAccountName: "James Okafor",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2023-06-12",
      holidayEntitlementDays: 28, holidayUsedDays: 10, status: "active",
    },
    {
      id: "emp_maria", companyId: smith.id, tenantId: bureau.id, managerId: "emp_eleanor",
      payrollId: "EMP-00144", firstName: "Maria", lastName: "Garcia",
      email: "maria@smithco.co.uk", dob: "1990-11-03", gender: "F",
      nino: "MG567890B", addressLine1: "15 Kensington High St", addressCity: "London", addressPostcode: "W8 5NP",
      phone: "+44 7700 900111", emergencyContact: "Luis Garcia +44 7700 900222",
      startDate: "2022-01-17", salaryAnnual: 52000, contractedWeeklyHours: 37.5,
      department: "Operations", jobTitle: "Operations Manager", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: null, postgradLoan: true,
      bankSortCode: "090065", bankAccount: "99887766", bankAccountName: "Maria Garcia",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2022-01-17",
      holidayEntitlementDays: 28, holidayUsedDays: 14, status: "active",
    },
    {
      id: "emp_tom", companyId: smith.id, tenantId: bureau.id, managerId: "emp_maria",
      payrollId: "EMP-00145", firstName: "Thomas", lastName: "Bell",
      email: "tom@smithco.co.uk", dob: "1998-07-30", gender: "M",
      nino: "TB123456D", addressLine1: "3 Greenwich Park St", addressCity: "London", addressPostcode: "SE10 9NW",
      phone: "+44 7700 900333", emergencyContact: "Anna Bell +44 7700 900444",
      startDate: "2024-02-05", salaryAnnual: 28000, contractedWeeklyHours: 37.5,
      department: "Operations", jobTitle: "Operations Coordinator", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: "plan_5", postgradLoan: false,
      bankSortCode: "608301", bankAccount: "11224455", bankAccountName: "Thomas Bell",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2024-02-05",
      holidayEntitlementDays: 28, holidayUsedDays: 4, status: "active",
    },
    {
      id: "emp_sophie", companyId: smith.id, tenantId: bureau.id, managerId: "emp_eleanor",
      payrollId: "EMP-00146", firstName: "Sophie", lastName: "Chen",
      email: "sophie@smithco.co.uk", dob: "1995-04-18", gender: "F",
      nino: "SC456789A", addressLine1: "9 Canary Wharf", addressCity: "London", addressPostcode: "E14 5AB",
      phone: "+44 7700 900555", emergencyContact: "Wei Chen +44 7700 900666",
      startDate: "2023-09-01", salaryAnnual: 45000, contractedWeeklyHours: 37.5,
      department: "Finance", jobTitle: "Financial Analyst", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: "plan_2", postgradLoan: false,
      bankSortCode: "231470", bankAccount: "77889900", bankAccountName: "Sophie Chen",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2023-09-01",
      holidayEntitlementDays: 28, holidayUsedDays: 8, status: "active",
    },
    // Acme Corp
    {
      id: "emp_priya", companyId: acme.id, tenantId: bureau.id, managerId: null,
      payrollId: "EMP-00201", firstName: "Priya", lastName: "Sharma",
      email: "priya@acme.io", dob: "1988-12-10", gender: "F",
      nino: "PS678901B", addressLine1: "44 Old Street", addressCity: "London", addressPostcode: "EC1V 9AB",
      phone: "+44 7700 901111", emergencyContact: "Raj Sharma +44 7700 901222",
      startDate: "2020-08-15", salaryAnnual: 62000, contractedWeeklyHours: 37.5,
      department: "Engineering", jobTitle: "Engineering Lead", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: "plan_1", postgradLoan: false,
      bankSortCode: "050008", bankAccount: "12341234", bankAccountName: "Priya Sharma",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2020-08-15",
      holidayEntitlementDays: 28, holidayUsedDays: 12, status: "active",
    },
    {
      id: "emp_david", companyId: acme.id, tenantId: bureau.id, managerId: "emp_priya",
      payrollId: "EMP-00202", firstName: "David", lastName: "Murphy",
      email: "david@acme.io", dob: "1993-03-25", gender: "M",
      nino: "JM234567C", addressLine1: "11 Liverpool St", addressCity: "London", addressPostcode: "EC2M 7PY",
      phone: "+44 7700 901333", emergencyContact: "Emma Murphy +44 7700 901444",
      startDate: "2022-11-01", salaryAnnual: 55000, contractedWeeklyHours: 37.5,
      department: "Engineering", jobTitle: "Senior Engineer", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: "plan_2", postgradLoan: false,
      bankSortCode: "160049", bankAccount: "56785678", bankAccountName: "David Murphy",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2022-11-01",
      holidayEntitlementDays: 28, holidayUsedDays: 6, status: "active",
    },
    // Northwind
    {
      id: "emp_olivia", companyId: northwind.id, tenantId: bureau.id, managerId: null,
      payrollId: "EMP-00301", firstName: "Olivia", lastName: "Hayes",
      email: "olivia@northwind.co.uk", dob: "1987-06-19", gender: "F",
      nino: "LH345678A", addressLine1: "27 Deansgate", addressCity: "Manchester", addressPostcode: "M3 2BW",
      phone: "+44 7700 902111", emergencyContact: "Chris Hayes +44 7700 902222",
      startDate: "2019-04-01", salaryAnnual: 48000, contractedWeeklyHours: 37.5,
      department: "Sales", jobTitle: "Sales Director", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: null, postgradLoan: false,
      bankSortCode: "070093", bankAccount: "90909090", bankAccountName: "Olivia Hayes",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2019-04-01",
      holidayEntitlementDays: 28, holidayUsedDays: 16, status: "active",
    },
    {
      id: "emp_alex", companyId: northwind.id, tenantId: bureau.id, managerId: "emp_olivia",
      payrollId: "EMP-00302", firstName: "Alex", lastName: "Turner",
      email: "alex@northwind.co.uk", dob: "1996-10-08", gender: "M",
      nino: "AT456789B", addressLine1: "5 Piccadilly", addressCity: "Manchester", addressPostcode: "M1 2AP",
      phone: "+44 7700 902333", emergencyContact: "Lisa Turner +44 7700 902444",
      startDate: "2023-03-20", salaryAnnual: 32000, contractedWeeklyHours: 37.5,
      department: "Sales", jobTitle: "Sales Executive", employmentType: "full_time",
      taxCode: "1257L", taxBasis: "cumul", niCategory: "A",
      studentLoanPlan: "plan_4", postgradLoan: false,
      bankSortCode: "161027", bankAccount: "34343434", bankAccountName: "Alex Turner",
      pensionStatus: "enrolled", pensionEnrolmentDate: "2023-03-20",
      holidayEntitlementDays: 28, holidayUsedDays: 2, status: "active",
    },
  ];

  for (const emp of employees) {
    await db.employee.create({
      data: {
        ...emp,
        dob: new Date(emp.dob),
        startDate: new Date(emp.startDate),
        pensionEnrolmentDate: emp.pensionEnrolmentDate ? new Date(emp.pensionEnrolmentDate) : null,
        worksPatternMon: true, worksPatternTue: true, worksPatternWed: true,
        worksPatternThu: true, worksPatternFri: true, worksPatternSat: false, worksPatternSun: false,
      } as any,
    });
  }

  // ============ AE ASSESSMENTS ============
  for (const emp of employees) {
    const age = new Date().getFullYear() - new Date(emp.dob).getFullYear();
    const monthly = emp.salaryAnnual / 12;
    const result =
      age >= 22 && age <= 67 && monthly > 833
        ? "eligible"
        : monthly <= 4189.17
        ? "entitled"
        : "non_eligible";
    await db.aeAssessment.create({
      data: {
        tenantId: bureau.id,
        employeeId: emp.id,
        assessedOn: new Date("2026-04-06"),
        age,
        monthlyEarnings: monthly,
        result,
        action: result === "eligible" ? "enrolled" : "none",
      },
    });
  }

  // ============ PAY RUNS (historical for YTD) ============
  // Smith & Co — completed periods 1-3 + draft period 4
  for (let period = 1; period <= 3; period++) {
    const periodStart = new Date(2026, period - 1 + 3, 6); // tax month starts 6th
    const periodEnd = new Date(2026, period + 3, 5);
    const payDate = new Date(2026, period + 3, 0); // last day of calendar month
    const smithEmps = employees.filter((e) => e.companyId === smith.id);
    const payRun = await db.payRun.create({
      data: {
        id: `pr_smith_2026_${period}`,
        tenantId: bureau.id,
        companyId: smith.id,
        taxYear: "2026-27",
        taxPeriod: period,
        periodStart, periodEnd, payDate,
        bacsSubmissionDate: new Date(2026, period + 3, -2),
        status: "committed",
        committedAt: new Date(2026, period + 3, 0, 12),
        totalsJson: "{}",
      },
    });

    let totals = { gross: 0, tax: 0, niEe: 0, niEr: 0, pensEe: 0, pensEr: 0, net: 0, employerCost: 0 };
    for (const emp of smithEmps) {
      // Run the engine for historical entries
      const { calculateEmployee } = await import("@/engine/payroll");
      const res = calculateEmployee({
        salaryAnnual: emp.salaryAnnual,
        contractedWeeklyHours: emp.contractedWeeklyHours,
        taxCode: emp.taxCode,
        niCategory: emp.niCategory,
        studentLoanPlan: emp.studentLoanPlan,
        postgradLoan: emp.postgradLoan,
        pensionEnrolled: emp.pensionStatus === "enrolled",
        period,
        overtimeHours: period === 2 ? 8 : 0,
        overtimeMultiplier: 1.5,
        bonus: period === 3 ? 200 : 0,
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
      await db.payRunEntry.create({
        data: {
          tenantId: bureau.id,
          payRunId: payRun.id,
          employeeId: emp.id,
          overtimeHours: period === 2 ? 8 : 0,
          bonus: period === 3 ? 200 : 0,
          gross: res.gross, taxableGross: res.taxableGross, niableGross: res.niableGross,
          tax: res.tax, niEmployee: res.niEmployee, niEmployer: res.niEmployer,
          pensionEmployee: res.pensionEmployee, pensionEmployer: res.pensionEmployer,
          studentLoan: res.studentLoan, postgradLoan: res.postgradLoan, net: res.net,
          earningsAtLel: res.earningsAtLel, earningsLelPt: res.earningsLelPt, earningsPtUel: res.earningsPtUel,
          status: "approved", prevNet: res.net,
        },
      });
      totals.gross += res.gross; totals.tax += res.tax; totals.niEe += res.niEmployee;
      totals.niEr += res.niEmployer; totals.pensEe += res.pensionEmployee;
      totals.pensEr += res.pensionEmployer; totals.net += res.net; totals.employerCost += res.employerCost;
    }
    await db.payRun.update({ where: { id: payRun.id }, data: { totalsJson: JSON.stringify(totals) } });

    // YTD figures
    for (const emp of smithEmps) {
      const entry = await db.payRunEntry.findFirst({
        where: { payRunId: payRun.id, employeeId: emp.id },
      });
      if (entry) {
        const existing = await db.ytdFigure.findUnique({
          where: { employeeId_taxYear: { employeeId: emp.id, taxYear: "2026-27" } },
        });
        await db.ytdFigure.upsert({
          where: { employeeId_taxYear: { employeeId: emp.id, taxYear: "2026-27" } },
          create: {
            employeeId: emp.id, taxYear: "2026-27",
            taxable: entry.taxableGross || 0, taxPaid: entry.tax || 0,
            niable: entry.niableGross || 0, niEe: entry.niEmployee || 0, niEr: entry.niEmployer || 0,
            pensionEe: entry.pensionEmployee || 0, pensionEr: entry.pensionEmployer || 0,
            studentLoan: entry.studentLoan || 0, postgradLoan: entry.postgradLoan || 0,
            gross: entry.gross || 0, net: entry.net || 0, lastPeriod: period,
          },
          update: {
            taxable: { increment: entry.taxableGross || 0 }, taxPaid: { increment: entry.tax || 0 },
            niable: { increment: entry.niableGross || 0 }, niEe: { increment: entry.niEmployee || 0 },
            niEr: { increment: entry.niEmployer || 0 }, pensionEe: { increment: entry.pensionEmployee || 0 },
            pensionEr: { increment: entry.pensionEmployer || 0 }, studentLoan: { increment: entry.studentLoan || 0 },
            postgradLoan: { increment: entry.postgradLoan || 0 }, gross: { increment: entry.gross || 0 },
            net: { increment: entry.net || 0 }, lastPeriod: period,
          },
        });
      }
    }
  }

  // Acme — one committed period
  const acmePayRun = await db.payRun.create({
    data: {
      id: "pr_acme_2026_3",
      tenantId: bureau.id, companyId: acme.id, taxYear: "2026-27", taxPeriod: 3,
      periodStart: new Date(2026, 5, 6), periodEnd: new Date(2026, 6, 5),
      payDate: new Date(2026, 6, 28), bacsSubmissionDate: new Date(2026, 6, 25),
      status: "committed", committedAt: new Date(2026, 6, 28, 12), totalsJson: "{}",
    },
  });
  const { calculateEmployee } = await import("@/engine/payroll");
  let acmeTotals = { gross: 0, tax: 0, niEe: 0, niEr: 0, pensEe: 0, pensEr: 0, net: 0, employerCost: 0 };
  for (const emp of employees.filter((e) => e.companyId === acme.id)) {
    const res = calculateEmployee({
      salaryAnnual: emp.salaryAnnual, contractedWeeklyHours: 37.5, taxCode: emp.taxCode,
      niCategory: emp.niCategory, studentLoanPlan: emp.studentLoanPlan, postgradLoan: emp.postgradLoan,
      pensionEnrolled: emp.pensionStatus === "enrolled", period: 3, overtimeHours: 0, overtimeMultiplier: 1.5,
      bonus: 0, commission: 0, statutoryPay: 0, adjustments: [], ytdTaxable: 0, ytdTaxPaid: 0,
      pensionBasis: "qualifying_earnings", pensionRelief: "relief_at_source", pensionEeRate: 0.05, pensionErRate: 0.03,
    });
    await db.payRunEntry.create({
      data: {
        tenantId: bureau.id, payRunId: acmePayRun.id, employeeId: emp.id,
        gross: res.gross, taxableGross: res.taxableGross, niableGross: res.niableGross,
        tax: res.tax, niEmployee: res.niEmployee, niEmployer: res.niEmployer,
        pensionEmployee: res.pensionEmployee, pensionEmployer: res.pensionEmployer,
        studentLoan: res.studentLoan, postgradLoan: res.postgradLoan, net: res.net,
        earningsAtLel: res.earningsAtLel, earningsLelPt: res.earningsLelPt, earningsPtUel: res.earningsPtUel,
        status: "approved", prevNet: res.net,
      },
    });
    acmeTotals.gross += res.gross; acmeTotals.tax += res.tax; acmeTotals.net += res.net;
  }
  await db.payRun.update({ where: { id: acmePayRun.id }, data: { totalsJson: JSON.stringify(acmeTotals) } });

  // ============ RTI SUBMISSIONS ============
  await db.rtiSubmission.createMany({
    data: [
      {
        id: "rti_smith_1", tenantId: bureau.id, companyId: smith.id, payRunId: "pr_smith_2026_1",
        type: "FPS", taxYear: "2026-27", taxPeriod: 1,
        xmlPayload: "<GovTalkMessage>...</GovTalkMessage>", irmark: "aB3k9x2mQ8sN4pT7vW1yZ0==",
        correlationId: "ABC123DEF456", status: "accepted",
        submittedAt: new Date(2026, 3, 30), resolvedAt: new Date(2026, 4, 1),
      },
      {
        id: "rti_smith_2", tenantId: bureau.id, companyId: smith.id, payRunId: "pr_smith_2026_2",
        type: "FPS", taxYear: "2026-27", taxPeriod: 2,
        xmlPayload: "<GovTalkMessage>...</GovTalkMessage>", irmark: "bC4l0y3nR9tO5qU8wX2zA1==",
        correlationId: "GHI789JKL012", status: "accepted",
        submittedAt: new Date(2026, 4, 30), resolvedAt: new Date(2026, 5, 1),
      },
      {
        id: "rti_smith_3", tenantId: bureau.id, companyId: smith.id, payRunId: "pr_smith_2026_3",
        type: "FPS", taxYear: "2026-27", taxPeriod: 3,
        xmlPayload: "<GovTalkMessage>...</GovTalkMessage>", irmark: "cD5m1z4oS0uP6rV9xY3aB2==",
        status: "polling", pollAfter: new Date(2026, 6, 1), attempts: 1,
        submittedAt: new Date(2026, 5, 30),
      },
      {
        id: "rti_acme_3", tenantId: bureau.id, companyId: acme.id, payRunId: "pr_acme_2026_3",
        type: "FPS", taxYear: "2026-27", taxPeriod: 3,
        xmlPayload: "<GovTalkMessage>...</GovTalkMessage>", irmark: "dE6n2a5pT1vQ7sW0yZ4bC3==",
        correlationId: "MNO345PQR678", status: "accepted",
        submittedAt: new Date(2026, 6, 28), resolvedAt: new Date(2026, 6, 29),
      },
    ],
  });

  // ============ HOLIDAYS ============
  await db.holiday.createMany({
    data: [
      {
        id: "hol_1", tenantId: bureau.id, employeeId: "emp_eleanor",
        startDate: new Date("2026-07-24"), endDate: new Date("2026-08-02"),
        days: 8, reason: "Summer holiday", status: "approved",
        approverId: "user_smith_admin", decidedAt: new Date("2026-06-15"),
      },
      {
        id: "hol_2", tenantId: bureau.id, employeeId: "emp_james",
        startDate: new Date("2026-08-10"), endDate: new Date("2026-08-14"),
        days: 5, reason: "Family trip", status: "pending",
      },
      {
        id: "hol_3", tenantId: bureau.id, employeeId: "emp_james",
        startDate: new Date("2026-05-18"), endDate: new Date("2026-05-22"),
        days: 5, reason: "Annual leave", status: "approved",
        approverId: "emp_eleanor", decidedAt: new Date("2026-05-01"),
      },
      {
        id: "hol_4", tenantId: bureau.id, employeeId: "emp_tom",
        startDate: new Date("2026-09-07"), endDate: new Date("2026-09-10"),
        days: 4, reason: "Short break", status: "pending",
      },
    ],
  });

  // ============ NOTIFICATIONS ============
  await db.notification.createMany({
    data: [
      { tenantId: bureau.id, userId: "user_eleanor", type: "payslip_ready", title: "Payslip ready", body: "Your June 2026 payslip is available to view.", actionUrl: "payslips", createdAt: new Date(2026, 5, 30) },
      { tenantId: bureau.id, userId: "user_eleanor", type: "holiday_decision", title: "Holiday approved", body: "Your summer holiday request (24 Jul – 2 Aug) was approved.", createdAt: new Date(2026, 5, 15) },
      { tenantId: bureau.id, userId: "user_eleanor", type: "pay_date", title: "Pay date approaching", body: "Next pay date: 31 July 2026.", createdAt: new Date(2026, 6, 25) },
      { tenantId: bureau.id, userId: "user_james", type: "payslip_ready", title: "Payslip ready", body: "Your June 2026 payslip is available.", createdAt: new Date(2026, 5, 30) },
      { tenantId: bureau.id, userId: "user_admin", type: "rti_status", title: "FPS polling", body: "Smith & Co Ltd Period 3 FPS is polling HMRC.", createdAt: new Date(2026, 5, 30) },
    ],
  });

  // ============ BANK HOLIDAYS ============
  const bankHolidays = [
    { date: new Date("2026-01-01"), name: "New Year's Day" },
    { date: new Date("2026-04-03"), name: "Good Friday" },
    { date: new Date("2026-04-06"), name: "Easter Monday" },
    { date: new Date("2026-05-04"), name: "Early May bank holiday" },
    { date: new Date("2026-05-25"), name: "Spring bank holiday" },
    { date: new Date("2026-08-31"), name: "Summer bank holiday" },
    { date: new Date("2026-12-25"), name: "Christmas Day" },
    { date: new Date("2026-12-28"), name: "Boxing Day (substitute)" },
  ];
  await db.bankHoliday.createMany({
    data: bankHolidays.map((bh) => ({ ...bh, region: "england_wales", bacsImpact: true })),
  });

  // ============ DOCUMENTS ============
  await db.document.createMany({
    data: [
      { tenantId: bureau.id, companyId: "comp_smith", employeeId: "emp_eleanor", type: "payslip", taxYear: "2026-27", payRunEntryId: "n/a", storageKey: "docs/payslips/emp_eleanor_2026-27_p3.pdf", sha256: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", generatedAt: new Date(2026, 5, 30) },
      { tenantId: bureau.id, companyId: "comp_smith", employeeId: "emp_eleanor", type: "payslip", taxYear: "2026-27", storageKey: "docs/payslips/emp_eleanor_2026-27_p2.pdf", sha256: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", generatedAt: new Date(2026, 4, 30) },
      { tenantId: bureau.id, companyId: "comp_smith", employeeId: "emp_eleanor", type: "payslip", taxYear: "2026-27", storageKey: "docs/payslips/emp_eleanor_2026-27_p1.pdf", sha256: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", generatedAt: new Date(2026, 3, 30) },
      { tenantId: bureau.id, companyId: "comp_smith", employeeId: "emp_james", type: "payslip", taxYear: "2026-27", storageKey: "docs/payslips/emp_james_2026-27_p3.pdf", sha256: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5", generatedAt: new Date(2026, 5, 30) },
      { tenantId: bureau.id, companyId: "comp_smith", employeeId: "emp_james", type: "payslip", taxYear: "2026-27", storageKey: "docs/payslips/emp_james_2026-27_p2.pdf", sha256: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6", generatedAt: new Date(2026, 4, 30) },
    ],
  });

  // ============ RTI ERROR DICTIONARY (seed subset) ============
  await db.rtiErrorDictionary.createMany({
    data: [
      { code: "1046", category: "auth", severity: "error", hmrcMessage: "Authentication failure", cause: "Invalid Government Gateway credentials", resolutionScreen: "S10", resolutionField: "hmrc_credentials", guidedSteps: '["Navigate to Settings › HMRC credentials","Update Sender ID and password","Resubmit FPS"]' },
      { code: "5001", category: "reference", severity: "error", hmrcMessage: "PAYE reference mismatch", cause: "Employer PAYE/AO ref does not match HMRC records", resolutionScreen: "S03", resolutionField: "paye_ref", guidedSteps: '["Open company record","Verify PAYE ref format 123/AB456","Verify AO ref 123PA0001234X","Resubmit FPS"]' },
      { code: "7801", category: "reference", severity: "error", hmrcMessage: "Accounts Office reference mismatch", cause: "AO ref mismatch with tax office", resolutionScreen: "S03", resolutionField: "accounts_office_ref" },
      { code: "7806", category: "registration", severity: "error", hmrcMessage: "Not registered for tax year", cause: "Scheme not registered for this tax year", resolutionScreen: "S10", resolutionField: "tax_registration" },
    ],
  });

  return { seeded: true };
}
