# app/core/scheduler.py

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.services.assignment_service import process_expired_offers, process_priority_assignment_timeouts
from app.services.batch_monitor_service import process_all_active_batches
from app.services.delivery_timeout_service import expire_overdue_deliveries
from app.services.loading_timeout_service import expire_overdue_loading_jobs
from app.services.late_arrival_service import flag_late_arrivals

scheduler = BackgroundScheduler()

def run_late_arrival_monitor():
    db = SessionLocal()
    try:
        results = flag_late_arrivals(db)
        if results:
            print("Late arrival monitor tick:")
            for item in results:
                print(item)
    finally:
        db.close()


def run_batch_monitor():
    db = SessionLocal()
    try:
        results = process_all_active_batches(db)
        if results:
            print("Batch monitor tick:")
            for item in results:
                print(item)
    finally:
        db.close()


def run_offer_expiry_monitor():
    db = SessionLocal()
    try:
        results = process_expired_offers(db)
        if results:
            print("Offer expiry monitor tick:")
            for item in results:
                print(item)
    finally:
        db.close()




def run_priority_assignment_timeout_monitor():
    db = SessionLocal()
    try:
        results = process_priority_assignment_timeouts(db)
        if results:
            print("Priority assignment timeout monitor tick:")
            for item in results:
                print(item)
    finally:
        db.close()

def run_loading_timeout_monitor():
    db = SessionLocal()
    try:
        results = expire_overdue_loading_jobs(db)
        if results.get("expired_batch_loading_jobs") or results.get("expired_priority_loading_jobs"):
            print("Loading timeout monitor tick:")
            print(results)
    finally:
        db.close()


def run_delivery_timeout_monitor():
    db = SessionLocal()
    try:
        results = expire_overdue_deliveries(db)
        if results:
            print("Delivery timeout monitor tick:")
            for item in results:
                print(item)
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
        scheduler.start()




def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
