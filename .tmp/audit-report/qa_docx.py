from pathlib import Path
from zipfile import ZipFile
import json
import re

from docx import Document


DOCX_PATH = Path(__file__).resolve().parents[2] / "SupplyED_Project_Audit_Report.docx"


def iter_text(document):
    for paragraph in document.paragraphs:
        yield paragraph.text
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    yield paragraph.text
    for section in document.sections:
        for area in (section.header, section.footer):
            for paragraph in area.paragraphs:
                yield paragraph.text


with ZipFile(DOCX_PATH) as archive:
    bad_member = archive.testzip()
    package_names = set(archive.namelist())
    document_xml = archive.read("word/document.xml").decode("utf-8")
    rels_xml = archive.read("word/_rels/document.xml.rels").decode("utf-8")
    page_number_field_present = "PAGE" in document_xml or any(
        "PAGE" in archive.read(name).decode("utf-8", errors="ignore")
        for name in package_names
        if name.startswith("word/footer") and name.endswith(".xml")
    )

document = Document(DOCX_PATH)
all_text = "\n".join(iter_text(document))
headings = [p.text for p in document.paragraphs if p.style and p.style.name.startswith("Heading")]

expected_sections = [
    "Executive summary",
    "Priority decisions",
    "Scope and method",
    "Findings register",
    "Detailed findings",
    "Recommended implementation order",
    "Verification still required",
    "Positive controls observed",
    "External references",
    "Report status",
]
missing_sections = [section for section in expected_sections if section not in all_text]

forbidden_patterns = {
    "citation_token": r"turn\d+(?:search|fetch|view)\d+",
    "template_placeholder": r"\b(?:TODO|TBD|LOREM IPSUM)\b",
    "mojibake": r"(?:Ã.|Â.|â€|ï¿½)",
}
forbidden_hits = {
    name: re.findall(pattern, all_text, flags=re.IGNORECASE)
    for name, pattern in forbidden_patterns.items()
}

sections = []
for section in document.sections:
    sections.append({
        "width_inches": round(section.page_width.inches, 3),
        "height_inches": round(section.page_height.inches, 3),
        "top_margin_inches": round(section.top_margin.inches, 3),
        "bottom_margin_inches": round(section.bottom_margin.inches, 3),
        "left_margin_inches": round(section.left_margin.inches, 3),
        "right_margin_inches": round(section.right_margin.inches, 3),
    })

report = {
    "path": str(DOCX_PATH),
    "size_bytes": DOCX_PATH.stat().st_size,
    "zip_test": "ok" if bad_member is None else bad_member,
    "required_package_parts_present": all(
        name in package_names
        for name in ("[Content_Types].xml", "word/document.xml", "word/styles.xml")
    ),
    "paragraph_count": len(document.paragraphs),
    "table_count": len(document.tables),
    "heading_count": len(headings),
    "headings": headings,
    "section_geometry": sections,
    "missing_expected_sections": missing_sections,
    "forbidden_hits": forbidden_hits,
    "hyperlink_count": document_xml.count("<w:hyperlink"),
    "external_relationship_count": rels_xml.count('TargetMode="External"'),
    "page_number_field_present": page_number_field_present,
    "repeating_header_row_count": document_xml.count("<w:tblHeader"),
}

print(json.dumps(report, indent=2))

assert bad_member is None, f"Corrupt ZIP member: {bad_member}"
assert report["required_package_parts_present"], "Required DOCX package part missing"
assert not missing_sections, f"Missing expected sections: {missing_sections}"
assert not any(forbidden_hits.values()), f"Forbidden placeholder/citation text found: {forbidden_hits}"
assert all(section["width_inches"] == 8.5 and section["height_inches"] == 11.0 for section in sections)
assert report["hyperlink_count"] >= 5, "Expected external reference hyperlinks"
assert report["external_relationship_count"] >= 5, "Expected external hyperlink relationships"
assert report["page_number_field_present"], "Footer page-number field missing"
