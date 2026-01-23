import os
import resend


def _send_via_resend(to_email: str, subject: str, text: str, html: str | None = None) -> bool:
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM")
    reply_to = os.getenv("RESEND_REPLY_TO")

    if not api_key:
        print("[email] RESEND_API_KEY is not set")
        return False
    if not from_email:
        print("[email] RESEND_FROM is not set")
        return False

    resend.api_key = api_key

    params: dict = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
    }
    # Resend prefers html; but support text-only callers
    if html:
        params["html"] = html
    else:
        params["text"] = text
    if reply_to:
        params["reply_to"] = reply_to

    try:
        resp = resend.Emails.send(params)
        # If the SDK returns an id, consider it success
        if isinstance(resp, dict) and resp.get("id"):
            return True
        # Some SDK versions may return an object-like response
        if hasattr(resp, "id") and getattr(resp, "id"):
            return True
        print(f"[email] Resend send returned unexpected response: {resp}")
        return False
    except Exception as e:
        print(f"[email] Resend send failed: {e}")
        return False


def send_email(to_email: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send an email.

    Uses Resend only.
    """

    return _send_via_resend(to_email, subject, text, html=html)


def send_password_reset_code(to_email: str, code: str) -> bool:
    """Send a 6-digit password reset code.

    Requires RESEND_API_KEY and RESEND_FROM.
    """

    subject = "Your password reset code"
    text = (
        "Your Soldier Housing password reset code is:\n\n"
        f"{code}\n\n"
        "This code expires in 10 minutes. If you didn't request this, you can ignore this email.\n"
    )
    ok = send_email(to_email, subject, text)
    if not ok:
        print(f"[password-reset] email send failed for {to_email}")
    return ok
