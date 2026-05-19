"""
Renders LAUNCH_PLAYBOOK.md → LAUNCH_PLAYBOOK.pdf.

Cover page: dark aubergine + gold KISMET wordmark + tagline.
Body pages: cream paper, dark aubergine ink, gold accents on headings, mono
for code/tables, serif italic for blockquotes. Designed to be readable as a
real reference document, not a brochure.

Run: python scripts/gen_playbook_pdf.py
"""

import os, re, sys, math
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame,
    Paragraph, Spacer, PageBreak, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.pdfgen.canvas import Canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "LAUNCH_PLAYBOOK.md")
OUT  = os.path.join(ROOT, "LAUNCH_PLAYBOOK.pdf")

# ------------- BRAND PALETTE ------------------------------------------------

AUBERGINE   = colors.HexColor("#0a0612")
AUB_PANEL   = colors.HexColor("#1a0e2a")
INK         = colors.HexColor("#22142a")
INK_DIM     = colors.HexColor("#6a5a6e")
GOLD_DARK   = colors.HexColor("#a06d1f")
GOLD        = colors.HexColor("#c69241")
GOLD_BRIGHT = colors.HexColor("#d4a657")
GOLD_GLOW   = colors.HexColor("#f0c674")
CREAM       = colors.HexColor("#fbf7ee")
CREAM_RULE  = colors.HexColor("#d8cbb0")
ROSE_DIM    = colors.HexColor("#8a5a6e")
CODE_BG     = colors.HexColor("#1d1226")
CODE_INK    = colors.HexColor("#ede4d3")
TABLE_ROW_A = colors.HexColor("#f5ecd6")
TABLE_ROW_B = colors.HexColor("#fbf7ee")
TABLE_HEAD  = colors.HexColor("#22142a")

# ------------- STYLES -------------------------------------------------------

# Use Times for serif body, Courier for mono, Helvetica for sans uppercase.
BODY_FONT      = "Times-Roman"
BODY_ITAL_FONT = "Times-Italic"
BODY_BOLD_FONT = "Times-Bold"
SANS_FONT      = "Helvetica"
SANS_BOLD_FONT = "Helvetica-Bold"
MONO_FONT      = "Courier"
MONO_BOLD_FONT = "Courier-Bold"

styles = {
    "h1": ParagraphStyle("h1", fontName=BODY_BOLD_FONT, fontSize=24, leading=30,
                          textColor=GOLD_DARK, spaceBefore=22, spaceAfter=12),
    "h2": ParagraphStyle("h2", fontName=BODY_BOLD_FONT, fontSize=17, leading=22,
                          textColor=GOLD_DARK, spaceBefore=18, spaceAfter=8),
    "h3": ParagraphStyle("h3", fontName=BODY_ITAL_FONT, fontSize=14, leading=18,
                          textColor=GOLD_DARK, spaceBefore=14, spaceAfter=4),
    "body": ParagraphStyle("body", fontName=BODY_FONT, fontSize=11, leading=16,
                            textColor=INK, spaceAfter=8, alignment=TA_LEFT),
    "li": ParagraphStyle("li", parent=None, fontName=BODY_FONT, fontSize=11,
                          leading=16, textColor=INK, leftIndent=18, bulletIndent=4,
                          spaceAfter=3),
    "blockquote_lead": ParagraphStyle("bq_lead", fontName=BODY_ITAL_FONT, fontSize=14,
                                       leading=20, textColor=GOLD_DARK,
                                       leftIndent=14, rightIndent=14,
                                       spaceBefore=6, spaceAfter=10),
    "blockquote": ParagraphStyle("bq", fontName=BODY_FONT, fontSize=11,
                                  leading=17, textColor=INK_DIM, fontStyle="italic",
                                  leftIndent=18, rightIndent=14,
                                  spaceBefore=4, spaceAfter=4),
    "code": ParagraphStyle("code", fontName=MONO_FONT, fontSize=9, leading=13,
                            textColor=CODE_INK, leftIndent=12, rightIndent=12,
                            spaceBefore=8, spaceAfter=10, backColor=CODE_BG,
                            borderPadding=10),
    "caption": ParagraphStyle("caption", fontName=MONO_FONT, fontSize=8.5,
                               leading=12, textColor=INK_DIM, leftIndent=14,
                               spaceAfter=14),
    "callout": ParagraphStyle("callout", fontName=BODY_ITAL_FONT, fontSize=12,
                               leading=17, textColor=GOLD_DARK, alignment=TA_CENTER,
                               spaceBefore=14, spaceAfter=14),
    "footer_mono": ParagraphStyle("footer", fontName=MONO_FONT, fontSize=8,
                                   leading=10, textColor=INK_DIM, alignment=TA_CENTER),
}

# ------------- COVER / BACKGROUND CHROME ------------------------------------

def draw_page_chrome(canvas: Canvas, doc):
    """Cream page background + subtle gold rule footer with brand mark."""
    w, h = LETTER
    # Background
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    # Footer
    canvas.setStrokeColor(CREAM_RULE)
    canvas.setLineWidth(0.4)
    canvas.line(0.75 * inch, 0.55 * inch, w - 0.75 * inch, 0.55 * inch)
    # Footer text
    canvas.setFillColor(INK_DIM)
    canvas.setFont(MONO_FONT, 7.5)
    canvas.drawString(0.75 * inch, 0.38 * inch, "K · I · S · M · E · T   ·   LAUNCH PLAYBOOK")
    canvas.drawRightString(w - 0.75 * inch, 0.38 * inch, f"PAGE {doc.page}")
    # Top-right tiny stamp
    canvas.setFillColor(GOLD_DARK)
    canvas.setFont(MONO_FONT, 7.5)
    canvas.drawRightString(w - 0.75 * inch, h - 0.42 * inch, "kismet.cards")
    canvas.restoreState()


def draw_cover(canvas: Canvas, doc):
    """Dark aubergine cover page."""
    w, h = LETTER
    canvas.saveState()
    # Aubergine
    canvas.setFillColor(AUBERGINE)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    # Inner panel
    canvas.setFillColor(AUB_PANEL)
    canvas.rect(0.6 * inch, 0.6 * inch, w - 1.2 * inch, h - 1.2 * inch, fill=1, stroke=0)
    # Border
    canvas.setStrokeColor(GOLD_DARK)
    canvas.setLineWidth(0.6)
    canvas.rect(0.6 * inch, 0.6 * inch, w - 1.2 * inch, h - 1.2 * inch, fill=0, stroke=1)

    # Eyebrow
    canvas.setFillColor(CODE_INK)
    canvas.setFont(MONO_FONT, 10)
    canvas.drawCentredString(w / 2, h - 2.2 * inch, "EST. BY THE POSITION OF THINGS")

    # Wordmark — sized to fit comfortably inside the panel
    canvas.setFillColor(GOLD_GLOW)
    canvas.setFont(BODY_BOLD_FONT, 36)
    canvas.drawCentredString(w / 2, h - 3.6 * inch, "K · I · S · M · E · T")

    # Title
    canvas.setFillColor(CODE_INK)
    canvas.setFont(BODY_ITAL_FONT, 28)
    canvas.drawCentredString(w / 2, h - 4.4 * inch, "Launch Playbook")

    # Subtitle
    canvas.setFillColor(GOLD)
    canvas.setFont(BODY_FONT, 12)
    canvas.drawCentredString(w / 2, h - 4.8 * inch, "The reading the algorithm wrote for you.")

    # Vector glyph — drawn (no font dependency); a hexagram with internal lines.
    cx, cy = w / 2, h - 6.4 * inch
    R = 24
    canvas.setStrokeColor(GOLD_GLOW)
    canvas.setLineWidth(1.2)
    canvas.setLineCap(1)
    pts = []
    for i in range(6):
        angle = math.pi / 3 * i - math.pi / 2
        pts.append((cx + R * math.cos(angle), cy + R * math.sin(angle)))
    path = canvas.beginPath()
    path.moveTo(*pts[0])
    for pt in pts[1:]:
        path.lineTo(*pt)
    path.close()
    canvas.drawPath(path)
    canvas.line(pts[0][0], pts[0][1], pts[3][0], pts[3][1])
    canvas.line(pts[1][0], pts[1][1], pts[4][0], pts[4][1])
    canvas.line(pts[2][0], pts[2][1], pts[5][0], pts[5][1])
    # Tiny dot center
    canvas.setFillColor(GOLD_GLOW)
    canvas.circle(cx, cy, 1.5, fill=1, stroke=0)

    # Footer
    canvas.setFillColor(CODE_INK)
    canvas.setFont(MONO_FONT, 9)
    canvas.drawCentredString(w / 2, 1.3 * inch, "$7.99 / MONTH   ·   DAILY READINGS   ·   SHADOW   ·   COMPATIBILITY   ·   YEAR AHEAD")
    canvas.setFillColor(GOLD_DARK)
    canvas.setFont(MONO_FONT, 8.5)
    canvas.drawCentredString(w / 2, 1.05 * inch, "kismet.cards")

    canvas.restoreState()

# ------------- MARKDOWN PARSING --------------------------------------------

# Convert markdown inline syntax to ReportLab Paragraph XML.
INLINE_CODE_RE = re.compile(r"`([^`]+)`")
BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
ITAL_RE = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")

def inline(text: str) -> str:
    # Order matters: escape XML special chars, then mark up.
    t = (text.replace("&", "&amp;")
              .replace("<", "&lt;")
              .replace(">", "&gt;"))
    # Replace emoji / glyphs that Times-Roman doesn't render (they'd appear as tofu boxes).
    # Done AFTER escaping so the substituted markup tags survive.
    t = t.replace("✅", '<font name="Helvetica-Bold" color="#a06d1f">YES</font>')
    t = t.replace("🪞", "")
    t = t.replace("⌬", "")
    t = INLINE_CODE_RE.sub(lambda m: f'<font name="{MONO_FONT}" color="#a06d1f" size="9.5">{m.group(1)}</font>', t)
    t = BOLD_RE.sub(lambda m: f"<b>{m.group(1)}</b>", t)
    t = ITAL_RE.sub(lambda m: f"<i>{m.group(1)}</i>", t)
    t = LINK_RE.sub(lambda m: f'<font color="#a06d1f"><u>{m.group(1)}</u></font>  <font color="#6a5a6e" size="8">({m.group(2)})</font>', t)
    return t


def parse_table(lines):
    """Given the markdown table lines, return a list of rows (each a list of cells)."""
    rows = []
    for raw in lines:
        if not raw.strip().startswith("|"):
            break
        # Skip separator row like |---|---|
        if re.match(r"^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$", raw):
            continue
        cells = [c.strip() for c in raw.strip().strip("|").split("|")]
        rows.append(cells)
    return rows


def md_to_flowables(md_text: str):
    """Walk the markdown line-by-line and emit ReportLab flowables."""
    flow = []
    lines = md_text.split("\n")
    i = 0
    n = len(lines)
    saw_first_h1 = False

    while i < n:
        line = lines[i]

        # Horizontal rule
        if re.match(r"^\s*---+\s*$", line):
            flow.append(HRFlowable(width="100%", thickness=0.5,
                                    color=CREAM_RULE, spaceBefore=10, spaceAfter=10))
            i += 1
            continue

        # Fenced code
        if line.strip().startswith("```"):
            i += 1
            code_lines = []
            while i < n and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            # Render as KeepTogether code block
            esc = "\n".join(code_lines)
            esc = (esc.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
            esc_with_breaks = esc.replace("\n", "<br/>")
            flow.append(Paragraph(esc_with_breaks, styles["code"]))
            continue

        # Headings
        m = re.match(r"^(#{1,3})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            text = inline(m.group(2).strip())
            style_key = {1: "h1", 2: "h2", 3: "h3"}[level]
            if level == 1 and saw_first_h1:
                flow.append(PageBreak())
            saw_first_h1 = saw_first_h1 or (level == 1)
            flow.append(Paragraph(text, styles[style_key]))
            # Faint gold rule after H1 / H2
            if level <= 2:
                flow.append(HRFlowable(width="100%", thickness=0.3,
                                        color=GOLD_BRIGHT, spaceBefore=2, spaceAfter=6))
            i += 1
            continue

        # Blockquote
        if line.startswith(">"):
            qlines = []
            while i < n and lines[i].startswith(">"):
                qlines.append(lines[i][1:].strip())
                i += 1
            # First-quoted line of the document is treated as lead callout
            if not flow or (flow and not any(isinstance(f, Paragraph) and getattr(f, 'style', None) and f.style.name in ("body","li","blockquote") for f in flow[-3:])):
                pass
            # Join soft-wrapped lines
            quote_text = " ".join([q for q in qlines if q])
            if quote_text:
                # If looks like the top-of-doc "tagline" (italic + tight), use lead style
                if quote_text.startswith('"') or quote_text.startswith("“") or quote_text.startswith("*"):
                    flow.append(Paragraph(inline(quote_text), styles["blockquote_lead"]))
                else:
                    flow.append(Paragraph(inline(quote_text), styles["blockquote"]))
            continue

        # Table
        if line.lstrip().startswith("|"):
            block = []
            while i < n and lines[i].lstrip().startswith("|"):
                block.append(lines[i])
                i += 1
            rows = parse_table(block)
            if rows:
                # Render as ReportLab Table
                data = []
                for row in rows:
                    data.append([Paragraph(inline(c), ParagraphStyle(
                        "tcell", fontName=BODY_FONT, fontSize=10, leading=14, textColor=INK
                    )) for c in row])
                tbl = Table(data, repeatRows=1, hAlign="LEFT", colWidths=None)
                tbl.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEAD),
                    ("TEXTCOLOR", (0, 0), (-1, 0), CREAM),
                    ("FONTNAME", (0, 0), (-1, 0), SANS_BOLD_FONT),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [TABLE_ROW_A, TABLE_ROW_B]),
                    ("BOX", (0, 0), (-1, -1), 0.4, CREAM_RULE),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD_DARK),
                ]))
                # Replace the header row cells with white-on-aubergine
                head_style = ParagraphStyle("th", fontName=SANS_BOLD_FONT, fontSize=10,
                                             leading=14, textColor=CREAM)
                data[0] = [Paragraph(inline(c), head_style) for c in rows[0]]
                tbl = Table(data, repeatRows=1, hAlign="LEFT")
                tbl.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEAD),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("LEFTPADDING", (0, 0), (-1, -1), 9),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [TABLE_ROW_A, TABLE_ROW_B]),
                    ("BOX", (0, 0), (-1, -1), 0.4, CREAM_RULE),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.6, GOLD_DARK),
                ]))
                flow.append(Spacer(1, 6))
                flow.append(tbl)
                flow.append(Spacer(1, 10))
            continue

        # Unordered list
        if re.match(r"^\s*[-*]\s+", line):
            while i < n and re.match(r"^\s*[-*]\s+", lines[i]):
                item_text = re.sub(r"^\s*[-*]\s+", "", lines[i]).strip()
                bullet = "•"
                p = Paragraph(f'<font color="#a06d1f">{bullet}</font>&nbsp;&nbsp;{inline(item_text)}',
                              styles["li"])
                flow.append(p)
                i += 1
            flow.append(Spacer(1, 4))
            continue

        # Numbered list
        if re.match(r"^\s*\d+\.\s+", line):
            num = 1
            while i < n and re.match(r"^\s*\d+\.\s+", lines[i]):
                item_text = re.sub(r"^\s*\d+\.\s+", "", lines[i]).strip()
                p = Paragraph(f'<font color="#a06d1f">{num}.</font>&nbsp;&nbsp;{inline(item_text)}',
                              styles["li"])
                flow.append(p)
                num += 1
                i += 1
            flow.append(Spacer(1, 4))
            continue

        # Blank line
        if not line.strip():
            i += 1
            continue

        # Default: paragraph (may span multiple soft-wrapped lines)
        para = [line]
        i += 1
        while i < n and lines[i].strip() and not re.match(
            r"^\s*([-*]|\d+\.|>|#|---+|\|)", lines[i]
        ) and not lines[i].strip().startswith("```"):
            para.append(lines[i])
            i += 1
        joined = " ".join(p.strip() for p in para)
        flow.append(Paragraph(inline(joined), styles["body"]))

    return flow


# ------------- BUILD --------------------------------------------------------

def build():
    with open(SRC, "r", encoding="utf-8") as f:
        md = f.read()
    flowables = md_to_flowables(md)

    doc = BaseDocTemplate(OUT, pagesize=LETTER,
                          leftMargin=0.85 * inch, rightMargin=0.85 * inch,
                          topMargin=0.9 * inch, bottomMargin=0.75 * inch,
                          title="Kismet — Launch Playbook",
                          author="Kismet")

    cover_frame = Frame(0.6 * inch, 0.6 * inch,
                         LETTER[0] - 1.2 * inch, LETTER[1] - 1.2 * inch,
                         id="cover", showBoundary=0,
                         leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    body_frame = Frame(0.85 * inch, 0.75 * inch,
                       LETTER[0] - 1.7 * inch, LETTER[1] - 1.65 * inch,
                       id="body", showBoundary=0)

    cover_template = PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover)
    body_template  = PageTemplate(id="body",  frames=[body_frame],  onPage=draw_page_chrome)
    doc.addPageTemplates([cover_template, body_template])

    story = []
    # Empty content on cover (drawn directly), then jump to body template
    story.append(Spacer(1, 1))  # forces the cover page to render
    story.append(PageBreak())
    # Switch template
    from reportlab.platypus.doctemplate import NextPageTemplate
    story.insert(1, NextPageTemplate("body"))
    story += flowables

    doc.build(story)
    print(f"wrote: {OUT}")
    print(f"size:  {os.path.getsize(OUT) / 1024:.1f} KB")


if __name__ == "__main__":
    build()
