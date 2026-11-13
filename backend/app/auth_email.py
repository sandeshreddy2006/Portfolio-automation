"""Deliver Portfolabs account emails."""

import html
import json
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Literal
from urllib.request import Request, urlopen


logger = logging.getLogger(__name__)
LOGO_URL = "https://www.portfolabs.com/apple-icon.png"


def deliver_account_email(
    recipient: str, subject: str, message: str, *, code: str | None = None,
    button: tuple[str, str] | None = None, plain: str | None = None,
) -> None:
    """`message` is inserted into the HTML as-is, so escape anything user-supplied first."""
    button_html = f"""
      <p><a href="{html.escape(button[1], quote=True)}" style="display:inline-block;background:#daf977;
        color:#19211b;padding:12px 20px;border-radius:6px;font-weight:bold;text-decoration:none">
        {html.escape(button[0])}</a></p>
      <p style="font-size:13px;color:#505950;word-break:break-all">{html.escape(button[1])}</p>
    """ if button is not None else ""
    code_html = f"""
      <p style="display:inline-block;background:#daf977;padding:12px 20px;border-radius:6px;
        font:bold 28px monospace;letter-spacing:6px">{code}</p>
      <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    """ if code is not None else ""
    text = (
        f"{message}\n\n{code}\n\nThis code expires in 10 minutes. "
        "If you did not request it, you can ignore this email."
    ) if code is not None else (
        f"{plain or message}\n\n{button[1]}" if button is not None else (plain or message)
    )
    page = f"""
    <div style="background:#f7f7ee;padding:32px;font-family:Arial,sans-serif;color:#19211b">
      <div style="max-width:480px;margin:auto">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:12px">
              <img src="{LOGO_URL}" width="42" height="42" alt="" style="display:block;border:0;border-radius:9px">
            </td>
            <td style="font-size:24px;font-weight:bold">Portfolabs</td>
          </tr>
        </table>
        <h1 style="font-size:22px">{subject}</h1>
        <p>{message}</p>
        {code_html}{button_html}
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
                "from": sender, "to": [recipient], "subject": subject, "text": text, "html": page,
            }).encode(),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json",
                     "User-Agent": "Portfolabs"},
        )
        with urlopen(request, timeout=8):
            return

    if not os.getenv("SMTP_USERNAME") and os.getenv("FRONTEND_URL", "http://localhost:3000").startswith(
        "http://localhost"
    ):
        # Local development without an email service: show the message in the server log.
        logger.warning("DEV EMAIL to %s | %s | %s", recipient, subject, code or message)
        return

    host = os.getenv("SMTP_HOST") or "smtp.gmail.com"
    port = int(os.getenv("SMTP_PORT") or "587")
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    message = EmailMessage()
    message["From"] = sender or f"Portfolabs <{username}>"
    message["To"], message["Subject"] = recipient, subject
    message.set_content(text)
    message.add_alternative(page, subtype="html")

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
    recipient: str, code: str, *, purpose: Literal["verify", "link", "delete", "reset", "change"],
) -> None:
    subject, action = {
        "verify": ("Verify your Portfolabs email", "verify your email address"),
        "link": ("Link your Google account to Portfolabs", "link Google to your account"),
        "reset": ("Reset your Portfolabs password", "reset your password"),
        "change": ("Confirm your Portfolabs password change", "change your password"),
        "delete": ("Confirm deletion of your Portfolabs account", "permanently delete your account"),
    }[purpose]
    deliver_account_email(recipient, subject, f"Use this Portfolabs code to {action}.", code=code)


def send_account_notice(recipient: str, *, deleted: bool = False) -> None:
    if deleted:
        subject = "Your Portfolabs account was deleted"
        message = "Your Portfolabs account has been deleted. If youâ€™d like to tell us why you left or how we could improve, reply to this email."
    else:
        subject = "New sign-in to Portfolabs"
        message = "Someone just signed in to your Portfolabs account. If this wasnâ€™t you, reply to this email so we can help."
    try:
        deliver_account_email(recipient, subject, message)
    except (OSError, KeyError, ValueError) as error:
        logger.warning("Portfolabs account notice failed (%s)", type(error).__name__)


def send_portfolio_live(recipient: str, account_name: str, portfolio_name: str, link: str) -> None:
    """Tell the owner their portfolio is live. Never raises: publishing must not depend on email."""
    # User-supplied names are escaped because the message is placed in an HTML email.
    greeting = html.escape(account_name.split()[0] if account_name.strip() else "there")
    title = html.escape(portfolio_name)
    tail = (
        "Share the link on your résumé, LinkedIn or applications. You can edit it and republish "
        "at any time, and the link stays the same."
    )
    try:
        deliver_account_email(
            recipient, "Your Portfolabs portfolio is live",
            f"Hi {greeting}, <strong>{title}</strong> is now live. {tail}",
            button=("View your portfolio", link),
            plain=f"Hi {account_name.split()[0] if account_name.strip() else 'there'}, {portfolio_name} is now live. {tail}",
        )
    except (OSError, KeyError, ValueError) as error:
        logger.warning("Portfolabs live-portfolio email failed (%s)", type(error).__name__)

