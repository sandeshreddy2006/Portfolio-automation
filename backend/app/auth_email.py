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
ENVELOPE_URL = "https://www.portfolabs.com/brand/email-envelope.gif"
CODE_EXPIRY = "This code expires in 10 minutes. If you did not request it, you can ignore this email."


def deliver_account_email(
    recipient: str, subject: str, message: str, *, code: str | None = None,
    button: tuple[str, str] | None = None, plain: str | None = None,
) -> None:
    """`message` is inserted into the HTML as-is, so escape anything user-supplied first."""
    button_html = ""
    if button is not None:
        label, url = (html.escape(part, quote=True) for part in button)
        button_html = f"""
          <p style="margin:24px 0 12px"><a href="{url}" style="display:inline-block;background:#daf977;
            color:#19211b;padding:14px 22px;border-radius:8px;font-weight:bold;text-decoration:none">{label}</a></p>
          <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all">
            <a href="{url}" style="color:#405531">{url}</a>
          </p>
        """

    code_html = ""
    text = plain if plain is not None else message
    if code is not None:
        text = f"{text}\n\n{code}\n\n{CODE_EXPIRY}"
        code_html = f"""
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">
            <tr><td align="center" bgcolor="#e9efdc" style="padding:18px 8px;border:1px solid #cdd9bc;border-radius:12px">
              <p style="margin:0 0 8px;color:#405531;font-size:13px;font-weight:bold">Verification code</p>
              <p style="margin:0;color:#19211b;font:bold 30px/1.2 monospace;letter-spacing:6px">{html.escape(code)}</p>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;color:#505950;font-size:14px;line-height:1.6">{CODE_EXPIRY}</p>
        """
    if button is not None:
        text = f"{text}\n\n{button[0]}: {button[1]}"

    page = f"""<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>{html.escape(subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:#eef1e6;font-family:Arial,sans-serif;color:#19211b">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef1e6">
          <tr><td align="center" style="padding:24px 12px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
              style="max-width:540px;border:1px solid #d5ddcc;border-radius:16px">
              <tr><td bgcolor="#19211b" style="padding:16px 22px;border-radius:15px 15px 0 0">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px">
                      <img src="{LOGO_URL}" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px">
                    </td>
                    <td style="color:#fffef7;font-size:20px;font-weight:bold">Portfolabs</td>
                  </tr>
                </table>
              </td></tr>
              <tr><td align="center" bgcolor="#e9efdc" style="padding:6px 12px;border-bottom:1px solid #d5ddcc">
                <img src="{ENVELOPE_URL}" width="288" height="132" alt=""
                  style="display:block;width:100%;max-width:288px;height:auto;border:0">
              </td></tr>
              <tr><td bgcolor="#fffef7" style="padding:24px 22px 28px;color:#19211b">
                <h1 style="margin:0 0 12px;font-size:25px;line-height:1.2">{html.escape(subject)}</h1>
                <p style="margin:0;line-height:1.65;overflow-wrap:anywhere">{message}</p>
                {code_html}{button_html}
              </td></tr>
              <tr><td bgcolor="#f5f7ec" style="padding:14px 22px;border-top:1px solid #d5ddcc;
                border-radius:0 0 15px 15px;color:#505950;font-size:13px">
                <a href="https://www.portfolabs.com" style="color:#405531;text-decoration:underline">portfolabs.com</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
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
            }, ensure_ascii=False).encode("utf-8"),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8",
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
    email = EmailMessage()
    email["From"] = sender or f"Portfolabs <{username}>"
    email["To"], email["Subject"] = recipient, subject
    email.set_content(text, charset="utf-8")
    email.add_alternative(page, subtype="html", charset="utf-8")

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=8, context=context) as smtp:
            smtp.login(username, password)
            smtp.send_message(email)
    else:
        with smtplib.SMTP(host, port, timeout=8) as smtp:
            smtp.starttls(context=context)
            smtp.login(username, password)
            smtp.send_message(email)


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
        message = "Your Portfolabs account has been deleted. If you’d like to tell us why you left or how we could improve, reply to this email."
    else:
        subject = "New sign-in to Portfolabs"
        message = "Someone just signed in to your Portfolabs account. If this wasn’t you, reply to this email so we can help."
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

