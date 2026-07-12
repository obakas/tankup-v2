from getpass import getpass

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.admin_user import AdminUser
from app.models.hub import Hub


def main():
    db = SessionLocal()

    try:
        username = input("Admin username: ").strip()
        email = input("Admin email: ").strip().lower()
        password = getpass("Admin password: ")
        hub_name = input("Fleet head hub name (leave blank for global admin): ").strip()

        existing = db.query(AdminUser).filter(
            (AdminUser.email == email) | (AdminUser.username == username)
        ).first()

        if existing:
            print("Admin already exists.")
            return

        hub_id = None
        role = "admin"
        if hub_name:
            hub = db.query(Hub).filter(Hub.name == hub_name).first()
            if not hub:
                print(f"No hub named '{hub_name}' found. Create the hub first.")
                return
            hub_id = hub.id
            role = "fleet_head"

        admin = AdminUser(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            role=role,
            hub_id=hub_id,
            is_active=True,
        )

        db.add(admin)
        db.commit()

        print(f"Admin created: {username} ({email}), role={role}, hub_id={hub_id}")

    finally:
        db.close()


if __name__ == "__main__":
    main()