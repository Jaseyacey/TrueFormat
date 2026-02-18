from __future__ import annotations

import time

from .auth import normalize_email
from .db import db_conn


def submit_interest_lead(name: str, email: str, company: str, message: str) -> None:
    normalized_email = normalize_email(email)
    with db_conn() as conn:
        conn.execute(
            """
            INSERT INTO interest_leads (name, email, company, message, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                name.strip(),
                normalized_email,
                company.strip(),
                message.strip(),
                int(time.time()),
            ),
        )
        conn.commit()
