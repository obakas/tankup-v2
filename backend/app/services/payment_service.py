from __future__ import annotations

import random
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember
from app.models.payment import Payment
from app.services.batch_orchestration_service import handle_batch_payment_confirmed


# -----------------------------
# Helpers
# -----------------------------

def generate_delivery_code() -> str:
    return str(random.randint(1000, 9999))


def get_payment_by_id(db: Session, payment_id: int) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


def get_member_by_id(db: Session, member_id: int) -> BatchMember:
    member = db.query(BatchMember).filter(BatchMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


def get_member_payment(db: Session, member_id: int) -> Payment | None:
    return db.query(Payment).filter(Payment.member_id == member_id).first()


def calculate_member_cost(batch: Batch, member_volume: int) -> float:
    """
    Cost based on batch base price and target volume.
    Example:
      base_price = 40000
      target_volume = 10000
      member_volume = 2000
      -> cost = 8000
    """
    if not batch.target_volume or batch.target_volume <= 0:
        raise HTTPException(status_code=400, detail="Invalid batch target volume")

    price_per_liter = batch.base_price / batch.target_volume
    return member_volume * price_per_liter


def build_payment_response(
    *,
    message: str,
    payment: Payment,
    member: BatchMember,
    batch_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "message": message,
        "payment_id": payment.id,
        "member_id": member.id,
        "batch_id": member.batch_id,
        "member_status": member.status,
        "member_payment_status": member.payment_status,
        "payment_status": payment.status,
        "delivery_code": member.delivery_code,
        "batch_snapshot": batch_snapshot,
    }


# -----------------------------
# Payment lifecycle
# -----------------------------

def initiate_payment(db: Session, member_id: int) -> Payment:
    """
    Create a new payment record for a batch member.

    Assumptions:
    - member.status before payment is usually 'pending'
    - member.payment_status before payment is usually 'unpaid'
    """
    member = get_member_by_id(db, member_id)

    if member.status in {"withdrawn", "expired", "delivered"}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot initiate payment for member with status '{member.status}'",
        )

    existing_payment = get_member_payment(db, member_id)
    if existing_payment and existing_payment.status in {"pending", "paid"}:
        return existing_payment

    batch = db.query(Batch).filter(Batch.id == member.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    amount = calculate_member_cost(batch, member.volume_liters)

    payment = Payment(
        member_id=member.id,
        amount=amount,
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def fail_payment(db: Session, payment_id: int, reason: str | None = None) -> Payment:
    """
    Mark payment as failed.
    Optionally also reflect failure on member.payment_status.
    """
    payment = get_payment_by_id(db, payment_id)
    member = get_member_by_id(db, payment.member_id)

    if payment.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot fail an already paid payment")

    payment.status = "failed"
    member.payment_status = "failed"

    db.add(payment)
    db.add(member)
    db.commit()
    db.refresh(payment)
    return payment


def expire_payment(db: Session, payment_id: int) -> Payment:
    """
    Mark payment and member as expired when deadline passes.
    """
    payment = get_payment_by_id(db, payment_id)
    member = get_member_by_id(db, payment.member_id)

    if payment.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot expire an already paid payment")

    payment.status = "expired"
    member.payment_status = "expired"

    if member.status == "pending":
        member.status = "expired"

    db.add(payment)
    db.add(member)
    db.commit()
    db.refresh(payment)
    return payment


def refund_payment(db: Session, payment_id: int) -> Payment:
    """
    Mark payment as refunded.
    Actual refund gateway logic should live elsewhere.
    """
    payment = get_payment_by_id(db, payment_id)
    member = get_member_by_id(db, payment.member_id)

    if payment.status != "paid":
        raise HTTPException(status_code=400, detail="Only paid payments can be refunded")

    payment.status = "refunded"
    member.payment_status = "refunded"

    db.add(payment)
    db.add(member)
    db.commit()
    db.refresh(payment)
    return payment


def confirm_payment(db: Session, payment_id: int) -> dict[str, Any]:
    """
    Confirm a member payment and activate the member in the batch.

    Canonical rules:
    - payment.status -> paid
    - member.payment_status -> paid
    - member.status -> active
    - member.delivery_code generated once on successful payment
    - orchestration runs after commit
    """
    payment = get_payment_by_id(db, payment_id)
    member = get_member_by_id(db, payment.member_id)

    # Idempotency: already fully confirmed
    if payment.status == "paid" and member.payment_status == "paid" and member.status == "active":
        return build_payment_response(
            message="Payment already confirmed",
            payment=payment,
            member=member,
            batch_snapshot=None,
        )

    # Member is not in a valid state for confirmation
    if member.status in {"withdrawn", "expired", "delivered"}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm payment for member with status '{member.status}'",
        )

    # Deadline check
    if member.payment_deadline and datetime.utcnow() > member.payment_deadline:
        payment.status = "expired"
        member.payment_status = "expired"

        if member.status == "pending":
            member.status = "expired"

        db.add(payment)
        db.add(member)
        db.commit()
        db.refresh(payment)
        db.refresh(member)

        return build_payment_response(
            message="Payment expired",
            payment=payment,
            member=member,
            batch_snapshot=None,
        )

    # Confirm payment
    payment.status = "paid"
    member.payment_status = "paid"
    member.status = "active"

    # Keep the first generated code if this is retried after partial writes
    if not member.delivery_code:
        member.delivery_code = generate_delivery_code()

    # Optional bookkeeping fields if present on model
    if hasattr(member, "amount_paid"):
        member.amount_paid = float(payment.amount)

    if hasattr(member, "refund_status") and not member.refund_status:
        member.refund_status = "none"

    if hasattr(member, "is_active"):
        member.is_active = True

    db.add(payment)
    db.add(member)
    db.commit()
    db.refresh(payment)
    db.refresh(member)

    # Trigger batch lifecycle refresh / assignment logic
    orchestration_result = handle_batch_payment_confirmed(
        db,
        batch_id=member.batch_id,
        member_id=member.id,
    )

    return build_payment_response(
        message="Payment confirmed",
        payment=payment,
        member=member,
        batch_snapshot=orchestration_result,
    )