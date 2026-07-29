from app.core.database import SessionLocal
from app.models.user import User
from app.models.request import LiquidRequest
from app.models.batch import Batch
from app.models.batch_member import BatchMember


def _make_user(db, phone):
    user = User(name="Test User", phone=phone, address="Test Address")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_no_active_delivery(client):
    db = SessionLocal()
    try:
        user = _make_user(db, "0800000001")
    finally:
        db.close()

    response = client.get(f"/requests/users/{user.id}/active-delivery")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "has_active_delivery": False,
        "delivery_type": None,
        "request_id": None,
        "batch_id": None,
        "member_id": None,
        "request_status": None,
    }


def test_active_priority_request(client):
    db = SessionLocal()
    try:
        user = _make_user(db, "0800000002")
        user_id = user.id
        request = LiquidRequest(
            user_id=user.id,
            liquid_id=1,
            volume_liters=1000,
            latitude=9.05,
            longitude=7.49,
            delivery_type="priority",
            status="delivering",
        )
        db.add(request)
        db.commit()
        db.refresh(request)
        request_id = request.id
    finally:
        db.close()

    response = client.get(f"/requests/users/{user_id}/active-delivery")
    assert response.status_code == 200
    data = response.json()
    assert data["has_active_delivery"] is True
    assert data["delivery_type"] == "priority"
    assert data["request_id"] == request_id

    # Completing the request should remove it from the active lookup.
    db = SessionLocal()
    try:
        db.query(LiquidRequest).filter(LiquidRequest.id == request_id).update({"status": "completed"})
        db.commit()
    finally:
        db.close()

    response = client.get(f"/requests/users/{user_id}/active-delivery")
    assert response.json()["has_active_delivery"] is False


def test_active_batch_membership(client):
    db = SessionLocal()
    try:
        user = _make_user(db, "0800000003")
        user_id = user.id
        batch = Batch(user_id=user.id, liquid_id=1, volume_liters=1000, latitude=9.05, longitude=7.49)
        db.add(batch)
        db.commit()
        db.refresh(batch)

        member = BatchMember(
            batch_id=batch.id,
            user_id=user.id,
            volume_liters=1000,
            requested_volume=1000,
            status="active",
            payment_status="paid",
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        batch_id, member_id = batch.id, member.id
    finally:
        db.close()

    response = client.get(f"/requests/users/{user_id}/active-delivery")
    assert response.status_code == 200
    data = response.json()
    assert data["has_active_delivery"] is True
    assert data["delivery_type"] == "batch"
    assert data["batch_id"] == batch_id
    assert data["member_id"] == member_id

    # Marking the member delivered should remove it from the active lookup.
    db = SessionLocal()
    try:
        db.query(BatchMember).filter(BatchMember.id == member_id).update({"status": "delivered"})
        db.commit()
    finally:
        db.close()

    response = client.get(f"/requests/users/{user_id}/active-delivery")
    assert response.json()["has_active_delivery"] is False
