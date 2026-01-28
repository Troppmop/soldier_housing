import os
from typing import Optional


def get_vapid_public_key() -> Optional[str]:
    # If not set, push is simply “disabled”.
    key = (os.getenv("VAPID_PUBLIC_KEY") or "").strip()
    return key or None


def send_push_to_user(db, user_id: int, *, title: str, message: str, url: str = "/") -> None:
    """Best-effort push notification.

    This project references push notifications in multiple places, but the push
    implementation is optional. In environments without push configuration or
    dependencies, this function is intentionally a no-op.
    """

    # Only attempt if explicitly configured.
    public_key = get_vapid_public_key()
    private_key = (os.getenv("VAPID_PRIVATE_KEY") or "").strip()
    subject = (os.getenv("VAPID_SUBJECT") or "").strip()  # e.g. "mailto:admin@example.com"

    if not (public_key and private_key and subject):
        return

    try:
        # Optional dependency. If missing, we silently skip.
        from pywebpush import webpush, WebPushException  # type: ignore
    except Exception:
        return

    # Local import to avoid circular import at module load time.
    try:
        from . import models
    except Exception:
        return

    try:
        subs = (
            db.query(models.PushSubscription)
            .filter(models.PushSubscription.user_id == int(user_id))
            .all()
        )
    except Exception:
        return

    payload = {
        "title": title,
        "message": message,
        "url": url,
    }

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=__import__("json").dumps(payload),
                vapid_private_key=private_key,
                vapid_claims={"sub": subject},
            )
        except Exception:
            # Best-effort only; ignore per-subscription failures.
            continue
