"""Reject email addresses that can't be a real, lasting inbox.

The verification code is the real proof that someone controls an address. This only
stops two cheap abuses before a code is sent: throwaway-inbox services, and domains
that can't receive mail at all (typos like "gmial.com" or made-up domains).
"""

import logging

from email_validator import EmailNotValidError, caching_resolver, validate_email
from fastapi import HTTPException

logger = logging.getLogger(__name__)

DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz",
    "guerrillamailblock.com", "sharklasers.com", "grr.la", "10minutemail.com", "10minutemail.net",
    "20minutemail.com", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmailo.com", "tempr.email",
    "throwawaymail.com", "yopmail.com", "yopmail.fr", "yopmail.net", "getnada.com", "nada.email",
    "trashmail.com", "trashmail.net", "trashmail.de", "dispostable.com", "maildrop.cc", "mintemail.com",
    "fakeinbox.com", "mailnesia.com", "moakt.com", "emailondeck.com", "tempinbox.com", "spamgourmet.com",
    "mytemp.email", "burnermail.io", "discard.email", "mohmal.com", "emltmp.com", "mailcatch.com",
    "spambox.us", "tmpmail.org", "tmpmail.net", "mail.tm", "inboxkitten.com", "jetable.org", "dropmail.me",
}

# DNS answers are cached, and a slow resolver can't hold a sign-up request for long.
_resolver = caching_resolver(timeout=5)


def verify_email_domain(email: str) -> None:
    domain = email.rsplit("@", 1)[-1].lower()
    if any(domain == blocked or domain.endswith("." + blocked) for blocked in DISPOSABLE_DOMAINS):
        raise HTTPException(422, "Please use a permanent email address, not a temporary one.")
    try:
        validate_email(email, check_deliverability=True, dns_resolver=_resolver)
    except EmailNotValidError as error:
        logger.info("Rejected sign-up email domain (%s)", type(error).__name__)
        raise HTTPException(
            422, "We couldn’t verify that email address. Check it for typos, or try again in a moment."
        ) from error
