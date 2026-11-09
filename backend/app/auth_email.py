"""Deliver Portfolabs account emails."""

import json
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Literal
from urllib.request import Request, urlopen


logger = logging.getLogger(__name__)


def deliver_account_email(
    recipient: str, subject: str, message: str, *, code: str | None = None,
) -> None:
    code_html = f"""
      <p style="display:inline-block;background:#daf977;padding:12px 20px;border-radius:6px;
        font:bold 28px monospace;letter-spacing:6px">{code}</p>
      <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    """ if code is not None else ""
    text = (
        f"{message}\n\n{code}\n\nThis code expires in 10 minutes. "
        "If you did not request it, you can ignore this email."
    ) if code is not None else message
    html = f"""
    <div style="background:#f7f7ee;padding:32px;font-family:Arial,sans-serif;color:#19211b">
      <div style="max-width:480px;margin:auto">
        <strong style="font-size:24px">Portfolabs</strong>
        <h1 style="font-size:22px">{subject}</h1>
        <p>{message}</p>
        {code_html}
      </div>
    </div>
    """
    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("MAIL_FROM")
    if api_key:
        if not sender:
            raise ValueError("MAIL_FROM is required when using Resend.")
        request = Request(
            "https://api.resend.com/emails",
            data=json.dumps({
                "from": sender, "to": [recipient], "subject": subject, "text": text, "html": html,
            }).encode(),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json",
                     "User-Agent": "Portfolabs"},
        )
        with urlopen(request, timeout=8):
            return

    host = os.getenv("SMTP_HOST") or "smtp.gmail.com"
    port = int(os.getenv("SMTP_PORT") or "587")
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    message = EmailMessage()
    message["From"] = sender or f"Portfolabs <{username}>"
    message["To"], message["Subject"] = recipient, subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=8, context=context) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=8) as smtp:
            smtp.starttls(context=context)
            smtp.login(username, password)
            smtp.send_message(message)


def send_verification_code(
    recipient: str, code: str, *, purpose: Literal["verify", "link", "delete"],
) -> None:
    subject, action = {
        "verify": ("Verify your Portfolabs email", "verify your email address"),
        "link": ("Link your Google account to Portfolabs", "link Google to your account"),
        "delete": ("Confirm deletion of your Portfolabs account", "permanently delete your account"),
    }[purpose]
    deliver_account_email(recipient, subject, f"Use this code to {action}.", code=code)


def send_account_notice(recipient: str, *, deleted: bool = False) -> None:
    if deleted:
        subject = "Your Portfolabs account was deleted"
        message = "Your account has been deleted. If you’d like to tell us why you left or how we could improve, reply to this email."
    else:
        subject = "New sign-in to Portfolabs"
        message = "Someone just signed in to your Portfolabs account. If this wasn’t you, reply to this email so we can help."
    try:
        deliver_account_email(recipient, subject, message)
    except (OSError, KeyError, ValueError) as error:
        logger.warning("Portfolabs account notice failed (%s)", type(error).__name__)
