from __future__ import annotations

import base64
import logging

import requests as http_requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_RESEND_API_URL = "https://api.resend.com/emails"


def _money(amount) -> str:
    if amount is None:
        return "—"
    return f"NGN {amount:,.0f}"


def _receipt_email_html(receipt_data: dict) -> str:
    delivery_type_label = "Exclusive Delivery" if receipt_data.get("delivery_type") == "priority" else "Standard Delivery"
    is_success = receipt_data.get("request_status") == "completed" and not receipt_data.get("failure_reason")
    amount_label = "Amount charged" if is_success else "Amount paid"

    return f"""
    <div style="font-family: Helvetica, Arial, sans-serif; color: #1A1F29; max-width: 480px; margin: 0 auto;">
      <p style="color: #0EA5A4; font-weight: bold; font-size: 16px; margin-bottom: 4px;">TankUp</p>
      <h2 style="margin-top: 0;">Your receipt for Request #{receipt_data.get('request_id')}</h2>
      <p>Thanks for using TankUp. Here's a summary of your {delivery_type_label.lower()}:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #5B6472;">Delivery type</td><td style="padding: 6px 0; text-align: right;">{delivery_type_label}</td></tr>
        <tr><td style="padding: 6px 0; color: #5B6472;">{amount_label}</td><td style="padding: 6px 0; text-align: right;">{_money(receipt_data.get('price'))}</td></tr>
      </table>
      <p>The full PDF receipt is attached to this email.</p>
      <p style="color: #5B6472; font-size: 12px; margin-top: 24px;">This is a computer-generated email and does not require a reply.</p>
    </div>
    """


def send_customer_receipt_email(to_email: str, pdf_bytes: bytes, receipt_data: dict) -> bool:
    request_id = receipt_data.get("request_id")
    try:
        payload = {
            "from": settings.RECEIPT_EMAIL_FROM,
            "to": [to_email],
            "subject": f"Your TankUp receipt — Request #{request_id}",
            "html": _receipt_email_html(receipt_data),
            "attachments": [
                {
                    "filename": f"tankup-receipt-{request_id}.pdf",
                    "content": base64.b64encode(pdf_bytes).decode("ascii"),
                }
            ],
        }
        resp = http_requests.post(
            _RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        try:
            body_json = resp.json()
        except Exception:
            body_json = resp.text
        logger.info("receipt email to=%s request_id=%s status=%s response=%s", to_email, request_id, resp.status_code, body_json)
        return resp.status_code in (200, 201)
    except Exception as exc:
        logger.error("receipt email send failed to=%s request_id=%s: %s", to_email, request_id, exc)
        return False
