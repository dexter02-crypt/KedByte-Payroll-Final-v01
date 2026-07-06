# Testing Guide

## Engine Verification (the most important test)

The calculation engine must reproduce HMRC statutory values to the exact penny.

### Quick Check

```bash
# Via API (server must be running)
curl http://localhost:3000/api/engine/verify

# Expected response:
# { "passed": true, "results": { "gross": {"ok": true}, "tax": {"ok": true}, ... } }
```

### Script Check

```bash
bun -e "
import { verifyWorkedProof } from './src/engine/payroll.ts';
const r = verifyWorkedProof();
console.log('Passed:', r.passed);
for (const [k,v] of Object.entries(r.results)) {
  console.log('  ' + k + ': ' + v.actual + ' (expected ' + v.expected + ') ' + (v.ok ? '✓' : '✗'));
}
"
```

### Canonical Vector

Input: £36,000/yr · monthly · tax month 1 · code 1257L cumulative · NI cat A · Plan 2 loan · pension QE 5%/3% RAS.

| Field | Expected |
|---|---|
| Gross | £3,000.00 |
| Tax | £390.20 |
| NI Employee | £156.16 |
| NI Employer | £387.45 |
| Pension EE (deducted) | £99.20 |
| Pension ER | £74.40 |
| Student Loan | £49.00 |
| Net Pay | £2,305.44 |
| Employer Cost | £3,461.85 |

---

## Edge Case Tests

Run these to verify the engine handles all UK payroll scenarios:

```bash
bun -e "
import { calculatePAYE, calculateNI, calculateStudentLoan, calculatePension } from './src/engine/payroll.ts';

// BR flat code
console.log('BR £3000:', calculatePAYE({taxCode:'BR',period:1,grossTaxableThisPeriod:3000,ytdTaxable:0,ytdTaxPaid:0}).tax, '(expect 600)');

// SD0 Scottish flat (21%)
console.log('SD0 £3000:', calculatePAYE({taxCode:'SD0',period:1,grossTaxableThisPeriod:3000,ytdTaxable:0,ytdTaxPaid:0}).tax, '(expect 630)');

// NT (no tax)
console.log('NT:', calculatePAYE({taxCode:'NT',period:1,grossTaxableThisPeriod:3000,ytdTaxable:0,ytdTaxPaid:0}).tax, '(expect 0)');

// Cat C (pensioner) - employee NI = 0
let ni = calculateNI({niableGross:3000, category:'C'});
console.log('Cat C EE:', ni.employee, '(expect 0)');

// Cat M (under-21) - employer NI = 0 below UEL
ni = calculateNI({niableGross:3000, category:'M'});
console.log('Cat M ER:', ni.employer, '(expect 0)');

// Plan 5 student loan
let sl = calculateStudentLoan(2500, 'plan_5', false);
console.log('Plan 5:', sl.studentLoan, '(expect 37)');

// Salary sacrifice
let pen = calculatePension({earnings:3000, basis:'qualifying_earnings', relief:'salary_sacrifice', eeRate:0.05, erRate:0.03});
console.log('SalSac eeDeducted:', pen.eeDeducted, '(expect 0)');
console.log('SalSac er:', pen.er, '(expect 198.40)');
"
```

---

## API Tests

### Validation 422s

```bash
# Invalid NINO (Q is excluded from first letter)
curl -s -w "%{http_code}" -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"companyId":"comp_smith","firstName":"Test","lastName":"User","dob":"1990-01-01","startDate":"2026-01-01","salaryAnnual":30000,"nino":"QQ123456C"}'
# Expect: 422

# Invalid PAYE ref (4 digits)
curl -s -w "%{http_code}" -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","payeRef":"1234/AB456","accountsOfficeRef":"123PA0001234X"}'
# Expect: 422

# Pension below statutory floor
curl -s -w "%{http_code}" -X PUT http://localhost:3000/api/settings/pension \
  -H "Content-Type: application/json" \
  -d '{"companyId":"comp_smith","changes":[{"key":"eeRate","value":0.01},{"key":"erRate","value":0.01}]}'
# Expect: 422
```

### Concurrency 409s

```bash
# Duplicate PAYE ref
curl -s -w "%{http_code}" -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Dupe","payeRef":"123/AB456","accountsOfficeRef":"123PA0001234X"}'
# Expect: 409

# Demote last bureau admin
curl -s -w "%{http_code}" -X PUT http://localhost:3000/api/settings/users \
  -H "Content-Type: application/json" \
  -d '{"changes":[{"key":"role","entityId":"user_admin","value":"company_admin"}]}'
# Expect: 409
```

### Rate Limiting 429

```bash
# First export - 202
curl -s -w "%{http_code}" -X POST http://localhost:3000/api/settings/system/export \
  -H "Content-Type: application/json" \
  -d '{"format":"csv-bundle","actorId":"user_admin"}'
# Expect: 202

# Second export same day - 429
curl -s -w "%{http_code}" -X POST http://localhost:3000/api/settings/system/export \
  -H "Content-Type: application/json" \
  -d '{"format":"csv-bundle","actorId":"user_admin"}'
# Expect: 429
```

---

## Export Tests

```bash
# PAPDIS export (must use a committed pay run)
curl -o papdis.csv "http://localhost:3000/api/pensions/contributions/export?payRunId=pr_smith_2026_3&format=papdis"
# Opens in Excel with BOM, 25 PAPDIS 1.1 columns

# BACS Standard-18 file
curl -o bacs.txt "http://localhost:3000/api/payruns/pr_smith_2026_3/bacs"
# Fixed-width, pence amounts, contra record

# Employee list (masked NINO/bank)
curl -o employees.csv "http://localhost:3000/api/companies/comp_smith/employees/export"
# NINO column shows "AB 12 •• •• C", bank shows "••••5678"
```

---

## Lint & Build

```bash
# ESLint
bun run lint
# Expect: 0 errors (2 cosmetic warnings about icon font)

# Production build
bun run build
# Expect: ✓ Compiled successfully
```
