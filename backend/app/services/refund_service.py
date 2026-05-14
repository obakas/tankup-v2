from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.batch_member import BatchMember


def is_member_eligible_for_refund(member: BatchMember, batch: Batch) -> bool:
    return (
        batch.status in ["expired", "assignment_failed"]
        and member.status == "active"
        and member.payment_status == "paid"
        and member.refund_status in ["none", "failed"]
    )


def build_refund_reference(member_id: int) -> str:
    return f"batch-member-refund-{member_id}"


def calculate_member_refund_amount(member: BatchMember) -> float:
    if getattr(member, "amount_paid", None) is not None:
        return float(member.amount_paid)
    raise ValueError("No refundable amount found for member")


def mark_member_forfeited(db: Session, member: BatchMember):
    member.refund_status = "forfeited"
    member.refund_failure_reason = None
    member.refunded_at = None
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def execute_member_refund(db: Session, member: BatchMember, batch: Batch):
    if member.refund_status == "refunded":
        return {
            "success": True,
            "already_refunded": True,
            "refund_status": member.refund_status,
            "refund_amount": member.refund_amount,
            "refund_reference": member.refund_reference,
            "refunded_at": member.refunded_at,
        }

    if not is_member_eligible_for_refund(member, batch):
        raise HTTPException(status_code=400, detail="Member is not eligible for refund")

    refund_amount = calculate_member_refund_amount(member)
    refund_reference = member.refund_reference or build_refund_reference(member.id)

    try:
        # Step 1: mark processing before external call
        member.refund_status = "processing"
        member.refund_requested_at = member.refund_requested_at or datetime.utcnow()
        member.refund_amount = refund_amount
        member.refund_reference = refund_reference
        member.refund_failure_reason = None
        db.add(member)
        db.commit()
        db.refresh(member)

        # Step 2: external payment gateway call would happen here
        # Example:
        # gateway_result = refund_payment(
        #     reference=refund_reference,
        #     amount=refund_amount,
        #     member_id=member.id,
        # )
        #
        # For now, simulate success:
        gateway_result = {"success": True}

        if not gateway_result["success"]:
            member.refund_status = "failed"
            member.refund_failure_reason = "Gateway refund failed"
            db.add(member)
            db.commit()
            db.refresh(member)
            raise HTTPException(status_code=502, detail="Refund gateway failed")

        # Step 3: finalize success
        member.refund_status = "refunded"
        member.refunded_at = datetime.utcnow()
        member.refund_failure_reason = None
        db.add(member)
        db.commit()
        db.refresh(member)

        return {
            "success": True,
            "already_refunded": False,
            "refund_status": member.refund_status,
            "refund_amount": member.refund_amount,
            "refund_reference": member.refund_reference,
            "refunded_at": member.refunded_at,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()

        # best effort mark failed if possible
        try:
            member.refund_status = "failed"
            member.refund_failure_reason = str(e)
            db.add(member)
            db.commit()
            db.refresh(member)
        except Exception:
            db.rollback()

        raise HTTPException(status_code=500, detail="Refund processing failed")