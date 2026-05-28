from logging.config import fileConfig
import os
import sys
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


def _clean_database_url(url: str | None) -> str | None:
    if not url:
        return url

    url = url.strip()
    if url.startswith("f\"") and url.endswith("\""):
        url = url[2:-1]
    elif url.startswith("f'") and url.endswith("'"):
        url = url[2:-1]

    return url.strip().strip("\"'")


def _load_env_file() -> dict[str, str]:
    env_path = BASE_DIR / ".env"
    values: dict[str, str] = {}

    if not env_path.exists():
        return values

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()

    return values


env_values = _load_env_file()
database_url = _clean_database_url(
    os.getenv("DIRECT_URL")
    or os.getenv("DATABASE_URL")
    or env_values.get("DIRECT_URL")
    or env_values.get("DATABASE_URL")
)

if database_url:
    os.environ["DATABASE_URL"] = database_url
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

from app.core.database import Base
from app.models import customer_site_profile  # noqa: F401
from app.models import DeliveryRecord  # noqa: F401
from app.models import admin_audit_log  # noqa: F401
from app.models import admin_user  # noqa: F401
from app.models import batch  # noqa: F401
from app.models import batch_member  # noqa: F401
from app.models import driver_metric  # noqa: F401
from app.models import job_offer  # noqa: F401
from app.models import liquid  # noqa: F401
from app.models import notification_subscription  # noqa: F401
from app.models import operation_alert  # noqa: F401
from app.models import order  # noqa: F401
from app.models import payment  # noqa: F401
from app.models import request  # noqa: F401
from app.models import tanker  # noqa: F401
from app.models import user  # noqa: F401

target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
