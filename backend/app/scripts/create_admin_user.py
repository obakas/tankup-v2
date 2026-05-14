from getpass import getpass

from app.core.database import SessionLocal
from app.models.admin_user import AdminUser

try:
    from app.core.security import get_password_hash
except ImportError:
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)


def main():
    db = SessionLocal()

    try:
        username = input("Admin username: ").strip()
        email = input("Admin email: ").strip().lower()
        password = getpass("Admin password: ")

        existing = db.query(AdminUser).filter(
            (AdminUser.email == email) | (AdminUser.username == username)
        ).first()

        if existing:
            print("Admin already exists.")
            return

        admin = AdminUser(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            role="superadmin",
            is_active=True,
        )

        db.add(admin)
        db.commit()

        print(f"Admin created: {username} ({email})")

    finally:
        db.close()


if __name__ == "__main__":
    main()