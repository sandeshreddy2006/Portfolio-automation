"""Deliver Portfolabs account verification emails."""

import json
import os
import smtplib
import ssl
from email.message import EmailMessage
from urllib.request import Request, urlopen


def send_verification_code(recipient: str, code: str, *, linking: bool) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("MAIL_FROM")
    action = "link Google to your account" if linking else "verify your email address"
    subject = "Link your Google account to Portfolabs" if linking else "Verify your Portfolabs email"
    text = (
        f"Use this Portfolabs code to {action}: {code}. "
        "It expires in 10 minutes. If you did not request this, you can ignore this email."
    )
    html = f"""
    <div style="background:#f7f7ee;padding:32px;font-family:Arial,sans-serif;color:#19211b">
      <div style="max-width:480px;margin:auto">
        <strong style="font-size:24px">Portfolabs</strong>
        <h1 style="font-size:22px">{subject}</h1>
        <p>Use this code to {action}.</p>
        <p style="display:inline-block;background:#daf977;padding:12px 20px;border-radius:6px;
          font:bold 28px monospace;letter-spacing:6px">{code}</p>
        <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      </div>
    </div>
    """
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
