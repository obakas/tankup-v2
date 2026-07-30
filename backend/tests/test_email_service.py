import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from unittest.mock import MagicMock, patch

from app.core.database import SessionLocal
from app.models.user import User
from app.models.request import LiquidRequest
from app.services import delivery_service, email_service
from app.services.notification_preference_service import update_preferences


def _make_user(db, phone, email=None):
    user = User(name="Test User", phone=phone, address="Test Address", email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_request(db, user_id, status="completed"):
    request = LiquidRequest(
        user_id=user_id,
        liquid_id=1,
        volume_liters=1000,
        latitude=9.05,
        longitude=7.49,
        delivery_type="priority",
        status=status,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


class _FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code

    def json(self):
        return {"id": "fake"}


def test_send_customer_receipt_email_success():
    with patch("app.services.email_service.http_requests.post", return_value=_FakeResponse(200)) as mock_post:
        result = email_service.send_customer_receipt_email(
            "customer@example.com", b"%PDF-fake-bytes", {"request_id": 1, "delivery_type": "priority", "price": 5000}
        )
    assert result is True
    mock_post.assert_called_once()
    _, kwargs = mock_post.call_args
    assert kwargs["json"]["to"] == ["customer@example.com"]
    assert kwargs["json"]["attachments"][0]["filename"] == "tankup-receipt-1.pdf"


def test_send_customer_receipt_email_failure_status():
    with patch("app.services.email_service.http_requests.post", return_value=_FakeResponse(422)):
        result = email_service.send_customer_receipt_email(
            "customer@example.com", b"%PDF-fake-bytes", {"request_id": 1, "delivery_type": "priority", "price": 5000}
        )
    assert result is False


def test_send_customer_receipt_email_never_raises_on_exception():
    with patch("app.services.email_service.http_requests.post", side_effect=Exception("network down")):
        result = email_service.send_customer_receipt_email(
            "customer@example.com", b"%PDF-fake-bytes", {"request_id": 1, "delivery_type": "priority", "price": 5000}
        )
    assert result is False


def test_maybe_send_receipt_email_skips_when_user_has_no_email():
    db = SessionLocal()
    try:
        user = _make_user(db, "0800100001", email=None)
        request = _make_request(db, user.id)
        request_id = request.id
    finally:
        db.close()

    with patch.object(delivery_service.email_service, "send_customer_receipt_email") as mock_send:
        delivery_service._maybe_send_receipt_email(SessionLocal(), request_id)
    mock_send.assert_not_called()


def test_maybe_send_receipt_email_skips_when_preference_disabled():
    db = SessionLocal()
    try:
        user = _make_user(db, "0800100002", email="customer2@example.com")
        request = _make_request(db, user.id)
        request_id, user_id = request.id, user.id
    finally:
        db.close()

    db = SessionLocal()
    try:
        update_preferences(db, "customer", str(user_id), {"email_receipt": False})
    finally:
        db.close()

    with patch.object(delivery_service.email_service, "send_customer_receipt_email") as mock_send:
        delivery_service._maybe_send_receipt_email(SessionLocal(), request_id)
    mock_send.assert_not_called()


def test_maybe_send_receipt_email_sends_when_enabled():
    db = SessionLocal()
    try:
        user = _make_user(db, "0800100003", email="customer3@example.com")
        request = _make_request(db, user.id)
        request_id = request.id
    finally:
        db.close()

    fake_data = {"request_id": request_id, "delivery_type": "priority", "price": 5000}
    with patch.object(delivery_service, "build_customer_receipt_data", return_value=fake_data), \
         patch.object(delivery_service, "render_customer_receipt", return_value=b"%PDF-fake") as mock_render, \
         patch.object(delivery_service.email_service, "send_customer_receipt_email", return_value=True) as mock_send:
        delivery_service._maybe_send_receipt_email(SessionLocal(), request_id)

    mock_render.assert_called_once_with(fake_data)
    mock_send.assert_called_once_with("customer3@example.com", b"%PDF-fake", fake_data)


def test_maybe_send_receipt_email_noop_on_none_request_id():
    with patch.object(delivery_service.email_service, "send_customer_receipt_email") as mock_send:
        delivery_service._maybe_send_receipt_email(SessionLocal(), None)
    mock_send.assert_not_called()


def test_maybe_send_receipt_email_never_raises_on_internal_error():
    db = SessionLocal()
    try:
        user = _make_user(db, "0800100004", email="customer4@example.com")
        request = _make_request(db, user.id)
        request_id = request.id
    finally:
        db.close()

    with patch.object(delivery_service, "build_customer_receipt_data", side_effect=Exception("boom")):
        # Should not raise even though the internal receipt build fails.
        delivery_service._maybe_send_receipt_email(SessionLocal(), request_id)
