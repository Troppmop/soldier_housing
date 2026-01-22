import os
import smtplib
from email.message import EmailMessage


def _env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).strip().lower() in {"1", "true", "yes", "y", "on"}


def send_password_reset_code(to_email: str, code: str) -> bool:
    """Send a 6-digit password reset code.

    If SMTP is not configured, prints the code to logs and returns True.

    Env vars:
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
      SMTP_TLS=true|false  (STARTTLS)
      SMTP_SSL=true|false  (implicit TLS)
    """

    host = os.getenv("SMTP_HOST")
    if not host:
        # Local/dev fallback
        print(f"[password-reset] SMTP not configured; code for {to_email}: {code}")
        return True

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM", username or "no-reply@example.com")

    use_starttls = _env_bool("SMTP_TLS", True)
    use_ssl = _env_bool("SMTP_SSL", False)

    msg = EmailMessage()
    msg["Subject"] = "Your password reset code"
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(
        "Your Soldier Housing password reset code is:\n\n"
        f"{code}\n\n"
        "This code expires in 10 minutes. If you didn\"t request this, you can ignore this email.\n"
    )

    try:
        if use_ssl:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)

        with server:
            server.ehlo()
            if use_starttls and not use_ssl:
                server.starttls()
                server.ehlo()
            if username and password:
                server.login(username, password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[password-reset] email send failed: {e}")
        return False
