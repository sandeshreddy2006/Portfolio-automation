import json
from email import policy
from email.parser import BytesParser
from unittest.mock import MagicMock

import pytest

from app import auth_email, reports
from app.schemas import ReportCreate


@pytest.mark.parametrize("transport", ["smtp", "resend"])
def test_mail_copy_survives_transport(monkeypatch, transport):
    recipient = "mail@example.com"
    monkeypatch.setenv("MAIL_FROM", "Portfolabs <sender@example.com>")
    monkeypatch.setenv("REPORT_EMAIL", recipient)
    if transport == "smtp":
        monkeypatch.delenv("RESEND_API_KEY", raising=False)
        monkeypatch.setenv("SMTP_USERNAME", "sender@example.com")
        monkeypatch.setenv("SMTP_PASSWORD", "example")
        monkeypatch.setenv("SMTP_PORT", "587")
        connection = MagicMock()
        monkeypatch.setattr(auth_email.smtplib, "SMTP", connection)
    else:
        monkeypatch.setenv("RESEND_API_KEY", "example")
        connection = MagicMock()
        monkeypatch.setattr(auth_email, "urlopen", connection)

    for purpose in ("verify", "link", "reset", "change", "delete"):
        auth_email.send_verification_code(recipient, "012345", purpose=purpose)
    auth_email.send_account_notice(recipient)
    auth_email.send_account_notice(recipient, deleted=True)
    auth_email.send_portfolio_live(recipient, "Ana", "Café & Co", "https://www.portfolabs.com/p/cafe")
    reports.notify_owner("cafe", ReportCreate(reason="other", details="Résumé\nSecond line"))

    if transport == "smtp":
        sent = connection.return_value.__enter__.return_value.send_message.call_args_list
        messages = []
        for call in sent:
            email = BytesParser(policy=policy.default).parsebytes(call.args[0].as_bytes())
            text_part = email.get_body(preferencelist=("plain",))
            html_part = email.get_body(preferencelist=("html",))
            assert text_part.get_content_charset() == html_part.get_content_charset() == "utf-8"
            messages.append((text_part.get_content(), html_part.get_content()))
    else:
        bodies = [json.loads(call.args[0].data.decode("utf-8")) for call in connection.call_args_list]
        messages = [(body["text"], body["html"]) for body in bodies]

    assert len(messages) == 9
    for text, page in messages:
        assert "â€™" not in text + page
        assert auth_email.LOGO_URL in page and auth_email.ENVELOPE_URL in page
    for text, page in messages[:5]:
        assert "012345" in text and "012345" in page
        assert auth_email.CODE_EXPIRY in text and auth_email.CODE_EXPIRY in page
    assert all("wasn’t" in part for part in messages[5])
    assert all("you’d" in part for part in messages[6])
    assert "Café & Co" in messages[7][0] and "Café &amp; Co" in messages[7][1]
    assert "Résumé\nSecond line" in messages[8][0] and "Résumé<br>Second line" in messages[8][1]
