from django.apps import AppConfig
from django.conf import settings

import sqlite3


def ensure_sqlite_tables() -> None:
    database = settings.DATABASES["default"]
    if database.get("ENGINE") != "django.db.backends.sqlite3":
        return

    connection = sqlite3.connect(database["NAME"])
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                score INTEGER NOT NULL,
                level INTEGER NOT NULL,
                loot INTEGER NOT NULL,
                outcome TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(leaderboard)").fetchall()
        }
        if "user_id" not in columns:
            connection.execute("ALTER TABLE leaderboard ADD COLUMN user_id INTEGER")

        connection.commit()
    finally:
        connection.close()


class GameConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'game'

    def ready(self):
        ensure_sqlite_tables()
