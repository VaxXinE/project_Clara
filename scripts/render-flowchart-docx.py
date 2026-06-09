from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT_DIR = Path(__file__).resolve().parent.parent
INPUT_PATH = ROOT_DIR / "docs" / "CLARA_PROJECT_FLOWCHART.md"
DOCX_OUTPUT_PATH = ROOT_DIR / "docs" / "CLARA_PROJECT_FLOWCHART.docx"


@dataclass
class HeadingBlock:
    level: int
    text: str


@dataclass
class ParagraphBlock:
    text: str


@dataclass
class ListBlock:
    ordered: bool
    items: list[str]


@dataclass
class TableBlock:
    header: list[str] | None
    rows: list[list[str]]


@dataclass
class CodeBlock:
    language: str
    code: str


Block = HeadingBlock | ParagraphBlock | ListBlock | TableBlock | CodeBlock


def normalize_inline(text: str) -> str:
    return text.replace("\r", "").strip()


def is_table_line(line: str) -> bool:
    trimmed = line.strip()
    return trimmed.startswith("|") and trimmed.endswith("|") and "|" in trimmed


def parse_table_cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip()[1:-1].split("|")]


def is_table_separator(cells: list[str]) -> bool:
    if not cells:
        return False
    for cell in cells:
        token = cell.strip().replace(":", "")
        if len(token) < 3 or any(ch != "-" for ch in token):
            return False
    return True


def parse_markdown(md: str) -> list[Block]:
    lines = md.replace("\r\n", "\n").split("\n")
    blocks: list[Block] = []

    paragraph: list[str] = []
    list_items: list[str] = []
    list_type: str | None = None
    table_lines: list[str] = []
    code_fence: str | None = None
    code_lines: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            blocks.append(ParagraphBlock(" ".join(normalize_inline(part) for part in paragraph)))
            paragraph = []

    def flush_list() -> None:
        nonlocal list_items, list_type
        if list_items and list_type:
            blocks.append(ListBlock(ordered=list_type == "ol", items=list_items[:]))
            list_items = []
            list_type = None

    def flush_table() -> None:
        nonlocal table_lines
        if not table_lines:
            return
        rows = [parse_table_cells(line) for line in table_lines]
        has_header = len(rows) >= 2 and is_table_separator(rows[1])
        header = rows[0] if has_header else None
        body_rows = rows[2:] if has_header else rows
        blocks.append(TableBlock(header=header, rows=body_rows))
        table_lines = []

    def flush_code() -> None:
        nonlocal code_fence, code_lines
        if code_fence is None:
            return
        blocks.append(CodeBlock(language=code_fence, code="\n".join(code_lines).rstrip()))
        code_fence = None
        code_lines = []

    for raw_line in lines:
        line = raw_line.rstrip()

        if code_fence is not None:
            if line.startswith("```"):
                flush_code()
            else:
                code_lines.append(raw_line)
            continue

        if line.startswith("```"):
            flush_paragraph()
            flush_list()
            flush_table()
            code_fence = line[3:].strip()
            code_lines = []
            continue

        if not line.strip():
            flush_paragraph()
            flush_list()
            flush_table()
            continue

        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            if 1 <= level <= 6 and len(line) > level and line[level] == " ":
                flush_paragraph()
                flush_list()
                flush_table()
                blocks.append(HeadingBlock(level=level, text=normalize_inline(line[level + 1 :])))
                continue

        if is_table_line(line):
            flush_paragraph()
            flush_list()
            table_lines.append(line)
            continue

        flush_table()

        ordered_parts = line.split(". ", 1)
        if len(ordered_parts) == 2 and ordered_parts[0].isdigit():
            flush_paragraph()
            if list_type and list_type != "ol":
                flush_list()
            list_type = "ol"
            list_items.append(normalize_inline(ordered_parts[1]))
            continue

        if line.lstrip().startswith("- "):
            flush_paragraph()
            indent = len(raw_line) - len(raw_line.lstrip())
            item_text = normalize_inline(line.lstrip()[2:])
            if indent > 0 and list_items:
                list_items[-1] = f"{list_items[-1]}\n- {item_text}"
                continue
            if list_type and list_type != "ul":
                flush_list()
            list_type = "ul"
            list_items.append(item_text)
            continue

        if raw_line.startswith("  ") and list_items:
            list_items[-1] = f"{list_items[-1]}\n{normalize_inline(raw_line)}"
            continue

        flush_list()
        paragraph.append(line.strip())

    flush_paragraph()
    flush_list()
    flush_table()
    flush_code()

    return blocks


def xml_text(value: str) -> str:
    return escape(value, {'"': "&quot;", "'": "&apos;"})


def make_run(text: str, *, bold: bool = False, italic: bool = False, code: bool = False) -> str:
    if not text:
        return ""
    run_props = []
    if bold:
        run_props.append("<w:b/>")
    if italic:
        run_props.append("<w:i/>")
    if code:
        run_props.append("<w:rFonts w:ascii=\"Courier New\" w:hAnsi=\"Courier New\"/>")
    props_xml = f"<w:rPr>{''.join(run_props)}</w:rPr>" if run_props else ""
    parts = text.split("\n")
    xml_parts: list[str] = []
    for index, part in enumerate(parts):
        xml_parts.append(f"<w:t xml:space=\"preserve\">{xml_text(part)}</w:t>")
        if index < len(parts) - 1:
            xml_parts.append("<w:br/>")
    return f"<w:r>{props_xml}{''.join(xml_parts)}</w:r>"


def make_paragraph(
    text: str,
    *,
    style: str | None = None,
    shaded: bool = False,
    spacing_before: int | None = None,
    spacing_after: int | None = 120,
) -> str:
    p_props: list[str] = []
    if style:
        p_props.append(f'<w:pStyle w:val="{style}"/>')
    if spacing_before is not None or spacing_after is not None:
        before = spacing_before if spacing_before is not None else 0
        after = spacing_after if spacing_after is not None else 0
        p_props.append(f'<w:spacing w:before="{before}" w:after="{after}"/>')
    if shaded:
        p_props.append('<w:shd w:val="clear" w:color="auto" w:fill="F6F0E3"/>')
    props_xml = f"<w:pPr>{''.join(p_props)}</w:pPr>" if p_props else ""
    return f"<w:p>{props_xml}{make_run(text, code=shaded)}</w:p>"


def make_table_cell(text: str, *, header: bool = False) -> str:
    p_style = "TableHeader" if header else "TableCell"
    paragraph = make_paragraph(text or "", style=p_style, spacing_after=0)
    shading = '<w:shd w:val="clear" w:color="auto" w:fill="F2E6D1"/>' if header else ""
    tc_props = (
        "<w:tcPr>"
        "<w:tcW w:w=\"0\" w:type=\"auto\"/>"
        f"{shading}"
        "</w:tcPr>"
    )
    return f"<w:tc>{tc_props}{paragraph}</w:tc>"


def make_table(block: TableBlock) -> str:
    rows_xml: list[str] = []
    if block.header:
        header_cells = "".join(make_table_cell(cell, header=True) for cell in block.header)
        rows_xml.append(f"<w:tr>{header_cells}</w:tr>")
    for row in block.rows:
        row_cells = "".join(make_table_cell(cell) for cell in row)
        rows_xml.append(f"<w:tr>{row_cells}</w:tr>")
    tbl_props = (
        "<w:tblPr>"
        "<w:tblStyle w:val=\"TableGrid\"/>"
        "<w:tblW w:w=\"0\" w:type=\"auto\"/>"
        "<w:tblBorders>"
        "<w:top w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"D9D1C2\"/>"
        "<w:left w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"D9D1C2\"/>"
        "<w:bottom w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"D9D1C2\"/>"
        "<w:right w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"D9D1C2\"/>"
        "<w:insideH w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"D9D1C2\"/>"
        "<w:insideV w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"D9D1C2\"/>"
        "</w:tblBorders>"
        "</w:tblPr>"
    )
    return f"<w:tbl>{tbl_props}{''.join(rows_xml)}</w:tbl>"


def blocks_to_document_xml(blocks: list[Block]) -> str:
    body_parts: list[str] = []

    for block in blocks:
        if isinstance(block, HeadingBlock):
            style = f"Heading{min(block.level, 3)}" if block.level <= 3 else "Heading3"
            body_parts.append(make_paragraph(block.text, style=style, spacing_before=160, spacing_after=120))
            continue

        if isinstance(block, ParagraphBlock):
            body_parts.append(make_paragraph(block.text))
            continue

        if isinstance(block, ListBlock):
            for index, item in enumerate(block.items, start=1):
                prefix = f"{index}. " if block.ordered else "• "
                body_parts.append(make_paragraph(prefix + item.replace("\n", "\n   "), style="ListParagraph", spacing_after=80))
            continue

        if isinstance(block, TableBlock):
            body_parts.append(make_table(block))
            body_parts.append(make_paragraph("", spacing_after=60))
            continue

        if isinstance(block, CodeBlock):
            if block.language == "mermaid":
                body_parts.append(make_paragraph("Mermaid Diagram Source", style="Heading3", spacing_before=140, spacing_after=80))
            elif block.language:
                body_parts.append(make_paragraph(f"Code Block ({block.language})", style="Heading3", spacing_before=140, spacing_after=80))
            body_parts.append(make_paragraph(block.code, shaded=True, spacing_after=140))
            continue

    sect_pr = (
        "<w:sectPr>"
        "<w:pgSz w:w=\"11906\" w:h=\"16838\"/>"
        "<w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1134\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>"
        "</w:sectPr>"
    )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body_parts)}{sect_pr}</w:body>"
        "</w:document>"
    )


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
      <w:color w:val="172033"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="34"/>
      <w:color w:val="203257"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="203257"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="2A3B60"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="360" w:hanging="180"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader">
    <w:name w:val="Table Header"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:color w:val="5F3D00"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableCell">
    <w:name w:val="Table Cell"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>
"""


def build_docx(document_xml: str) -> None:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

    root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

    document_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"""

    core_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>CLARA Project Flowchart</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
</cp:coreProperties>
"""

    app_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties
  xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>
"""

    with ZipFile(DOCX_OUTPUT_PATH, "w", compression=ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types)
        docx.writestr("_rels/.rels", root_rels)
        docx.writestr("docProps/core.xml", core_xml)
        docx.writestr("docProps/app.xml", app_xml)
        docx.writestr("word/document.xml", document_xml)
        docx.writestr("word/styles.xml", styles_xml())
        docx.writestr("word/_rels/document.xml.rels", document_rels)


def main() -> None:
    markdown = INPUT_PATH.read_text(encoding="utf-8")
    blocks = parse_markdown(markdown)
    document_xml = blocks_to_document_xml(blocks)
    build_docx(document_xml)
    print(f"Generated {DOCX_OUTPUT_PATH.relative_to(ROOT_DIR)}")


if __name__ == "__main__":
    main()
