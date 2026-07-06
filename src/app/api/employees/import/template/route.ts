import { NextResponse } from "next/server";
export async function GET() {
  const BOM = "\uFEFF";
  const header = "first_name,last_name,email,dob,nino,address_line1,city,postcode,start_date,starter_declaration,salary_annual,contracted_weekly_hours,department,job_title,employment_type,tax_code,ni_category,student_loan_plan,postgrad_loan,sort_code,account_number,account_name";
  const sample = "Eleanor,Vance,eleanor@smithco.co.uk,1985-05-14,AB123456C,22 Baker Street,London,W1U 3BW,2026-03-01,A,36000,37.5,Finance,Senior Accountant,full_time,1257L,A,,no,401201,11223344,Eleanor Vance";
  const csv = BOM + header + "\r\n" + sample + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kedbyte-employee-import-template.csv"` } });
}
