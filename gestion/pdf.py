"""Devis and purchase orders as PDF (reportlab)."""
from io import BytesIO
from xml.sax.saxutils import escape
from pathlib import Path

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY = colors.HexColor("#0b1f3a")
BLUE = colors.HexColor("#1d6fd8")
LIGHT = colors.HexColor("#eef3fa")
GREY = colors.HexColor("#5b6578")


def _fonts():
    """Arial on Windows (full accents), Helvetica elsewhere."""
    for folder in [Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")]:
        for regular, bold in [("arial.ttf", "arialbd.ttf"), ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf")]:
            if (folder / regular).exists() and (folder / bold).exists():
                try:
                    pdfmetrics.registerFont(TTFont("TW", str(folder / regular)))
                    pdfmetrics.registerFont(TTFont("TW-Bold", str(folder / bold)))
                    pdfmetrics.registerFontFamily("TW", normal="TW", bold="TW-Bold", italic="TW", boldItalic="TW-Bold")
                    return "TW", "TW-Bold"
                except Exception:
                    pass
    return "Helvetica", "Helvetica-Bold"


def mad(value):
    value = round(float(value or 0), 2)
    whole, cents = divmod(round(abs(value) * 100), 100)
    text = f"{int(whole):,}".replace(",", " ")
    if cents:
        text += f",{int(cents):02d}"
    return f"{'-' if value < 0 else ''}{text} MAD"


def _doc(title, number, rows, party_title, party, meta, lines_head, lines, totals, notes, conditions):
    regular, bold = _fonts()
    st = {
        "n": ParagraphStyle("n", fontName=regular, fontSize=9, leading=12, textColor=colors.black),
        "s": ParagraphStyle("s", fontName=regular, fontSize=8, leading=10.5, textColor=GREY),
        "b": ParagraphStyle("b", fontName=bold, fontSize=9.5, leading=12),
        "h": ParagraphStyle("h", fontName=bold, fontSize=20, leading=24, textColor=NAVY, alignment=TA_RIGHT),
        "r": ParagraphStyle("r", fontName=regular, fontSize=9, leading=12, alignment=TA_RIGHT),
        "th": ParagraphStyle("th", fontName=bold, fontSize=8.5, leading=11, textColor=colors.white),
        "thr": ParagraphStyle("thr", fontName=bold, fontSize=8.5, leading=11, textColor=colors.white, alignment=TA_RIGHT),
    }
    tw = settings.TECHWARD
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=14 * mm, bottomMargin=18 * mm, title=f"{title} {number}",
                            author=tw["name"])
    width = A4[0] - 32 * mm

    logo_path = Path(settings.BASE_DIR) / "static" / "img" / "logo-full.png"
    if logo_path.exists():
        from reportlab.lib.utils import ImageReader
        iw, ih = ImageReader(str(logo_path)).getSize()
        logo = Image(str(logo_path), width=40 * mm, height=40 * mm * ih / iw, hAlign="LEFT")
    else:
        logo = Paragraph(tw["name"], st["h"])
    company = [tw.get("address", ""), f"Tél. / WhatsApp : {tw['phone_display']}", tw["email"],
               *(f"{k} : {tw[k.lower()]}" for k in ("ICE", "RC", "IF") if tw.get(k.lower()))]
    company_par = Paragraph("<br/>".join(x for x in company if x), st["s"])
    title_par = [Paragraph(title.upper(), st["h"]), Spacer(1, 2),
                 Paragraph(f"N° <b>{number}</b>", st["r"])] + [Paragraph(m, st["r"]) for m in meta]
    head = Table([[[logo, Spacer(1, 4), company_par], title_par]], colWidths=[width * 0.55, width * 0.45])
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    party_box = Table([[Paragraph(party_title, st["s"])],
                       [Paragraph(f"<b>{escape(party[0])}</b>", st["b"])],
                       [Paragraph("<br/>".join(escape(x) for x in party[1:] if x), st["n"])]],
                      colWidths=[width * 0.5])
    party_box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (0, 0), 6),
                                   ("BOTTOMPADDING", (0, -1), (-1, -1), 8)]))
    party_row = Table([["", party_box]], colWidths=[width * 0.5, width * 0.5])
    party_row.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    data = [[Paragraph(h, st["th" if i == 0 else "thr"]) for i, h in enumerate(lines_head)]]
    for line in lines:
        data.append([Paragraph(escape(str(line[0])), st["n"])] + [Paragraph(str(c), st["r"]) for c in line[1:]])
    if not lines:
        data.append([Paragraph("—", st["n"]), "", "", ""])
    table = Table(data, colWidths=[width * 0.52, width * 0.1, width * 0.19, width * 0.19], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    tot_rows = [[Paragraph(label, st["b"] if strong else st["n"]), Paragraph(f"<b>{v}</b>" if strong else v, st["r"])]
                for label, v, strong in totals]
    tot = Table(tot_rows, colWidths=[width * 0.25, width * 0.2])
    tot.setStyle(TableStyle([("LINEABOVE", (0, -1), (-1, -1), 1, NAVY), ("BACKGROUND", (0, -1), (-1, -1), LIGHT),
                             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    tot_row = Table([["", tot]], colWidths=[width * 0.55, width * 0.45])
    tot_row.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    story = [head, Spacer(1, 8 * mm), party_row, Spacer(1, 7 * mm), table, Spacer(1, 4 * mm), tot_row]
    if notes:
        story += [Spacer(1, 6 * mm), Paragraph("<b>Notes</b>", st["b"]),
                  Paragraph(escape(notes).replace("\n", "<br/>"), st["n"])]
    if conditions:
        story += [Spacer(1, 6 * mm), Paragraph("<b>Conditions</b>", st["b"])]
        story += [Paragraph(f"• {c}", st["s"]) for c in conditions]

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setStrokeColor(BLUE)
        canvas.setLineWidth(1.2)
        canvas.line(16 * mm, 12 * mm, A4[0] - 16 * mm, 12 * mm)
        canvas.setFont(regular, 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(16 * mm, 8 * mm, f"{tw['name']} · Smart Security. Safer Spaces. · "
                                            f"{tw['phone_display']} · {tw['email']}")
        canvas.drawRightString(A4[0] - 16 * mm, 8 * mm, f"{number} · page {_doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def _d(value):
    return value.strftime("%d/%m/%Y") if value else ""


def quote_pdf(quote):
    c = quote.customer
    lines = [(line.description, line.quantity, mad(line.unit_price), mad(line.total)) for line in quote.lines.all()]
    totals = [("Sous-total", mad(quote.subtotal), False)]
    if quote.discount:
        totals.append(("Remise", "-" + mad(quote.discount), False))
    if quote.tva_rate:
        totals += [("Total HT", mad(quote.total_ht), False), (f"TVA {quote.tva_rate:g} %", mad(quote.tva), False),
                   ("Total TTC", mad(quote.total_ttc), True)]
    else:
        totals.append(("Total", mad(quote.total_ttc), True))
    conditions = [
        f"Devis valable jusqu'au {_d(quote.valid_until)}.",
        "Paiement en espèces à la confirmation du devis.",
        "Installation, câblage et configuration de l'application inclus lorsque mentionnés.",
        "Matériel garanti selon les conditions du fabricant.",
    ]
    return _doc("Devis", quote.number, None, "CLIENT",
                [c.name, c.address, c.city, c.phone, c.email, f"ICE : {c.ice}" if c.ice else ""],
                [f"Date : {_d(quote.date)}", f"Valable jusqu'au : {_d(quote.valid_until)}"],
                ["Désignation", "Qté", "Prix unitaire", "Total"], lines, totals, quote.notes, conditions)


def order_pdf(order):
    s = order.supplier
    lines = [(f"{line.product.name_fr}" + (f" ({line.product.article.sku})" if getattr(line.product, "article", None)
                                            and line.product.article.sku else ""),
              line.quantity, mad(line.unit_cost), mad(line.total)) for line in order.lines.select_related("product")]
    meta = [f"Date : {_d(order.date)}"]
    if order.expected_date:
        meta.append(f"Livraison souhaitée : {_d(order.expected_date)}")
    conditions = ["Merci de confirmer la disponibilité, les prix et le délai de livraison.",
                  f"Livraison et facture au nom de {settings.TECHWARD['name']}."]
    return _doc("Bon de commande", order.number, None, "FOURNISSEUR",
                [s.name, s.contact_name, s.address, s.city, s.phone, s.email],
                meta, ["Article", "Qté", "Prix unitaire", "Total"], lines,
                [("Total", mad(order.total), True)], order.notes, conditions)
