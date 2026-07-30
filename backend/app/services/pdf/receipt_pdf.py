import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BOX_BG = colors.HexColor("#F5F7FA")
BORDER = colors.HexColor("#D8DEE6")
MUTED = colors.HexColor("#5B6472")
FOREGROUND = colors.HexColor("#1A1F29")
ACCENT = colors.HexColor("#0EA5A4")


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReceiptTitle", fontSize=18, leading=22, textColor=FOREGROUND, spaceAfter=2))
    styles.add(ParagraphStyle(name="ReceiptSubtitle", fontSize=9, textColor=MUTED, spaceAfter=12))
    styles.add(ParagraphStyle(name="SectionHeading", fontSize=10, textColor=FOREGROUND, spaceBefore=10, spaceAfter=4, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name="Footer", fontSize=8, textColor=MUTED, spaceBefore=18))
    return styles


_VALUE_CELL_STYLE = ParagraphStyle(name="ValueCell", fontSize=9, fontName="Helvetica-Bold", textColor=FOREGROUND, leading=11)


def _money(amount) -> str:
    if amount is None:
        return "—"
    # Reportlab's built-in Helvetica font has no glyph for "₦" (renders as a
    # broken box) and pulling in a Unicode TTF would reintroduce the kind of
    # system-font dependency reportlab was chosen to avoid — use ASCII instead.
    return f"NGN {amount:,.0f}"


def _liters(value) -> str:
    if value is None:
        return "—"
    return f"{value:,.0f}L"


def _dt(value) -> str:
    if not value:
        return "—"
    if isinstance(value, str):
        return value
    return value.strftime("%d %b %Y, %I:%M %p")


def _label_value_table(rows, col_widths=(55 * mm, 90 * mm)):
    # Wrap values in a Paragraph so long text (addresses, failure reasons)
    # wraps within the column instead of overflowing past the table border.
    wrapped_rows = [[label, Paragraph(str(value), _VALUE_CELL_STYLE)] for label, value in rows]
    table = Table(wrapped_rows, colWidths=list(col_widths))
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (0, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, 0), (-1, -1), BOX_BG),
        ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0, colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def _header(elements, styles, title, generated_note=True):
    elements.append(Paragraph("TankUp", ParagraphStyle(name="Wordmark", fontSize=14, textColor=ACCENT, fontName="Helvetica-Bold")))
    elements.append(Paragraph(title, styles["ReceiptTitle"]))
    if generated_note:
        elements.append(Paragraph(f"Generated {_dt(datetime.utcnow())}", styles["ReceiptSubtitle"]))
    else:
        elements.append(Spacer(1, 10))


def _footer(elements, styles):
    elements.append(Paragraph("This is a computer-generated receipt and does not require a signature.", styles["Footer"]))


def render_customer_receipt(data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm, leftMargin=20 * mm, rightMargin=20 * mm)
    styles = _styles()
    elements = []

    delivery_type_label = "Exclusive Delivery" if data["delivery_type"] == "priority" else "Standard Delivery"
    is_success = data.get("request_status") == "completed" and not data.get("failure_reason")

    _header(elements, styles, "Delivery Receipt" if is_success else "Delivery Outcome")

    elements.append(Paragraph("Order", styles["SectionHeading"]))
    elements.append(_label_value_table([
        ["Request ID", f"#{data['request_id']}"],
        ["Delivery type", delivery_type_label],
        ["Requested on", _dt(data["created_at"])],
        ["Completed on", _dt(data["completed_at"])],
    ]))

    elements.append(Paragraph("Customer", styles["SectionHeading"]))
    elements.append(_label_value_table([
        ["Name", data.get("customer_name") or "—"],
        ["Phone", data.get("customer_phone") or "—"],
        ["Address", data.get("customer_address") or "—"],
    ]))

    elements.append(Paragraph("Delivery", styles["SectionHeading"]))
    elements.append(_label_value_table([
        ["Driver", data.get("driver_name") or "—"],
        ["Requested volume", _liters(data.get("planned_liters"))],
        ["Delivered volume", _liters(data.get("actual_liters_delivered"))],
        ["OTP", data.get("otp") or "—"],
    ]))

    if not is_success:
        elements.append(Paragraph("Outcome", styles["SectionHeading"]))
        outcome_rows = [
            ["Status", (data.get("request_status") or "failed").replace("_", " ").title()],
            ["Reason", data.get("failure_reason") or "Not specified"],
        ]
        elements.append(_label_value_table(outcome_rows))

        elements.append(Paragraph("Refund", styles["SectionHeading"]))
        refund_rows = [
            ["Refund status", (data.get("refund_status") or "none").replace("_", " ").title()],
            ["Refund amount", _money(data.get("refund_amount"))],
        ]
        elements.append(_label_value_table(refund_rows))
        if data.get("refund_is_derived") and data.get("refund_amount"):
            pct = (data["refund_amount"] / data["price"] * 100) if data.get("price") else 0
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(
                f"Refund calculated as {pct:.0f}% of the {_money(data.get('price'))} exclusive-delivery price.",
                styles["ReceiptSubtitle"],
            ))

    elements.append(Paragraph("Payment", styles["SectionHeading"]))
    amount_label = "Amount charged" if is_success else "Amount paid"
    elements.append(_label_value_table([[amount_label, _money(data.get("price"))]]))
    if data["delivery_type"] == "priority":
        elements.append(Spacer(1, 4))
        elements.append(Paragraph("Flat exclusive-delivery rate — a dedicated tanker, not billed per liter.", styles["ReceiptSubtitle"]))
    elif data.get("price_is_estimated"):
        elements.append(Spacer(1, 4))
        elements.append(Paragraph("Estimated from standard batch pricing.", styles["ReceiptSubtitle"]))

    _footer(elements, styles)
    doc.build(elements)
    return buffer.getvalue()


def render_driver_receipt(data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm, leftMargin=20 * mm, rightMargin=20 * mm)
    styles = _styles()
    elements = []

    job_type_label = "Exclusive Delivery" if data["job_type"] == "priority" else "Batch Delivery"

    _header(elements, styles, "Driver Job Receipt")

    elements.append(Paragraph("Job", styles["SectionHeading"]))
    elements.append(_label_value_table([
        ["Job ID", f"#{data['job_id']}"],
        ["Job type", job_type_label],
        ["Driver", data.get("driver_name") or "—"],
        ["Status", (data.get("job_status") or "—").replace("_", " ").title()],
    ]))

    elements.append(Paragraph("Trip Summary", styles["SectionHeading"]))
    summary_table = Table([
        ["Stops", "Delivered", "Failed", "Skipped", "Planned", "Delivered"],
        [
            str(data["total_stops"]),
            str(data["delivered_stops"]),
            str(data["failed_stops"]),
            str(data["skipped_stops"]),
            _liters(data["total_planned_liters"]),
            _liters(data["total_actual_liters_delivered"]),
        ],
    ], colWidths=[24 * mm] * 6)
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("TEXTCOLOR", (0, 1), (-1, 1), FOREGROUND),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND", (0, 0), (-1, -1), BOX_BG),
        ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(summary_table)

    elements.append(Paragraph("Stops", styles["SectionHeading"]))
    stop_rows = [["#", "Customer", "Delivered", "Status"]]
    for stop in data["stops"]:
        status_text = (stop["delivery_status"] or "—").replace("_", " ").title()
        if stop.get("failure_reason"):
            status_text += f" ({stop['failure_reason']})"
        stop_rows.append([
            str(stop.get("stop_order") or "—"),
            stop.get("customer_name") or "—",
            _liters(stop.get("actual_liters_delivered")),
            status_text,
        ])
    stop_table = Table(stop_rows, colWidths=[10 * mm, 60 * mm, 30 * mm, 45 * mm])
    stop_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(stop_table)

    elements.append(Paragraph("Earnings Breakdown", styles["SectionHeading"]))
    earning_rows = [["#", "Volume Pay", "Stop Bonus", "Site Bonus", "Total"]]
    for stop in data["stops"]:
        earning_rows.append([
            str(stop.get("stop_order") or "—"),
            _money(stop["volume_earnings"]),
            _money(stop["stop_bonus"]),
            _money(stop["site_bonus"]),
            _money(stop["total_earnings"]),
        ])
    earning_rows.append(["", "", "", "Total", _money(data["total_job_earnings"])])
    earning_table = Table(earning_rows, colWidths=[10 * mm, 33.75 * mm, 33.75 * mm, 33.75 * mm, 33.75 * mm])
    earning_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, FOREGROUND),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(earning_table)

    _footer(elements, styles)
    doc.build(elements)
    return buffer.getvalue()
