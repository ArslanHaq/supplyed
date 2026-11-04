from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"C:\Users\Usman Cheema\Desktop\Waleed\SupplyEd\supplyed-web")
OUTPUT = ROOT / "SupplyED_Project_Audit_Report.docx"

NAVY = "17324D"
PALE_BLUE = "F3F7FA"
LIGHT_BLUE = "E8F0F6"
LIGHT_GRAY = "D9D9D9"
TEXT = "252A30"
MUTED = "5F6973"
URGENT = "9B1C31"
HIGH = "C34A20"
MEDIUM = "A56A00"
LOW = "52606D"
WHITE = "FFFFFF"
BLACK = "000000"


FINDINGS = [
    {
        "title": "Vulnerable production dependencies expose reachable failures",
        "priority": "Urgent",
        "area": "Security",
        "status": "Confirmed",
        "finding": (
            "The production dependency audit reports ten vulnerabilities: four critical, four high, one moderate, and one low. "
            "Next.js 16.2.9 is affected by a Server Actions CPU exhaustion issue, and the project contains twenty Server Action modules. "
            "Auth.js also fails on malformed bearer tokens. A request with Authorization Bearer percent returned HTTP 500 and logged URIError URI malformed."
        ),
        "impact": (
            "Unauthenticated traffic can force error paths and, for the Next.js issue, consume enough CPU to block legitimate requests. "
            "Several additional advisories have reduced exposure because image optimization is disabled, use cache is absent, and the Auth.js email provider is not configured, but the two reproduced paths remain reachable."
        ),
        "solution": (
            "Upgrade Next.js outside every affected range, currently at least 16.4.1, and upgrade next-auth to beta 32 or newer with @auth/core 0.41.3 or newer. "
            "Update the remaining audited packages, replace or patch Quill's vulnerable HTML exporter, rebuild, rerun the dependency audit, and regression test authentication, OAuth, Server Actions, rich text, and uploads."
        ),
        "evidence": "package-lock.json lines 52 to 58, 5359 to 5365, and 5412 to 5418; proxy.ts lines 43 to 50; runtime reproduction against the production build.",
        "sources": [
            ("Next.js Server Actions advisory", "https://github.com/advisories/GHSA-p3m5-59mp-jv5r"),
            ("Auth.js malformed bearer advisory", "https://github.com/nextauthjs/next-auth/security/advisories/GHSA-xmf8-cvqr-rfgj"),
        ],
    },
    {
        "title": "Private query data can cross account boundaries",
        "priority": "High",
        "area": "Privacy",
        "status": "Confirmed",
        "finding": (
            "A single React Query client lives in the root layout. Private keys for conversations, notifications, jobs, settings, and billing do not include the current user ID. "
            "Logout navigates without cancelling or clearing the cache."
        ),
        "impact": (
            "A second person signing in within the same browser tab can receive the previous account's cached data. The data is fresh for thirty seconds and remains resident for up to five minutes, so it can appear immediately or while the new request is refetching."
        ),
        "solution": (
            "Include the immutable user ID in every private query key. Cancel and clear private queries before logout, on session expiry, and whenever the authenticated user changes. Add account switching tests for billing, messages, jobs, profiles, and notifications."
        ),
        "evidence": "app/layout.tsx lines 79 to 91; lib/query/query-client.tsx lines 10 to 29; lib/query/keys.ts lines 25 to 66; components/organisms/RouteShell.tsx lines 125 to 129.",
    },
    {
        "title": "Cash out endpoint lacks origin protection and retry identity",
        "priority": "High",
        "area": "Payments",
        "status": "Confirmed risk",
        "finding": (
            "An externally reachable POST route starts an instant payout without the project's requireSameOrigin guard. The UI uses a Server Action, but the duplicate API route remains directly callable. "
            "Both paths submit only amountPence and provide no stable idempotency key."
        ),
        "impact": (
            "A script on an untrusted sibling subdomain could issue an authenticated same-site request because SameSite cookies are scoped to the registrable domain rather than the exact origin. "
            "A lost response, reload, or second tab can also look like a new cash-out and may duplicate a payout if the missing backend does not enforce atomic idempotency."
        ),
        "solution": (
            "Remove the unused API route or enforce strict Origin, Referer, and Fetch Metadata validation. Require a persisted client-generated idempotency key, enforce uniqueness in the backend ledger, forward the key to Stripe, and perform balance deduction and payout creation atomically."
        ),
        "evidence": "app/api/payments/payout-account/instant-payout/route.ts lines 8 to 15; features/payments/actions.ts lines 165 to 175; components/organisms/BillingPage.tsx lines 219 to 232.",
        "sources": [
            ("OWASP Cross Site Request Forgery Prevention", "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"),
        ],
    },
    {
        "title": "Legal privacy consent and account closure flows are unfinished",
        "priority": "High",
        "area": "Compliance",
        "status": "Confirmed",
        "finding": (
            "The published terms identify themselves as prototype copy requiring solicitor review. Signup checks a terms box, but registration sends only email, password, and role, so the backend receives no terms version or durable acceptance record. "
            "The terms promise that users can close their account from Settings, but the repository contains no closure action or interface."
        ),
        "impact": (
            "The product cannot demonstrate which terms a user accepted, and it publishes a user promise that the application does not fulfil. The short privacy section also omits several categories identified in current ICO guidance, including detailed lawful bases, controller contact details, retention periods, applicable rights, and complaint information."
        ),
        "solution": (
            "Obtain legal review, publish complete versioned terms and privacy information, and persist server-side acceptance records for email and social signup. Implement an account closure and data request workflow that respects outstanding bookings, financial records, safeguarding duties, and documented retention rules."
        ),
        "evidence": "app/(public)/terms/page.tsx lines 15 to 18 and 118 to 123; features/auth/actions.ts lines 259 to 288; features/auth/backend.ts lines 356 to 370.",
        "sources": [
            ("ICO Privacy Information Guidance", "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/"),
        ],
    },
    {
        "title": "Job publishing can create duplicate or orphaned jobs",
        "priority": "Medium",
        "area": "Reliability",
        "status": "Confirmed risk",
        "finding": (
            "Publishing performs two backend operations: create the job, then activate it. Recovery depends on a job ID held only in a component reference. If creation succeeds but the response is lost before the ID is stored, retrying sends another create request."
        ),
        "impact": "Users can create duplicate postings, orphaned drafts, or active jobs that the interface reports as failed after a response loss or page reload.",
        "solution": (
            "Make create and publish atomic or attach a persisted idempotency key to the creation attempt. Provide an attempt lookup and recovery endpoint, then test dropped responses, reloads, and concurrent tabs."
        ),
        "evidence": "features/jobs/actions.ts lines 13 to 44; components/organisms/PostJobPage.tsx lines 210 to 228 and 366 to 385.",
    },
    {
        "title": "My job lookup silently falls back to another school's public job",
        "priority": "Medium",
        "area": "Authorization",
        "status": "Confirmed",
        "finding": (
            "When scope mine cannot find an owned job, the route falls back to the public job endpoint. A school can direct-link to another school's public job and have it loaded into the edit flow."
        ),
        "impact": (
            "Backend ownership should still reject saving, so this is not an authorization bypass by itself. It does defeat the interface's ownership contract, exposes an edit experience for an unowned record, and produces misleading errors."
        ),
        "solution": "Never fall back from the owned endpoint to public data. Return 403 or 404 and use a separate explicit public scope where required.",
        "evidence": "app/api/jobs/[id]/route.ts lines 6 to 21; features/jobs/queries.ts lines 47 to 57.",
    },
    {
        "title": "Schedules can overlap and double count hours and pay",
        "priority": "Medium",
        "area": "Data integrity",
        "status": "Confirmed",
        "finding": (
            "Each weekday and exception is validated independently. A Monday shift from 23:00 to 02:00 can overlap a Tuesday shift from 01:00 to 03:00 without rejection. An add-hours exception can also overlap the recurring shift because the arrays are concatenated without merged validation."
        ),
        "impact": "Preview hours and hourly pay sum both intervals, which can misstate planned work, expected pay, availability, and schedule conflicts.",
        "solution": (
            "Expand the schedule into dated intervals, normalize overnight boundaries, sort the result, and reject overlaps after recurring shifts and exceptions are merged. Apply the same rule in the backend and test overnight, duplicate-add, boundary, and daylight-saving cases."
        ),
        "evidence": "features/jobs/job-schedule.ts lines 15 to 35, 52 to 89, and 93 to 124; components/molecules/WorkScheduleEditor.tsx lines 37 to 45.",
    },
    {
        "title": "Interrupted uploads can leave orphaned records and objects",
        "priority": "Medium",
        "area": "Storage",
        "status": "Needs backend verification",
        "finding": (
            "Conversation attachments create a backend record before uploading to storage. Failed storage writes have no compensating delete, and successful uploads become messages only in a later user action. Profile documents similarly create or reuse a row, upload an object, and then call a separate completion endpoint."
        ),
        "impact": "Interrupted requests can leave pending database rows or unused storage objects unless the external backend runs a cleanup process that is not present in this workspace.",
        "solution": (
            "Model uploads as expiring pending records, add an abort endpoint, make completion idempotent, and run a monitored time-to-live cleanup job with object-storage lifecycle rules."
        ),
        "evidence": "app/api/conversations/[id]/attachments/route.ts lines 33 to 49; features/onboarding/documents.ts lines 350 to 401.",
    },
    {
        "title": "Readiness reports healthy when the backend is unavailable",
        "priority": "Medium",
        "area": "Operations",
        "status": "Runtime confirmed",
        "finding": (
            "The health endpoint checks only whether environment values exist. It never contacts the backend. Both deployment health checks rely exclusively on this route, and runtime testing returned HTTP 200 with status ok."
        ),
        "impact": "A wrong backend URL or complete backend outage leaves the frontend container healthy and receiving traffic, while users encounter broad failures.",
        "solution": (
            "Separate liveness from readiness. Keep liveness process-local, but make readiness perform a short bounded backend health request and validate critical runtime configuration."
        ),
        "evidence": "app/api/health/route.ts lines 5 to 13; deploy/docker-compose.main.yml lines 20 to 29; deploy/docker-compose.dev.yml lines 20 to 29.",
    },
    {
        "title": "Token refresh coordination breaks across multiple instances",
        "priority": "Medium",
        "area": "Authentication",
        "status": "Scaling risk",
        "finding": (
            "Refresh deduplication uses a process-local map. Two replicas receiving parallel requests for the same rotating refresh token can both call the backend refresh endpoint."
        ),
        "impact": (
            "If the backend treats refresh tokens as one-use, one request can invalidate the other and sign the user out. The present Compose deployment is single-instance, but the design becomes unsafe when scaled or during overlapping deployments."
        ),
        "solution": (
            "Make backend token-family rotation idempotent or coordinate refreshes through a shared store or lock. Load test two application instances using the same session."
        ),
        "evidence": "lib/server/token-refresh.ts lines 14 to 23 and 188 to 210.",
    },
    {
        "title": "One rate limit blocks every unrelated feature",
        "priority": "Medium",
        "area": "Availability",
        "status": "Confirmed",
        "finding": (
            "A single browser-global until value records any HTTP 429 response. Every fetchJson call checks that value before sending a request."
        ),
        "impact": "A rate limit from one sensitive operation can locally block jobs, messages, billing, notifications, and other unrelated reads for the entire cooldown period.",
        "solution": (
            "Scope cooldowns by backend limiter bucket, endpoint class, and user. Continue safe reads unless the backend explicitly communicates a global limit."
        ),
        "evidence": "lib/rate-limit.ts lines 5 to 30; lib/query/fetch-json.ts lines 27 to 55.",
    },
    {
        "title": "Social authentication advertises configurations that cannot work",
        "priority": "Medium",
        "area": "Authentication",
        "status": "Confirmed",
        "finding": (
            "Google appears available whenever credentials exist, even if the separate backend OAuth flag is disabled. Microsoft can be configured as an Auth.js provider, but the backend explicitly rejects it and the interface has no Microsoft button."
        ),
        "impact": "A deployment can show a Google button that always fails, while Microsoft configuration creates the appearance of support for a flow that users cannot complete.",
        "solution": (
            "Derive interface availability from one capability check covering credentials, feature flag, and backend support. Complete Microsoft exchange and interface support or remove its advertised configuration until it is ready."
        ),
        "evidence": "features/auth/social-auth.ts lines 7 to 11; features/auth/backend.ts lines 535 to 560; components/molecules/SocialAuthButtons.tsx lines 4 to 40; .github/workflows/dev-cicd.yml lines 100 to 108.",
    },
    {
        "title": "Malformed notification timestamps can crash notification views",
        "priority": "Low",
        "area": "User interface",
        "status": "Confirmed",
        "finding": "Any string is accepted as createdAt. An invalid value reaches Intl DateTimeFormat, which throws a RangeError.",
        "impact": "One malformed backend record can break the notification bell or the recent-notifications section instead of degrading gracefully.",
        "solution": "Validate and normalize ISO timestamps at the response boundary, provide a safe fallback, and test missing, invalid, future, and extreme values.",
        "evidence": "features/notifications/schemas.ts lines 13 to 30; components/organisms/NotificationBell.tsx lines 191 to 197; components/organisms/RecentNotifications.tsx lines 85 to 91.",
    },
    {
        "title": "The application does not guarantee browser security headers",
        "priority": "Low",
        "area": "Browser security",
        "status": "Deployment dependent",
        "finding": (
            "Production-style responses lacked Content Security Policy, frame-ancestors or X-Frame-Options, Strict Transport Security, Referrer Policy, and Permissions Policy, while exposing X-Powered-By. An external reverse proxy may add these headers, but the repository and container do not."
        ),
        "impact": "Clickjacking and other browser hardening depend on undocumented infrastructure and may be absent on a direct deployment path.",
        "solution": (
            "Define the headers in Next.js or at the public ingress, disable the powered-by header, and create a Content Security Policy compatible with Stripe, OAuth, uploads, and the messaging socket. Verify the actual public response."
        ),
        "evidence": "next.config.mjs lines 1 to 13 and production-style runtime response inspection.",
        "sources": [
            ("OWASP Clickjacking Defense", "https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html"),
        ],
    },
    {
        "title": "Critical flows have no automated regression suite",
        "priority": "Low",
        "area": "Quality assurance",
        "status": "Confirmed",
        "finding": "No test, specification, or end-to-end files and no test script were found. Continuous integration installs dependencies, runs lint, and builds, but does not execute behavioral tests.",
        "impact": "Payments, authentication, permissions, schedules, retries, and multi-user isolation can regress while continuous integration remains green.",
        "solution": (
            "Add unit tests for boundary logic, backend-contract integration tests, and browser journeys for every role. Prioritize account switching, payout retries, job response loss, schedule overlap, upload interruption, token refresh, and authorization failures."
        ),
        "evidence": "package.json lines 5 to 10; .github/workflows/dev-cicd.yml lines 17 to 41; repository-wide test-file search returned no test files.",
    },
]


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color=LIGHT_GRAY, size="6"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.find(qn("w:tcBorders"))
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = qn(f"w:{edge}")
        element = borders.find(tag)
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_width(cell, width_inches):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(int(width_inches * 1440)))
    tc_w.set(qn("w:type"), "dxa")


def set_run_font(run, name="Aptos", size=None, bold=None, color=None):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)


def add_hyperlink(paragraph, text, url, color=NAVY):
    part = paragraph.part
    rel_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), rel_id)
    run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    r_fonts = OxmlElement("w:rFonts")
    r_fonts.set(qn("w:ascii"), "Aptos")
    r_fonts.set(qn("w:hAnsi"), "Aptos")
    r_pr.append(r_fonts)
    color_node = OxmlElement("w:color")
    color_node.set(qn("w:val"), color)
    r_pr.append(color_node)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    r_pr.append(underline)
    run.append(r_pr)
    text_node = OxmlElement("w:t")
    text_node.text = text
    run.append(text_node)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def add_page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instruction, separate, text, end])
    set_run_font(run, size=8.5, color=MUTED)


def configure_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Aptos"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(TEXT)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.12

    title = styles["Title"]
    title.font.name = "Aptos Display"
    title._element.rPr.rFonts.set(qn("w:ascii"), "Aptos Display")
    title._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos Display")
    title.font.size = Pt(30)
    title.font.bold = True
    title.font.color.rgb = RGBColor.from_string(BLACK)
    title.paragraph_format.space_after = Pt(12)

    subtitle = styles["Subtitle"]
    subtitle.font.name = "Aptos"
    subtitle._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
    subtitle._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
    subtitle.font.size = Pt(13)
    subtitle.font.color.rgb = RGBColor.from_string(BLACK)
    subtitle.paragraph_format.space_after = Pt(18)

    for name, size, before, after in (
        ("Heading 1", 18, 18, 8),
        ("Heading 2", 14, 14, 6),
        ("Heading 3", 11.5, 10, 4),
    ):
        style = styles[name]
        style.font.name = "Aptos Display"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Aptos Display")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos Display")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(BLACK)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    styles["List Bullet"].font.name = "Aptos"
    styles["List Bullet"].font.size = Pt(10.5)
    styles["List Bullet"].paragraph_format.space_after = Pt(4)


def configure_page(doc):
    for section in doc.sections:
        section.page_width = Inches(8.5)
        section.page_height = Inches(11)
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.65)
        section.left_margin = Inches(0.78)
        section.right_margin = Inches(0.78)
        section.header_distance = Inches(0.28)
        section.footer_distance = Inches(0.28)
        section.different_first_page_header_footer = True


def add_header_footer(section):
    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("SUPPLYED PROJECT AUDIT")
    set_run_font(run, size=8, bold=True, color=MUTED)

    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("SupplyED Project Audit   |   4 November 2026   |   Page ")
    set_run_font(run, size=8.5, color=MUTED)
    add_page_field(p)


def format_table(table, widths, header=True, compact=False):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for row_index, row in enumerate(table.rows):
        if row_index == 0 and header:
            set_repeat_table_header(row)
        for col_index, cell in enumerate(row.cells):
            set_cell_width(cell, widths[col_index])
            set_cell_border(cell)
            set_cell_margins(cell, top=80 if compact else 105, bottom=80 if compact else 105)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if row_index == 0 and header:
                set_cell_shading(cell, NAVY)
            elif row_index % 2 == 0:
                set_cell_shading(cell, PALE_BLUE)
            else:
                set_cell_shading(cell, WHITE)
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.line_spacing = 1.05
                for run in paragraph.runs:
                    set_run_font(run, size=8.8 if compact else 9.5, color=WHITE if row_index == 0 and header else TEXT)
                    if row_index == 0 and header:
                        run.bold = True


def fill_cell(cell, text, bold=False, color=None, align=None, size=9.5):
    cell.text = ""
    paragraph = cell.paragraphs[0]
    if align is not None:
        paragraph.alignment = align
    run = paragraph.add_run(str(text))
    set_run_font(run, size=size, bold=bold, color=color or TEXT)
    return paragraph


def add_label_paragraph(doc, label, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.keep_together = True
    lead = p.add_run(label + " ")
    set_run_font(lead, size=10.5, bold=True, color=BLACK)
    body = p.add_run(text)
    set_run_font(body, size=10.5, color=TEXT)
    return p


def priority_color(priority):
    return {"Urgent": URGENT, "High": HIGH, "Medium": MEDIUM, "Low": LOW}[priority]


def add_priority_line(doc, finding):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(7)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.keep_together = True
    r = p.add_run(finding["priority"].upper())
    set_run_font(r, size=9, bold=True, color=priority_color(finding["priority"]))
    r = p.add_run("   |   " + finding["area"] + "   |   " + finding["status"])
    set_run_font(r, size=9, color=MUTED)


def add_sources(doc, sources):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    lead = p.add_run("External references ")
    set_run_font(lead, size=9.5, bold=True, color=BLACK)
    for index, (label, url) in enumerate(sources):
        if index:
            sep = p.add_run("; ")
            set_run_font(sep, size=9.5, color=TEXT)
        add_hyperlink(p, label, url)


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Inches(0.22)
    p.paragraph_format.first_line_indent = Inches(-0.15)
    run = p.add_run(text)
    set_run_font(run, size=10.3, color=TEXT)
    return p


def add_cover(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(62)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run("SUPPLYED")
    set_run_font(run, size=10, bold=True, color=NAVY)

    title = doc.add_paragraph("SupplyED Project Audit Report", style="Title")
    title.paragraph_format.keep_with_next = True
    subtitle = doc.add_paragraph("Security reliability data integrity and launch readiness", style="Subtitle")
    subtitle.paragraph_format.keep_with_next = True

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(24)
    run = p.add_run(
        "The audit identified fifteen issues across the web application. Immediate attention is required for vulnerable runtime dependencies, private data retained across account changes, the instant payout endpoint, and unfinished legal and account lifecycle flows."
    )
    set_run_font(run, size=12, color=TEXT)
    p.paragraph_format.line_spacing = 1.18

    meta = doc.add_paragraph()
    meta.paragraph_format.space_after = Pt(28)
    for label, value in (("Audit date", "4 November 2026"), ("Workspace", "supplyed-web"), ("Branch", "feat/stripe-reflow")):
        label_run = meta.add_run(label + "  ")
        set_run_font(label_run, size=9.5, bold=True, color=BLACK)
        value_run = meta.add_run(value + "     ")
        set_run_font(value_run, size=9.5, color=MUTED)

    p = doc.add_paragraph("Risk summary", style="Heading 2")
    p.paragraph_format.space_before = Pt(0)
    table = doc.add_table(rows=2, cols=4)
    set_repeat_table_header(table.rows[0])
    widths = [1.72, 1.72, 1.72, 1.72]
    headers = ["URGENT", "HIGH", "MEDIUM", "LOW"]
    values = ["1", "3", "8", "3"]
    colors = [URGENT, HIGH, MEDIUM, LOW]
    for col, label in enumerate(headers):
        fill_cell(table.cell(0, col), label, bold=True, color=WHITE, align=WD_ALIGN_PARAGRAPH.CENTER, size=9)
        set_cell_shading(table.cell(0, col), colors[col])
        fill_cell(table.cell(1, col), values[col], bold=True, color=BLACK, align=WD_ALIGN_PARAGRAPH.CENTER, size=20)
        set_cell_shading(table.cell(1, col), WHITE)
    for row in table.rows:
        for col, cell in enumerate(row.cells):
            set_cell_width(cell, widths[col])
            set_cell_border(cell)
            set_cell_margins(cell, top=110, bottom=110)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(28)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run("Prepared for the SupplyED project team")
    set_run_font(r, size=10, color=MUTED)


def add_executive_summary(doc):
    doc.add_page_break()
    doc.add_heading("Executive summary", level=1)
    p = doc.add_paragraph(
        "The application compiles and builds cleanly, and its role-based journeys cover a broad marketplace workflow. The main release risk is not basic code health. It is the interaction between security-sensitive dependencies, account-scoped browser state, payment mutations, incomplete lifecycle controls, and backend contracts that cannot be verified from this repository."
    )
    p.paragraph_format.space_after = Pt(10)

    doc.add_heading("Priority decisions", level=2)
    add_bullet(doc, "Patch the Next.js and Auth.js runtime before the next production deployment.")
    add_bullet(doc, "Prevent private React Query data from surviving logout or account changes.")
    add_bullet(doc, "Protect instant payouts with same-origin validation, atomic balance handling, and end-to-end idempotency.")
    add_bullet(doc, "Complete legal review, privacy information, consent records, and the promised account closure workflow before launch.")

    doc.add_heading("Scope and method", level=2)
    p = doc.add_paragraph(
        "The review covered 485 workspace files and 96 application page or route entry points. It traced authentication, onboarding, teacher and institution journeys, administration, job posting, applications, invitations, bookings, attendance, messaging, notifications, documents, billing, payouts, deployment, and runtime behavior."
    )
    p.paragraph_format.space_after = Pt(8)

    table = doc.add_table(rows=1, cols=3)
    for index, label in enumerate(("Validation", "Result", "Notes")):
        fill_cell(table.cell(0, index), label, bold=True, color=WHITE, size=9)
    checks = [
        ("ESLint", "Passed", "Full repository lint"),
        ("TypeScript", "Passed", "No emit and incremental disabled"),
        ("Production build", "Passed", "Next.js 16.2.9"),
        ("Dependency audit", "Failed", "10 production vulnerabilities"),
        ("Runtime smoke", "Completed", "Public page, redirect, health, headers, malformed bearer"),
        ("Automated tests", "Not available", "No test files or test script"),
    ]
    for check in checks:
        cells = table.add_row().cells
        for index, value in enumerate(check):
            fill_cell(cells[index], value, bold=index == 1, color=TEXT, size=9)
            if index == 1:
                cells[index].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    format_table(table, [2.15, 1.25, 3.5], compact=True)

    doc.add_heading("Audit boundaries", level=2)
    p = doc.add_paragraph(
        "The external Nest backend, database schema, migrations, role enforcement, transaction boundaries, Stripe webhooks, scheduled jobs, storage cleanup, and backup controls are not present in this workspace. Findings that depend on those systems are marked as risks requiring backend verification rather than confirmed backend defects."
    )
    p.paragraph_format.space_after = Pt(0)


def add_findings_register(doc):
    doc.add_page_break()
    doc.add_heading("Findings register", level=1)
    p = doc.add_paragraph("The register provides a concise view of priority, subject, and verification status. Full evidence and recommended actions follow.")
    p.paragraph_format.space_after = Pt(10)

    table = doc.add_table(rows=1, cols=4)
    for index, label in enumerate(("No", "Priority", "Finding", "Status")):
        fill_cell(table.cell(0, index), label, bold=True, color=WHITE, size=8.8)
    for number, finding in enumerate(FINDINGS, start=1):
        cells = table.add_row().cells
        fill_cell(cells[0], number, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, size=8.6)
        fill_cell(cells[1], finding["priority"], bold=True, color=priority_color(finding["priority"]), align=WD_ALIGN_PARAGRAPH.CENTER, size=8.6)
        fill_cell(cells[2], finding["title"], size=8.6)
        fill_cell(cells[3], finding["status"], align=WD_ALIGN_PARAGRAPH.CENTER, size=8.2)
    format_table(table, [0.4, 0.75, 4.58, 1.17], compact=True)


def add_detailed_findings(doc):
    doc.add_page_break()
    doc.add_heading("Detailed findings", level=1)
    p = doc.add_paragraph(
        "Each finding distinguishes the observed behavior from its likely effect and states the action needed to close the risk."
    )
    p.paragraph_format.space_after = Pt(8)

    for number, finding in enumerate(FINDINGS, start=1):
        heading = doc.add_paragraph(style="Heading 2")
        heading.paragraph_format.keep_with_next = True
        run = heading.add_run(f"{number}  {finding['title']}")
        set_run_font(run, name="Aptos Display", size=14, bold=True, color=BLACK)
        add_priority_line(doc, finding)
        add_label_paragraph(doc, "What we found", finding["finding"])
        add_label_paragraph(doc, "Why it matters", finding["impact"])
        add_label_paragraph(doc, "Recommended action", finding["solution"])
        evidence = add_label_paragraph(doc, "Evidence", finding["evidence"])
        for run in evidence.runs[1:]:
            set_run_font(run, name="Aptos", size=9.5, color=MUTED)
        if finding.get("sources"):
            add_sources(doc, finding["sources"])


def add_action_plan(doc):
    doc.add_page_break()
    doc.add_heading("Recommended implementation order", level=1)
    p = doc.add_paragraph(
        "The sequence below reduces exposure first, then closes reliability and launch-readiness gaps. Timing assumes the external backend team is available for the payment, token, upload, and transaction work."
    )
    p.paragraph_format.space_after = Pt(10)

    table = doc.add_table(rows=1, cols=4)
    for index, label in enumerate(("Window", "Focus", "Findings", "Exit condition")):
        fill_cell(table.cell(0, index), label, bold=True, color=WHITE, size=9)
    rows = [
        ("Before deployment", "Runtime security", "1", "Dependency audit no longer reports the exposed Next.js and Auth.js advisories"),
        ("First 7 days", "Privacy and payments", "2 to 4", "Account switching is isolated, payouts are protected and idempotent, and legal owners approve the launch plan"),
        ("Weeks 2 to 4", "Data and reliability", "5 to 9", "Mutation retries, ownership lookup, schedules, upload cleanup, and readiness are covered by tests"),
        ("Weeks 4 to 6", "Scale and experience", "10 to 14", "Multi-instance refresh, limiter scoping, social auth, timestamp safety, and public headers are verified"),
        ("Ongoing", "Regression protection", "15", "Role-based browser tests and backend-contract tests run in continuous integration"),
    ]
    for row in rows:
        cells = table.add_row().cells
        for index, value in enumerate(row):
            fill_cell(cells[index], value, bold=index == 0, size=8.8)
    format_table(table, [1.2, 1.55, 0.8, 3.35], compact=True)

    doc.add_heading("Verification still required", level=2)
    for text in (
        "Inspect the Nest backend, database schema, migrations, authorization rules, idempotency records, Stripe webhook handling, and transaction boundaries.",
        "Run complete journeys with real teacher, institution, and administrator accounts plus Stripe, OAuth, email, socket, and object-storage services.",
        "Test at least two application instances to validate refresh-token rotation, caches, and concurrent mutation handling.",
        "Inspect the public ingress for TLS, security headers, rate limits, trusted proxy behavior, monitoring, and readiness routing.",
        "Obtain qualified legal and operational approval for terms, privacy information, retention rules, safeguarding statements, contractor status, and account closure."
    ):
        add_bullet(doc, text)

    doc.add_heading("Positive controls observed", level=2)
    p = doc.add_paragraph(
        "The project includes several useful controls: same-origin enforcement on document uploads and public approval actions, strict upload type and size checks, sandboxed document previews, sanitization of proposal HTML before rendering, server-side route checks in addition to proxy routing, non-root production containers, restart and log-rotation policies, and secret redaction in authentication debug output. These controls reduce risk but do not remove the findings in this report."
    )
    p.paragraph_format.space_after = Pt(0)


def add_sources_appendix(doc):
    doc.add_page_break()
    doc.add_heading("External references", level=1)
    p = doc.add_paragraph("Primary advisories and guidance used to validate the time-sensitive security and privacy findings are listed below.")
    p.paragraph_format.space_after = Pt(10)
    refs = [
        ("Next.js Server Actions denial of service advisory", "https://github.com/advisories/GHSA-p3m5-59mp-jv5r"),
        ("Auth.js malformed bearer authorization header advisory", "https://github.com/nextauthjs/next-auth/security/advisories/GHSA-xmf8-cvqr-rfgj"),
        ("OWASP Cross Site Request Forgery Prevention Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html"),
        ("ICO guidance on privacy information", "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/"),
        ("OWASP Clickjacking Defense Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html"),
    ]
    for label, url in refs:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(0.22)
        p.paragraph_format.first_line_indent = Inches(-0.15)
        add_hyperlink(p, label, url)

    doc.add_heading("Report status", level=2)
    p = doc.add_paragraph(
        "This report records the state of the reviewed workspace on 4 November 2026. No application source fixes were applied during the audit, and the existing working-tree changes were preserved."
    )
    p.paragraph_format.space_after = Pt(0)


def build():
    doc = Document()
    configure_styles(doc)
    configure_page(doc)
    for section in doc.sections:
        add_header_footer(section)

    props = doc.core_properties
    props.title = "SupplyED Project Audit Report"
    props.subject = "Security reliability data integrity and launch readiness audit"
    props.author = "SupplyED"
    props.keywords = "SupplyED audit security reliability payments privacy"

    add_cover(doc)
    add_executive_summary(doc)
    add_findings_register(doc)
    add_detailed_findings(doc)
    add_action_plan(doc)
    add_sources_appendix(doc)

    for paragraph in doc.paragraphs:
        if paragraph.style.name in ("Heading 1", "Heading 2", "Heading 3", "Title", "Subtitle"):
            paragraph.paragraph_format.keep_with_next = True
        for run in paragraph.runs:
            if paragraph.style.name in ("Heading 1", "Heading 2", "Heading 3", "Title", "Subtitle"):
                run.font.color.rgb = RGBColor.from_string(BLACK)

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
