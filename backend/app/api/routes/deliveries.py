from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.DeliveryRecord import DeliveryRecord
from app.schemas.delivery import (
    ConfirmOtpIn,
    DeliveryOut,
    FailDeliveryIn,
    FinishMeasurementIn,
    SkipDeliveryIn,
    StartMeasurementIn,
    TankerCurrentStopResponse,
)
from app.services.delivery_service import (
    arrive_delivery_stop,
    complete_delivery_stop,
    confirm_delivery_otp,
    fail_delivery_stop,
    finish_measurement,
    get_current_delivery_for_tanker,
    get_delivery_by_id,
    skip_delivery_stop,
    start_measurement,
)

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])

OTP_WINDOW_MINUTES = 15
ANOMALY_FACTOR = 1.2


def _get_owned_delivery_or_403(
    db: Session,
    *,
    tanker_id: int,
    delivery_id: int,
) -> DeliveryRecord:
    delivery = get_delivery_by_id(db, delivery_id)

    if delivery.tanker_id != tanker_id:
        raise HTTPException(
            status_code=403,
            detail="This tanker is not allowed to operate on this delivery record",
        )

    return delivery


@router.get(
    "/tankers/{tanker_id}/current-stop",
    response_model=TankerCurrentStopResponse,
)
def get_tanker_current_stop(
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Driver polling endpoint.
    Returns tanker meta, job meta, current stop, allowed actions,
    and stop summary for the active job.
    """
    return get_current_delivery_for_tanker(db, tanker_id)


@router.post("/{delivery_id}/arrive")
def arrive_at_delivery_stop(
    delivery_id: int,
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Mark that the tanker has arrived at the stop.
    Example:
      POST /deliveries/5/arrive?tanker_id=2
    """
    delivery = _get_owned_delivery_or_403(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    if delivery.delivery_status in {"delivered", "failed", "skipped"}:
        raise HTTPException(
            status_code=400,
            detail=f"Delivery already resolved as '{delivery.delivery_status}'",
        )

    delivery = arrive_delivery_stop(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    return {
        "message": "Arrived at delivery stop",
        "delivery": DeliveryOut.model_validate(delivery).model_dump(),
    }


@router.post("/{delivery_id}/start-measurement")
def begin_measurement(
    delivery_id: int,
    payload: StartMeasurementIn,
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Start meter measurement for a stop.
    """
    delivery = _get_owned_delivery_or_403(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    if delivery.delivery_status != "arrived":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start measurement from status '{delivery.delivery_status}'",
        )

    if delivery.measurement_required and payload.meter_start_reading < 0:
        raise HTTPException(
            status_code=400,
            detail="Meter start reading must be zero or greater",
        )

    if delivery.measurement_started_at is not None:
        raise HTTPException(
            status_code=400,
            detail="Measurement has already been started for this stop",
        )

    updated = start_measurement(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
        meter_start_reading=payload.meter_start_reading,
    )

    # make trust fields explicit
    updated.measurement_valid = False
    updated.anomaly_flagged = False
    updated.anomaly_reason = None

    db.add(updated)
    db.commit()
    db.refresh(updated)

    return {
        "message": "Measurement started",
        "delivery": DeliveryOut.model_validate(updated).model_dump(),
    }


@router.post("/{delivery_id}/finish-measurement")
def end_measurement(
    delivery_id: int,
    payload: FinishMeasurementIn,
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Finish meter measurement and move stop to awaiting_otp.
    STRICT:
    - end reading must be greater than start reading
    - delivered liters must be sensible
    """
    delivery = _get_owned_delivery_or_403(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    if delivery.delivery_status != "measuring":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot finish measurement from status '{delivery.delivery_status}'",
        )

    if delivery.meter_start_reading is None:
        raise HTTPException(
            status_code=400,
            detail="Meter start reading is missing",
        )

    if payload.meter_end_reading <= delivery.meter_start_reading:
        raise HTTPException(
            status_code=400,
            detail="Meter end reading must be greater than meter start reading",
        )

    measured_liters = payload.meter_end_reading - delivery.meter_start_reading

    updated = finish_measurement(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
        meter_end_reading=payload.meter_end_reading,
        notes=payload.notes,
    )

    updated.measurement_valid = True
    updated.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_WINDOW_MINUTES)

    if measured_liters > (updated.planned_liters * ANOMALY_FACTOR):
        updated.anomaly_flagged = True
        updated.anomaly_reason = (
            f"Measured liters {measured_liters:.2f} exceed "
            f"planned liters {updated.planned_liters:.2f} by more than 20%"
        )
    else:
        updated.anomaly_flagged = False
        updated.anomaly_reason = None

    db.add(updated)
    db.commit()
    db.refresh(updated)

    return {
        "message": "Measurement completed. Waiting for customer OTP.",
        "delivery": DeliveryOut.model_validate(updated).model_dump(),
    }


@router.post("/{delivery_id}/confirm-otp")
def verify_delivery_otp(
    delivery_id: int,
    payload: ConfirmOtpIn,
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Confirm the customer OTP for this stop.
    STRICT:
    - no OTP before valid measurement
    - OTP must match exactly
    - OTP cannot be reused
    - OTP can expire
    """
    delivery = _get_owned_delivery_or_403(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    if delivery.delivery_status != "awaiting_otp":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm OTP from status '{delivery.delivery_status}'",
        )

    if delivery.measurement_required and not delivery.measurement_valid:
        raise HTTPException(
            status_code=400,
            detail="Measurement must be completed and validated before OTP confirmation",
        )

    if delivery.otp_consumed_at is not None:
        raise HTTPException(
            status_code=400,
            detail="OTP has already been used for this stop",
        )

    if delivery.otp_expires_at and datetime.utcnow() > delivery.otp_expires_at:
        raise HTTPException(
            status_code=400,
            detail="OTP has expired for this delivery stop",
        )

    expected_code = delivery.delivery_code or ""
    provided_code = payload.otp_code or ""

    if provided_code != expected_code:
        delivery.otp_invalid_attempts = (delivery.otp_invalid_attempts or 0) + 1
        db.add(delivery)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    updated = confirm_delivery_otp(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
        otp_code=payload.otp_code,
    )

    # burn OTP after successful verification
    updated.otp_consumed_at = datetime.utcnow()
    updated.delivery_code = None

    db.add(updated)
    db.commit()
    db.refresh(updated)

    return {
        "message": "Delivery OTP verified successfully",
        "delivery": DeliveryOut.model_validate(updated).model_dump(),
    }


@router.post("/{delivery_id}/complete")
def complete_stop(
    delivery_id: int,
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Complete the delivery stop after OTP verification.
    STRICT:
    - no completion without measurement
    - no completion without OTP
    """
    delivery = _get_owned_delivery_or_403(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    if delivery.delivery_status != "awaiting_otp":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete delivery from status '{delivery.delivery_status}'",
        )

    if delivery.measurement_required:
        if not delivery.measurement_valid:
            raise HTTPException(
                status_code=400,
                detail="Measurement must be completed before delivery completion",
            )

        if (
            delivery.meter_start_reading is None
            or delivery.meter_end_reading is None
            or delivery.actual_liters_delivered is None
        ):
            raise HTTPException(
                status_code=400,
                detail="Measurement data is incomplete",
            )

    if delivery.otp_required and not delivery.otp_verified:
        raise HTTPException(
            status_code=400,
            detail="OTP must be verified before completing this stop",
        )

    if delivery.otp_required and delivery.otp_consumed_at is None:
        raise HTTPException(
            status_code=400,
            detail="OTP verification record is missing",
        )

    result = complete_delivery_stop(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
        auto_finalize_job=True,
    )

    return {
        "message": result["message"],
        "delivery": DeliveryOut.model_validate(result["delivery"]).model_dump(),
        "finalize_result": result.get("finalize_result"),
    }


@router.post("/{delivery_id}/fail")
def fail_stop(
    delivery_id: int,
    payload: FailDeliveryIn,
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Mark a stop as failed.
    Reason is mandatory and logged.
    """
    delivery = _get_owned_delivery_or_403(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Failure reason is required")

    result = fail_delivery_stop(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
        reason=reason,
    )

    updated_delivery = result["delivery"]
    updated_delivery.failed_at = datetime.utcnow()
    updated_delivery.failure_reason = reason
    updated_delivery.notes = reason

    db.add(updated_delivery)
    db.commit()
    db.refresh(updated_delivery)

    return {
        "message": result["message"],
        "delivery": DeliveryOut.model_validate(updated_delivery).model_dump(),
        "finalize_result": result.get("finalize_result"),
    }


@router.post("/{delivery_id}/skip")
def skip_stop(
    delivery_id: int,
    payload: SkipDeliveryIn,
    tanker_id: int,
    db: Session = Depends(get_db),
):
    """
    Mark a stop as skipped.
    STRICT:
    - skip reason is mandatory
    - reason is logged
    """
    delivery = _get_owned_delivery_or_403(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
    )

    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Skip reason is required")

    result = skip_delivery_stop(
        db,
        tanker_id=tanker_id,
        delivery_id=delivery_id,
        reason=reason,
    )

    updated_delivery = result["delivery"]
    updated_delivery.skipped_at = datetime.utcnow()
    updated_delivery.skip_reason = reason
    updated_delivery.notes = reason

    db.add(updated_delivery)
    db.commit()
    db.refresh(updated_delivery)

    return {
        "message": result["message"],
        "delivery": DeliveryOut.model_validate(updated_delivery).model_dump(),
        "finalize_result": result.get("finalize_result"),
    }