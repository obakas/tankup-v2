# app/core/scheduler.py

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.services.assignment_service import process_expired_offers, process_priority_assignment_timeouts
from app.services.batch_monitor_service import process_all_active_batches
from app.services.delivery_timeout_service import expire_overdue_deliveries
from app.services.loading_timeout_service import expire_overdue_loading_jobs
from app.services.late_arrival_service import flag_late_arrivals
from app.services.driver_offline_service import process_offline_drivers
from app.services.nearby_notification_service import process_nearby_batch_notifications

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def run_late_arrival_monitor():
    db = SessionLocal()
    try:
        results = flag_late_arrivals(db)
        if results:
            logger.info("late_arrival_monitor", extra={"results": results})
    except Exception:
        logger.exception("late_arrival_monitor failed")
    finally:
        db.close()


def run_batch_monitor():
    db = SessionLocal()
    try:
        results = process_all_active_batches(db)
        if results:
            logger.info("batch_monitor", extra={"results": results})
    except Exception:
        logger.exception("batch_monitor failed")
    finally:
        db.close()


def run_offer_expiry_monitor():
    db = SessionLocal()
    try:
        results = process_expired_offers(db)
        if results:
            logger.info("offer_expiry_monitor", extra={"results": results})
    except Exception:
        logger.exception("offer_expiry_monitor failed")
    finally:
        db.close()


def run_priority_assignment_timeout_monitor():
    db = SessionLocal()
    try:
        results = process_priority_assignment_timeouts(db)
        if results:
            logger.info("priority_assignment_timeout_monitor", extra={"results": results})
    except Exception:
        logger.exception("priority_assignment_timeout_monitor failed")
    finally:
        db.close()


def run_loading_timeout_monitor():
    db = SessionLocal()
    try:
        results = expire_overdue_loading_jobs(db)
        if results.get("expired_batch_loading_jobs") or results.get("expired_priority_loading_jobs"):
            logger.info("loading_timeout_monitor", extra={"results": results})
    except Exception:
        logger.exception("loading_timeout_monitor failed")
    finally:
        db.close()


def run_delivery_timeout_monitor():
    db = SessionLocal()
    try:
        results = expire_overdue_deliveries(db)
        if results:
            logger.info("delivery_timeout_monitor", extra={"results": results})
    except Exception:
        logger.exception("delivery_timeout_monitor failed")
    finally:
        db.close()


def run_nearby_notification_monitor():
    db = SessionLocal()
    try:
        results = process_nearby_batch_notifications(db)
        if results:
            logger.info("nearby_notification_monitor", extra={"results": results})
    except Exception:
        logger.exception("nearby_notification_monitor failed")
    finally:
        db.close()


def run_driver_offline_monitor():
    db = SessionLocal()
    try:
        results = process_offline_drivers(db)
        if results:
            logger.info("driver_offline_monitor", extra={"results": results})
    except Exception:
        logger.exception("driver_offline_monitor failed")
    finally:
        db.close()


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(
            run_batch_monitor,
            trigger="interval",
            seconds=60,
            id="batch_monitor_job",
            replace_existing=True,
        )
        scheduler.add_job(
            run_offer_expiry_monitor,
            trigger="interval",
            seconds=15,
            id="offer_expiry_monitor_job",
            replace_existing=True,
        )
        scheduler.add_job(
            run_priority_assignment_timeout_monitor,
            trigger="interval",
            seconds=30,
            id="priority_assignment_timeout_monitor_job",
            replace_existing=True,
        )
        scheduler.add_job(
            run_loading_timeout_monitor,
            trigger="interval",
            seconds=30,
            id="loading_timeout_monitor_job",
            replace_existing=True,
        )
        scheduler.add_job(
            run_delivery_timeout_monitor,
            trigger="interval",
            minutes=5,
            id="delivery_timeout_monitor_job",
            replace_existing=True,
        )
        scheduler.add_job(
            run_late_arrival_monitor,
            trigger="interval",
            # minutes=5,
            seconds=30,
            id="late_arrival_monitor_job",
            replace_existing=True,
        )
        scheduler.add_job(
            run_nearby_notification_monitor,
            trigger="interval",
            seconds=60,
            id="nearby_notification_job",
            replace_existing=True,
        )
        scheduler.add_job(
            run_driver_offline_monitor,
            trigger="interval",
            seconds=30,
            id="driver_offline_monitor_job",
            replace_existing=True,
        )
        scheduler.start()




def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
