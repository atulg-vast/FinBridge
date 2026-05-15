"""
Generate sample financial documents for FinBridge testing.
Run: python generate_samples.py
Output: 6 PDF files in the same directory as this script.
"""
import os
from fpdf import FPDF

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def pdf(orientation="P") -> FPDF:
    p = FPDF(orientation=orientation, unit="mm", format="A4")
    p.set_auto_page_break(auto=True, margin=15)
    p.add_page()
    return p


def header_bar(p: FPDF, title: str, subtitle: str = ""):
    p.set_fill_color(37, 99, 235)
    p.rect(0, 0, 210 if p.epw < 260 else 297, 28, "F")
    p.set_text_color(255, 255, 255)
    p.set_font("Helvetica", "B", 16)
    p.set_xy(10, 8)
    p.cell(0, 8, title)
    if subtitle:
        p.set_font("Helvetica", "", 9)
        p.set_xy(10, 18)
        p.cell(0, 6, subtitle)
    p.set_text_color(0, 0, 0)
    p.set_xy(10, 34)


def divider(p: FPDF):
    p.set_draw_color(200, 200, 200)
    p.line(10, p.get_y(), 200, p.get_y())
    p.ln(3)


def section(p: FPDF, text: str):
    p.set_font("Helvetica", "B", 10)
    p.set_fill_color(241, 245, 249)
    p.set_text_color(37, 99, 235)
    p.cell(0, 7, f"  {text}", fill=True, ln=True)
    p.set_text_color(0, 0, 0)
    p.ln(1)


def row(p: FPDF, label: str, value: str):
    p.set_font("Helvetica", "", 9)
    p.set_x(14)
    p.cell(55, 6, label)
    p.set_font("Helvetica", "B", 9)
    p.cell(0, 6, value, ln=True)


def table_header(p: FPDF, cols: list, widths: list):
    p.set_fill_color(37, 99, 235)
    p.set_text_color(255, 255, 255)
    p.set_font("Helvetica", "B", 8)
    p.set_x(10)
    for col, w in zip(cols, widths):
        p.cell(w, 7, col, border=0, fill=True, align="C")
    p.ln()
    p.set_text_color(0, 0, 0)


def table_row(p: FPDF, cells: list, widths: list, fill: bool = False):
    p.set_font("Helvetica", "", 8)
    if fill:
        p.set_fill_color(248, 250, 252)
    p.set_x(10)
    for cell, w in zip(cells, widths):
        p.cell(w, 6, str(cell), border=0, fill=fill, align="C")
    p.ln()


def amt(p: FPDF, label: str, value: str, bold: bool = False):
    p.set_font("Helvetica", "B" if bold else "", 9)
    p.set_x(120)
    p.cell(45, 6, label, align="R")
    p.cell(25, 6, value, align="R", ln=True)


# ─── 1. Purchase Invoice ─────────────────────
def gen_purchase_invoice():
    p = pdf()
    header_bar(p, "TAX INVOICE", "Purchase Invoice - Vendor to TechCorp Pvt Ltd")

    section(p, "Vendor Details")
    row(p, "Vendor Name:", "Apex Supplies Pvt Ltd")
    row(p, "GSTIN:", "27AAPCA1234M1Z5")
    row(p, "Address:", "Plot 14, MIDC Industrial Area, Pune - 411019")
    row(p, "Email:", "billing@apexsupplies.in")
    p.ln(3)

    section(p, "Bill To")
    row(p, "Company:", "TechCorp Pvt Ltd")
    row(p, "GSTIN:", "27ABTCT5678N1Z2")
    row(p, "Address:", "Level 3, Infotech Park, Hinjewadi, Pune - 411057")
    p.ln(3)

    section(p, "Invoice Details")
    row(p, "Invoice No:", "APX/2024-25/1047")
    row(p, "Invoice Date:", "12 March 2025")
    row(p, "Due Date:", "11 April 2025")
    row(p, "Payment Terms:", "Net 30 days")
    p.ln(4)

    section(p, "Line Items")
    p.ln(2)
    cols = ["#", "Description", "HSN", "Qty", "Unit Price (INR)", "Amount (INR)"]
    widths = [10, 72, 18, 12, 35, 33]
    table_header(p, cols, widths)
    items = [
        (1, "Dell Monitor 27 inch FHD IPS", "8528", "5", "18,500.00", "92,500.00"),
        (2, "Logitech MX Keys Keyboard", "8471", "10", "3,200.00", "32,000.00"),
        (3, "USB-C Docking Station", "8504", "5", "4,800.00", "24,000.00"),
        (4, "Cat6 Ethernet Cable 5m", "8544", "50", "350.00", "17,500.00"),
        (5, "Network Switch 24-port", "8517", "2", "12,000.00", "24,000.00"),
    ]
    for i, item in enumerate(items):
        table_row(p, item, widths, fill=(i % 2 == 0))
    p.ln(4)

    divider(p)
    amt(p, "Subtotal:", "1,90,000.00")
    amt(p, "CGST @ 9%:", "17,100.00")
    amt(p, "SGST @ 9%:", "17,100.00")
    p.set_font("Helvetica", "B", 10)
    p.set_x(120)
    p.set_fill_color(37, 99, 235)
    p.set_text_color(255, 255, 255)
    p.cell(45, 8, "TOTAL AMOUNT:", align="R", fill=True)
    p.cell(25, 8, "INR 2,24,200.00", align="R", fill=True, ln=True)
    p.set_text_color(0, 0, 0)
    p.ln(5)
    p.set_font("Helvetica", "I", 8)
    p.set_x(10)
    p.cell(0, 5, "Amount in words: Two Lakh Twenty-Four Thousand Two Hundred Rupees Only", ln=True)
    p.ln(3)
    p.set_font("Helvetica", "", 8)
    p.cell(0, 5, "Bank: HDFC Bank  |  A/C: 50100234567890  |  IFSC: HDFC0001234", ln=True)

    p.output(os.path.join(OUT_DIR, "01_purchase_invoice.pdf"))
    print("  Created: 01_purchase_invoice.pdf")


# ─── 2. Sales Invoice ────────────────────────
def gen_sales_invoice():
    p = pdf()
    header_bar(p, "TAX INVOICE", "Sales Invoice - TechCorp Pvt Ltd to Client")

    section(p, "From (Seller)")
    row(p, "Company:", "TechCorp Pvt Ltd")
    row(p, "GSTIN:", "27ABTCT5678N1Z2")
    row(p, "Address:", "Level 3, Infotech Park, Hinjewadi, Pune - 411057")
    row(p, "Email:", "accounts@techcorp.in")
    p.ln(3)

    section(p, "Bill To (Buyer)")
    row(p, "Client:", "Meridian Finance Ltd")
    row(p, "GSTIN:", "27AAMCM9012P1ZX")
    row(p, "Address:", "202 Bandra Kurla Complex, Mumbai - 400051")
    p.ln(3)

    section(p, "Invoice Details")
    row(p, "Invoice No:", "TC/2024-25/0389")
    row(p, "Invoice Date:", "28 February 2025")
    row(p, "PO Reference:", "MFL-PO-20250210")
    p.ln(4)

    section(p, "Services Rendered")
    p.ln(2)
    cols = ["#", "Description", "SAC", "Hours", "Rate (INR)", "Amount (INR)"]
    widths = [10, 74, 18, 18, 30, 30]
    table_header(p, cols, widths)
    items = [
        (1, "Software Development - Phase 2", "998314", "320 hrs", "2,500.00", "8,00,000.00"),
        (2, "UI/UX Design Services", "998312", "80 hrs", "2,000.00", "1,60,000.00"),
        (3, "Cloud Infrastructure Setup (AWS)", "998316", "40 hrs", "3,000.00", "1,20,000.00"),
        (4, "QA and Testing Services", "998314", "60 hrs", "1,800.00", "1,08,000.00"),
        (5, "Project Management", "998311", "30 hrs", "2,200.00", "66,000.00"),
    ]
    for i, item in enumerate(items):
        table_row(p, item, widths, fill=(i % 2 == 0))
    p.ln(4)

    divider(p)
    amt(p, "Subtotal:", "12,54,000.00")
    amt(p, "IGST @ 18%:", "2,25,720.00")
    p.set_font("Helvetica", "B", 10)
    p.set_x(120)
    p.set_fill_color(37, 99, 235)
    p.set_text_color(255, 255, 255)
    p.cell(45, 8, "TOTAL AMOUNT:", align="R", fill=True)
    p.cell(25, 8, "INR 14,79,720.00", align="R", fill=True, ln=True)
    p.set_text_color(0, 0, 0)
    p.ln(5)
    p.set_font("Helvetica", "I", 8)
    p.cell(0, 5, "Amount in words: Fourteen Lakh Seventy-Nine Thousand Seven Hundred Twenty Rupees Only", ln=True)

    p.output(os.path.join(OUT_DIR, "02_sales_invoice.pdf"))
    print("  Created: 02_sales_invoice.pdf")


# ─── 3. Payment Receipt ──────────────────────
def gen_payment_receipt():
    p = pdf()
    header_bar(p, "PAYMENT RECEIPT", "Official Receipt of Payment")

    p.set_font("Helvetica", "B", 28)
    p.set_text_color(34, 197, 94)
    p.set_x(10)
    p.cell(0, 14, "RECEIVED", align="C", ln=True)
    p.set_text_color(0, 0, 0)
    p.ln(2)

    section(p, "Receipt Details")
    row(p, "Receipt No:", "RCP/2025/0291")
    row(p, "Date:", "15 March 2025")
    row(p, "Reference No:", "NEFT/HDFC/250315/789234")
    p.ln(3)

    section(p, "Received From")
    row(p, "Payer Name:", "Meridian Finance Ltd")
    row(p, "Account No:", "XXXX XXXX 4521")
    row(p, "Bank:", "ICICI Bank, BKC Branch, Mumbai")
    p.ln(3)

    section(p, "Received By")
    row(p, "Payee:", "TechCorp Pvt Ltd")
    row(p, "Account No:", "50100234567890")
    row(p, "Bank / IFSC:", "HDFC Bank / HDFC0001234")
    p.ln(3)

    section(p, "Payment Details")
    row(p, "Payment Mode:", "NEFT")
    row(p, "Purpose:", "Payment against Invoice TC/2024-25/0312")
    row(p, "Invoice Date:", "15 February 2025")
    p.ln(4)

    y = p.get_y()
    p.set_fill_color(240, 253, 244)
    p.set_draw_color(34, 197, 94)
    p.set_line_width(0.5)
    p.rect(50, y, 110, 22, "FD")
    p.set_font("Helvetica", "", 10)
    p.set_xy(50, y + 3)
    p.cell(110, 7, "Amount Received", align="C", ln=True)
    p.set_font("Helvetica", "B", 18)
    p.set_text_color(34, 197, 94)
    p.set_x(50)
    p.cell(110, 9, "INR 5,00,000.00", align="C", ln=True)
    p.set_text_color(0, 0, 0)
    p.ln(5)

    p.set_font("Helvetica", "I", 8)
    p.cell(0, 5, "Amount in words: Five Lakh Rupees Only", align="C", ln=True)
    p.ln(8)
    p.set_draw_color(200, 200, 200)
    p.line(10, p.get_y(), 80, p.get_y())
    p.set_xy(10, p.get_y() + 2)
    p.set_font("Helvetica", "", 8)
    p.cell(70, 5, "Authorised Signatory - TechCorp Pvt Ltd")

    p.output(os.path.join(OUT_DIR, "03_payment_receipt.pdf"))
    print("  Created: 03_payment_receipt.pdf")


# ─── 4. Salary Register ──────────────────────
def gen_salary_register():
    p = FPDF(orientation="L", unit="mm", format="A4")
    p.set_auto_page_break(auto=True, margin=15)
    p.add_page()
    p.set_fill_color(37, 99, 235)
    p.rect(0, 0, 297, 22, "F")
    p.set_text_color(255, 255, 255)
    p.set_font("Helvetica", "B", 13)
    p.set_xy(10, 7)
    p.cell(0, 9, "SALARY REGISTER - March 2025   |   TechCorp Pvt Ltd")
    p.set_text_color(0, 0, 0)
    p.set_xy(10, 28)

    cols = ["Emp ID", "Employee Name", "Dept", "Basic", "HRA", "Conv.", "Med.All.", "Gross", "PF", "PT", "TDS", "Net Pay"]
    widths = [18, 42, 22, 22, 18, 16, 18, 24, 16, 12, 18, 25]
    table_header(p, cols, widths)

    employees = [
        ("TC001", "Arjun Mehta", "Engineering", "75,000", "30,000", "3,000", "1,250", "1,09,250", "9,000", "200", "12,500", "87,550"),
        ("TC002", "Priya Sharma", "Product", "65,000", "26,000", "3,000", "1,250", "95,250", "7,800", "200", "9,800", "77,450"),
        ("TC003", "Rohit Nair", "Engineering", "80,000", "32,000", "3,000", "1,250", "1,16,250", "9,600", "200", "14,200", "92,250"),
        ("TC004", "Sneha Kulkarni", "Design", "55,000", "22,000", "3,000", "1,250", "81,250", "6,600", "200", "7,200", "67,250"),
        ("TC005", "Vikram Singh", "Sales", "60,000", "24,000", "3,000", "1,250", "88,250", "7,200", "200", "9,000", "71,850"),
        ("TC006", "Anjali Desai", "HR", "50,000", "20,000", "3,000", "1,250", "74,250", "6,000", "200", "6,200", "61,850"),
        ("TC007", "Karan Joshi", "Engineering", "90,000", "36,000", "3,000", "1,250", "1,30,250", "10,800", "200", "17,500", "1,01,750"),
        ("TC008", "Meera Iyer", "Operations", "45,000", "18,000", "3,000", "1,250", "67,250", "5,400", "200", "4,800", "56,850"),
        ("TC009", "Suresh Patel", "Finance", "70,000", "28,000", "3,000", "1,250", "1,02,250", "8,400", "200", "11,500", "82,150"),
        ("TC010", "Nisha Reddy", "Marketing", "58,000", "23,200", "3,000", "1,250", "85,450", "6,960", "200", "8,600", "69,690"),
    ]
    for i, emp in enumerate(employees):
        table_row(p, emp, widths, fill=(i % 2 == 0))

    p.ln(3)
    p.set_draw_color(200, 200, 200)
    p.line(10, p.get_y(), 287, p.get_y())
    p.ln(2)
    p.set_font("Helvetica", "B", 9)
    p.set_x(10)
    totals = ["", "TOTAL (10 employees)", "", "6,48,000", "2,59,200", "30,000", "12,500", "9,49,700", "77,760", "2,000", "1,01,300", "7,68,640"]
    for val, w in zip(totals, widths):
        p.cell(w, 7, val, align="C")
    p.ln(5)
    p.set_font("Helvetica", "", 8)
    p.set_x(10)
    p.cell(0, 5, "PF: 12% of Basic  |  PT: Professional Tax per Maharashtra slab  |  TDS: As per IT Act", ln=True)

    p.output(os.path.join(OUT_DIR, "04_salary_register.pdf"))
    print("  Created: 04_salary_register.pdf")


# ─── 5. Bank Statement ───────────────────────
def gen_bank_statement():
    p = pdf()
    header_bar(p, "ACCOUNT STATEMENT", "HDFC Bank - Current Account")

    section(p, "Account Information")
    row(p, "Account Holder:", "TechCorp Pvt Ltd")
    row(p, "Account No:", "XXXX XXXX XXXX 7890")
    row(p, "Account Type:", "Current Account")
    row(p, "Branch:", "Hinjewadi, Pune - IFSC: HDFC0001234")
    row(p, "Statement Period:", "01 March 2025 to 31 March 2025")
    row(p, "Opening Balance:", "INR 12,45,320.00")
    p.ln(4)

    section(p, "Transaction Details")
    p.ln(2)
    cols = ["Date", "Narration", "Ref No.", "Debit (INR)", "Credit (INR)", "Balance (INR)"]
    widths = [22, 72, 26, 24, 24, 32]
    table_header(p, cols, widths)
    txns = [
        ("03-Mar-25", "NEFT CR-Meridian Finance Ltd", "NEFT250315789", "", "5,00,000.00", "17,45,320.00"),
        ("05-Mar-25", "NEFT DR-Apex Supplies Pvt Ltd", "NEFT250305412", "2,24,200.00", "", "15,21,120.00"),
        ("07-Mar-25", "SALARY TRANSFER-Mar25", "SAL250307001", "7,68,640.00", "", "7,52,480.00"),
        ("10-Mar-25", "AWS Cloud Services-Feb25", "ACH250310221", "48,320.00", "", "7,04,160.00"),
        ("12-Mar-25", "GST Payment-Feb25 NSDL", "GST250312445", "1,24,500.00", "", "5,79,660.00"),
        ("14-Mar-25", "NEFT CR-GlobalTech Inc", "NEFT250314089", "", "8,50,000.00", "14,29,660.00"),
        ("18-Mar-25", "Office Rent Mar25 Infotech Park", "CHQ000234", "2,10,000.00", "", "12,19,660.00"),
        ("20-Mar-25", "NEFT DR-Legal Counsel Fees", "NEFT250320773", "75,000.00", "", "11,44,660.00"),
        ("22-Mar-25", "TDS Payment-Q4 FY24-25", "OLTAS250322", "2,15,000.00", "", "9,29,660.00"),
        ("25-Mar-25", "NEFT CR-Spectrum Solutions", "NEFT250325912", "", "3,20,000.00", "12,49,660.00"),
        ("28-Mar-25", "Interest Credit-Mar25", "INT250328001", "", "4,218.00", "12,53,878.00"),
        ("31-Mar-25", "Bank Charges-Mar25", "CHG250331001", "850.00", "", "12,53,028.00"),
    ]
    for i, txn in enumerate(txns):
        table_row(p, txn, widths, fill=(i % 2 == 0))

    p.ln(4)
    divider(p)
    p.set_font("Helvetica", "B", 9)
    p.set_x(10)
    p.cell(94, 6, "")
    p.cell(28, 6, "Total Debits:", align="R")
    p.cell(24, 6, "16,66,510.00", align="R")
    p.cell(24, 6, "Total Credits:", align="R")
    p.cell(30, 6, "16,74,218.00", align="R", ln=True)
    p.set_x(10)
    p.cell(94, 6, "")
    p.cell(28, 6, "Closing Balance:", align="R")
    p.set_font("Helvetica", "B", 10)
    p.cell(54, 7, "INR 12,53,028.00", align="R", ln=True)
    p.ln(4)
    p.set_font("Helvetica", "I", 7)
    p.cell(0, 5, "Computer-generated statement. For queries: 1800-xxx-xxxx", ln=True)

    p.output(os.path.join(OUT_DIR, "05_bank_statement.pdf"))
    print("  Created: 05_bank_statement.pdf")


# ─── 6. Transaction Ledger ───────────────────
def gen_transaction_ledger():
    p = pdf()
    header_bar(p, "TRANSACTION LEDGER", "Office Rent Expenses - FY 2024-25")

    section(p, "Ledger Information")
    row(p, "Ledger Account:", "Office Rent Expenses")
    row(p, "Company:", "TechCorp Pvt Ltd")
    row(p, "Period:", "April 2024 to March 2025")
    row(p, "Opening Balance:", "INR 0.00 (Dr)")
    p.ln(4)

    section(p, "Ledger Entries")
    p.ln(2)
    cols = ["Date", "Particulars", "Vch Type", "Vch No.", "Debit (INR)", "Credit (INR)", "Balance (INR)"]
    widths = [22, 56, 22, 20, 24, 24, 32]
    table_header(p, cols, widths)
    entries = [
        ("01-Apr-24", "Infotech Park - Apr Rent", "Payment", "PV-0041", "1,80,000.00", "", "1,80,000 Dr"),
        ("01-May-24", "Infotech Park - May Rent", "Payment", "PV-0067", "1,80,000.00", "", "3,60,000 Dr"),
        ("01-Jun-24", "Infotech Park - Jun Rent", "Payment", "PV-0094", "1,80,000.00", "", "5,40,000 Dr"),
        ("01-Jul-24", "Infotech Park - Jul Rent (Rev)", "Payment", "PV-0121", "1,95,000.00", "", "7,35,000 Dr"),
        ("01-Aug-24", "Infotech Park - Aug Rent", "Payment", "PV-0149", "1,95,000.00", "", "9,30,000 Dr"),
        ("01-Sep-24", "Infotech Park - Sep Rent", "Payment", "PV-0178", "1,95,000.00", "", "11,25,000 Dr"),
        ("15-Sep-24", "Security Deposit Refund", "Receipt", "RV-0022", "", "50,000.00", "10,75,000 Dr"),
        ("01-Oct-24", "Infotech Park - Oct Rent", "Payment", "PV-0205", "1,95,000.00", "", "12,70,000 Dr"),
        ("01-Nov-24", "Infotech Park - Nov Rent", "Payment", "PV-0231", "2,10,000.00", "", "14,80,000 Dr"),
        ("01-Dec-24", "Infotech Park - Dec Rent", "Payment", "PV-0258", "2,10,000.00", "", "16,90,000 Dr"),
        ("01-Jan-25", "Infotech Park - Jan Rent", "Payment", "PV-0284", "2,10,000.00", "", "19,00,000 Dr"),
        ("01-Feb-25", "Infotech Park - Feb Rent", "Payment", "PV-0311", "2,10,000.00", "", "21,10,000 Dr"),
        ("01-Mar-25", "Infotech Park - Mar Rent", "Payment", "PV-0338", "2,10,000.00", "", "23,20,000 Dr"),
    ]
    for i, entry in enumerate(entries):
        table_row(p, entry, widths, fill=(i % 2 == 0))

    p.ln(4)
    divider(p)
    p.set_font("Helvetica", "B", 9)
    p.set_x(10)
    p.cell(98, 6, "")
    p.cell(24, 6, "Total Debit:", align="R")
    p.cell(24, 6, "23,70,000.00", align="R")
    p.cell(24, 6, "Total Credit:", align="R")
    p.cell(30, 6, "50,000.00", align="R", ln=True)
    p.set_x(10)
    p.cell(98, 6, "")
    p.cell(24, 6, "Closing Balance:", align="R")
    p.set_font("Helvetica", "B", 10)
    p.cell(54, 7, "INR 23,20,000.00 Dr", align="R", ln=True)
    p.ln(4)
    p.set_font("Helvetica", "I", 7)
    p.cell(0, 5, "Generated from Tally ERP 9  |  FY 2024-25  |  TechCorp Pvt Ltd", ln=True)

    p.output(os.path.join(OUT_DIR, "06_transaction_ledger.pdf"))
    print("  Created: 06_transaction_ledger.pdf")


if __name__ == "__main__":
    print(f"Generating sample documents in: {OUT_DIR}\n")
    gen_purchase_invoice()
    gen_sales_invoice()
    gen_payment_receipt()
    gen_salary_register()
    gen_bank_statement()
    gen_transaction_ledger()
    print("\nDone! 6 sample documents ready for upload testing.")
