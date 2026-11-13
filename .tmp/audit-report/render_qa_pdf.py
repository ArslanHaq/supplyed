from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("audit_builder", HERE / "build_audit_report.py")
module = module_from_spec(spec)
spec.loader.exec_module(module)
FINDINGS = module.FINDINGS

OUTPUT = HERE / "render-1" / "SupplyED_Project_Audit_Report_QA.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#17324D")
PALE_BLUE = colors.HexColor("#F3F7FA")
LIGHT_GRAY = colors.HexColor("#D9D9D9")
TEXT = colors.HexColor("#252A30")
MUTED = colors.HexColor("#5F6973")
PRIORITY = {
    "Urgent": colors.HexColor("#9B1C31"),
    "High": colors.HexColor("#C34A20"),
    "Medium": colors.HexColor("#A56A00"),
    "Low": colors.HexColor("#52606D"),
}


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=NAVY, spaceAfter=10))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=28, leading=31, textColor=colors.black, alignment=TA_LEFT, spaceAfter=10))
styles.add(ParagraphStyle(name="CoverSubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=13, leading=16, textColor=colors.black, spaceAfter=18))
styles.add(ParagraphStyle(name="BodyAudit", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.6, leading=13, textColor=TEXT, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallAudit", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.4, leading=11, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name="H1Audit", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=21, textColor=colors.black, spaceBefore=4, spaceAfter=9))
styles.add(ParagraphStyle(name="H2Audit", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=colors.black, spaceBefore=10, spaceAfter=5, keepWithNext=True))
styles.add(ParagraphStyle(name="PriorityLine", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=10, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name="TableHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=9.5, textColor=colors.white, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="TableBody", parent=styles["Normal"], fontName="Helvetica", fontSize=7.7, leading=9.5, textColor=TEXT))
styles.add(ParagraphStyle(name="TableCenter", parent=styles["TableBody"], alignment=TA_CENTER))


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(letter[0] - 0.78 * inch, letter[1] - 0.34 * inch, "SUPPLYED PROJECT AUDIT")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(letter[0] / 2, 0.34 * inch, f"SupplyED Project Audit   |   4 November 2026   |   Page {doc.page}")
    canvas.restoreState()


def first_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(letter[0] / 2, 0.34 * inch, "SupplyED Project Audit   |   4 November 2026")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=letter,
    leftMargin=0.78 * inch,
    rightMargin=0.78 * inch,
    topMargin=0.7 * inch,
    bottomMargin=0.65 * inch,
    title="SupplyED Project Audit Report",
    author="SupplyED",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    PageTemplate(id="first", frames=frame, onPage=first_page, autoNextPageTemplate="later"),
    PageTemplate(id="later", frames=frame, onPage=header_footer),
])


story = []
story += [Spacer(1, 0.72 * inch), Paragraph("SUPPLYED", styles["CoverKicker"])]
story += [Paragraph("SupplyED Project Audit Report", styles["CoverTitle"])]
story += [Paragraph("Security reliability data integrity and launch readiness", styles["CoverSubtitle"])]
story += [Paragraph(
    "The audit identified fifteen issues across the web application. Immediate attention is required for vulnerable runtime dependencies, private data retained across account changes, the instant payout endpoint, and unfinished legal and account lifecycle flows.",
    ParagraphStyle("CoverBody", parent=styles["BodyAudit"], fontSize=11.5, leading=16, spaceAfter=20),
)]
story += [Paragraph("<b>Audit date</b>  4 November 2026     <b>Workspace</b>  supplyed-web     <b>Branch</b>  feat/stripe-reflow", styles["SmallAudit"])]
story += [Spacer(1, 0.18 * inch), Paragraph("Risk summary", styles["H2Audit"])]

risk_data = [
    [Paragraph("URGENT", styles["TableHead"]), Paragraph("HIGH", styles["TableHead"]), Paragraph("MEDIUM", styles["TableHead"]), Paragraph("LOW", styles["TableHead"])],
    [Paragraph("<b>1</b>", ParagraphStyle("Metric", parent=styles["TableCenter"], fontSize=19, leading=23)), Paragraph("<b>3</b>", ParagraphStyle("Metric2", parent=styles["TableCenter"], fontSize=19, leading=23)), Paragraph("<b>8</b>", ParagraphStyle("Metric3", parent=styles["TableCenter"], fontSize=19, leading=23)), Paragraph("<b>3</b>", ParagraphStyle("Metric4", parent=styles["TableCenter"], fontSize=19, leading=23))],
]
risk = Table(risk_data, colWidths=[doc.width / 4] * 4, rowHeights=[0.34 * inch, 0.55 * inch])
risk.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), PRIORITY["Urgent"]),
    ("BACKGROUND", (1, 0), (1, 0), PRIORITY["High"]),
    ("BACKGROUND", (2, 0), (2, 0), PRIORITY["Medium"]),
    ("BACKGROUND", (3, 0), (3, 0), PRIORITY["Low"]),
    ("BACKGROUND", (0, 1), (-1, 1), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_GRAY),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
]))
story += [risk, Spacer(1, 0.42 * inch), Paragraph("Prepared for the SupplyED project team", styles["SmallAudit"]), PageBreak()]

story += [Paragraph("Executive summary", styles["H1Audit"])]
story += [Paragraph(
    "The application compiles and builds cleanly, and its role-based journeys cover a broad marketplace workflow. The main release risk is the interaction between security-sensitive dependencies, account-scoped browser state, payment mutations, incomplete lifecycle controls, and backend contracts that cannot be verified from this repository.",
    styles["BodyAudit"],
)]
story += [Paragraph("Priority decisions", styles["H2Audit"])]
for item in (
    "Patch the Next.js and Auth.js runtime before the next production deployment.",
    "Prevent private React Query data from surviving logout or account changes.",
    "Protect instant payouts with same-origin validation, atomic balance handling, and end-to-end idempotency.",
    "Complete legal review, privacy information, consent records, and the promised account closure workflow before launch.",
):
    story.append(Paragraph("• " + item, styles["BodyAudit"]))

story += [Paragraph("Scope and validation", styles["H2Audit"])]
story += [Paragraph(
    "The review covered 485 workspace files and 96 application page or route entry points. It traced authentication, onboarding, teacher and institution journeys, administration, job posting, applications, invitations, bookings, attendance, messaging, notifications, documents, billing, payouts, deployment, and runtime behavior.",
    styles["BodyAudit"],
)]
checks = [
    [Paragraph("Validation", styles["TableHead"]), Paragraph("Result", styles["TableHead"]), Paragraph("Notes", styles["TableHead"])],
    ["ESLint", "Passed", "Full repository lint"],
    ["TypeScript", "Passed", "No emit and incremental disabled"],
    ["Production build", "Passed", "Next.js 16.2.9"],
    ["Dependency audit", "Failed", "10 production vulnerabilities"],
    ["Runtime smoke", "Completed", "Public page, redirect, health, headers, malformed bearer"],
    ["Automated tests", "Not available", "No test files or test script"],
]
checks = [[Paragraph(str(v), styles["TableCenter"] if c == 1 else styles["TableBody"]) if r else v for c, v in enumerate(row)] for r, row in enumerate(checks)]
check_table = Table(checks, colWidths=[2.05 * inch, 1.2 * inch, 3.45 * inch], repeatRows=1)
check_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_GRAY),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_BLUE]),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story += [check_table, Paragraph("Audit boundaries", styles["H2Audit"]), Paragraph(
    "The external Nest backend, database schema, migrations, role enforcement, transaction boundaries, Stripe webhooks, scheduled jobs, storage cleanup, and backup controls are not present in this workspace. Findings that depend on those systems are marked as risks requiring backend verification rather than confirmed backend defects.",
    styles["BodyAudit"],
), PageBreak()]

story += [Paragraph("Findings register", styles["H1Audit"]), Paragraph("The register provides a concise view of priority, subject, and verification status. Full evidence and recommended actions follow.", styles["BodyAudit"])]
register = [[Paragraph("No", styles["TableHead"]), Paragraph("Priority", styles["TableHead"]), Paragraph("Finding", styles["TableHead"]), Paragraph("Status", styles["TableHead"])]]
for number, finding in enumerate(FINDINGS, 1):
    register.append([
        Paragraph(str(number), styles["TableCenter"]),
        Paragraph(f"<font color='#{module.priority_color(finding['priority'])}'><b>{finding['priority']}</b></font>", styles["TableCenter"]),
        Paragraph(finding["title"], styles["TableBody"]),
        Paragraph(finding["status"], styles["TableCenter"]),
    ])
reg_table = Table(register, colWidths=[0.38 * inch, 0.72 * inch, 4.47 * inch, 1.15 * inch], repeatRows=1)
reg_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_GRAY),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_BLUE]),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story += [reg_table, PageBreak(), Paragraph("Detailed findings", styles["H1Audit"]), Paragraph("Each finding distinguishes the observed behavior from its likely effect and states the action needed to close the risk.", styles["BodyAudit"])]

for number, finding in enumerate(FINDINGS, 1):
    header = [
        Paragraph(f"{number}  {finding['title']}", styles["H2Audit"]),
        Paragraph(f"<font color='#{module.priority_color(finding['priority'])}'>{finding['priority'].upper()}</font>   |   {finding['area']}   |   {finding['status']}", styles["PriorityLine"]),
    ]
    story.extend(header)
    for label, key in (("What we found", "finding"), ("Why it matters", "impact"), ("Recommended action", "solution")):
        story.append(Paragraph(f"<b>{label}</b>  {finding[key]}", styles["BodyAudit"]))
    story.append(Paragraph(f"<b>Evidence</b>  {finding['evidence']}", styles["SmallAudit"]))
    if finding.get("sources"):
        links = "; ".join(f"<a href='{url}' color='#{module.NAVY}'><u>{label}</u></a>" for label, url in finding["sources"])
        story.append(Paragraph(f"<b>External references</b>  {links}", styles["SmallAudit"]))

story += [PageBreak(), Paragraph("Recommended implementation order", styles["H1Audit"]), Paragraph(
    "The sequence below reduces exposure first, then closes reliability and launch-readiness gaps. Timing assumes the external backend team is available for the payment, token, upload, and transaction work.",
    styles["BodyAudit"],
)]
plan = [[Paragraph(x, styles["TableHead"]) for x in ("Window", "Focus", "Findings", "Exit condition")]]
for row in (
    ("Before deployment", "Runtime security", "1", "Dependency audit no longer reports the exposed Next.js and Auth.js advisories"),
    ("First 7 days", "Privacy and payments", "2 to 4", "Account switching is isolated, payouts are protected and idempotent, and legal owners approve the launch plan"),
    ("Weeks 2 to 4", "Data and reliability", "5 to 9", "Mutation retries, ownership lookup, schedules, upload cleanup, and readiness are covered by tests"),
    ("Weeks 4 to 6", "Scale and experience", "10 to 14", "Multi-instance refresh, limiter scoping, social auth, timestamp safety, and public headers are verified"),
    ("Ongoing", "Regression protection", "15", "Role-based browser tests and backend-contract tests run in continuous integration"),
):
    plan.append([Paragraph(str(v), styles["TableBody"] if i != 2 else styles["TableCenter"]) for i, v in enumerate(row)])
plan_table = Table(plan, colWidths=[1.15 * inch, 1.45 * inch, 0.72 * inch, 3.4 * inch], repeatRows=1)
plan_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_GRAY),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_BLUE]), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story += [plan_table, Paragraph("Verification still required", styles["H2Audit"])]
for item in (
    "Inspect the Nest backend, database schema, migrations, authorization rules, idempotency records, Stripe webhook handling, and transaction boundaries.",
    "Run complete journeys with real teacher, institution, and administrator accounts plus Stripe, OAuth, email, socket, and object-storage services.",
    "Test at least two application instances to validate refresh-token rotation, caches, and concurrent mutation handling.",
    "Inspect the public ingress for TLS, security headers, rate limits, trusted proxy behavior, monitoring, and readiness routing.",
    "Obtain qualified legal and operational approval for terms, privacy information, retention rules, safeguarding statements, contractor status, and account closure.",
):
    story.append(Paragraph("• " + item, styles["BodyAudit"]))

story += [Paragraph("Positive controls observed", styles["H2Audit"]), Paragraph(
    "The project includes useful controls: same-origin enforcement on document uploads and public approval actions, strict upload checks, sandboxed document previews, proposal sanitization, server-side route checks, non-root production containers, restart and log-rotation policies, and secret redaction in authentication debug output. These controls reduce risk but do not remove the findings in this report.",
    styles["BodyAudit"],
)]

doc.build(story)
print(OUTPUT)
