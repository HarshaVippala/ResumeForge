#!/usr/bin/env python3
"""
fetch_gmail_emails.py

Fetches the most recent N emails from your Gmail INBOX (supports >500) and writes them to a JSONL file.

Prerequisites:
  * Gmail API enabled for your Google account.
  * OAuth credentials have already been generated and the refresh token
    plus client credentials are stored in environment variables.

Expected environment variables
--------------------------------------------------------------------
GMAIL_TOKEN_PATH        Path to your OAuth token.json file
GMAIL_CREDENTIALS_PATH  Path to your credentials.json file
--------------------------------------------------------------------

Example:
    GMAIL_TOKEN_PATH=$HOME/.config/gmail/token.json \\
    GMAIL_CREDENTIALS_PATH=$HOME/.config/gmail/credentials.json \\
    python fetch_gmail_emails.py -n 1200 -o my_inbox.jsonl
"""

import os
import json
from typing import List, Dict

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

import logging

logger = logging.getLogger(__name__)

# Read‑only access to all messages
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
BATCH_SIZE = 100  # Gmail API maxResults per request (100 is the max)


# ------------------------------------------------------------------
# Authentication helper
# ------------------------------------------------------------------
def authenticate() -> Credentials:
    """
    Load OAuth credentials from paths supplied in environment variables.
    Throws if the token is invalid or missing.
    """
    # Expand paths in case the env vars contain ~ or other shorthand
    token_path = os.path.expanduser(os.getenv("GMAIL_TOKEN_PATH", "token.json"))
    creds_path = os.path.expanduser(os.getenv("GMAIL_CREDENTIALS_PATH", "credentials.json"))

    # Debug log the paths being used (if logger is configured)
    try:
        logger.debug(f"Using Gmail token path: {token_path}")
        logger.debug(f"Using Gmail credentials path: {creds_path}")
    except Exception:
        pass

    # ------------------------------------------------------------------
    # Fallback: look in ../config for Gmail creds (same as gmail_service.py)
    # ------------------------------------------------------------------
    script_dir = os.path.dirname(__file__)
    fallback_token = os.path.abspath(os.path.join(script_dir, "..", "config", "gmail_token.json"))
    fallback_creds = os.path.abspath(os.path.join(script_dir, "..", "config", "gmail_credentials.json"))

    if not os.path.exists(token_path) and os.path.exists(fallback_token):
        logger.warning(f"Primary token path not found. Falling back to {fallback_token}")
        token_path = fallback_token

    if not os.path.exists(creds_path) and os.path.exists(fallback_creds):
        logger.warning(f"Primary credentials path not found. Falling back to {fallback_creds}")
        creds_path = fallback_creds

    if not os.path.exists(token_path) or not os.path.exists(creds_path):
        raise FileNotFoundError(
            "Gmail token/credentials not found.\n"
            f"Checked paths:\n  token: {token_path}\n  creds: {creds_path}\n"
            "Set GMAIL_TOKEN_PATH and GMAIL_CREDENTIALS_PATH or place files in ../config/."
        )

    creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds.valid:
        raise RuntimeError(
            "OAuth token is missing, expired, or invalid. "
            "Refresh the token and try again."
        )
    return creds


# ------------------------------------------------------------------
# Gmail helpers
# ------------------------------------------------------------------
def list_message_ids(service, max_emails: int = 1000) -> List[str]:
    """
    Return up to max_emails message IDs from the INBOX, using pagination.
    """
    ids: List[str] = []
    next_page_token = None

    while len(ids) < max_emails:
        response = (
            service.users()
            .messages()
            .list(
                userId="me",
                labelIds=["INBOX"],
                maxResults=BATCH_SIZE,
                pageToken=next_page_token,
            )
            .execute()
        )

        ids.extend([m["id"] for m in response.get("messages", [])])
        next_page_token = response.get("nextPageToken")

        # No more pages
        if not next_page_token:
            break

    return ids[:max_emails]


def get_message_details(service, msg_id: str) -> Dict:
    """
    Retrieve full message payload and return a simplified dict
    containing headers and plain‑text body.
    """
    msg = (
        service.users()
        .messages()
        .get(userId="me", id=msg_id, format="full")
        .execute()
    )

    payload = msg.get("payload", {})
    headers = {h["name"]: h["value"] for h in payload.get("headers", [])}

    # Attempt to locate a text/plain part
    body_data = ""
    if "data" in payload.get("body", {}):
        body_data = payload["body"]["data"]
    else:
        for part in payload.get("parts", []):
            if part.get("mimeType") == "text/plain" and "data" in part.get("body", {}):
                body_data = part["body"]["data"]
                break

    # Decode from URL‑safe base64
    if body_data:
        import base64, quopri

        decoded_bytes = base64.urlsafe_b64decode(body_data)
        decoded_bytes = quopri.decodestring(decoded_bytes)  # remove quoted‑printable
        body_text = decoded_bytes.decode("utf‑8", errors="replace")
    else:
        body_text = ""

    return {
        "id": msg_id,
        "threadId": msg.get("threadId"),
        "subject": headers.get("Subject", ""),
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "date": headers.get("Date", ""),
        "body": body_text,
    }


# ------------------------------------------------------------------
# Main fetch routine (writes Alpaca‑style JSONL for fine‑tuning)
# ------------------------------------------------------------------
def fetch_emails(max_emails: int = 1000,
                 outfile: str = os.path.join(os.path.expanduser("~/Desktop"),
                                             "emails_finetune.jsonl")) -> None:
    """
    Fetches up to `max_emails` messages and writes them to `outfile`
    in Alpaca‑style JSONL, ready for fine‑tuning.

    Each line looks like:
    {
      "instruction": "Classify this email and extract job‑related information.",
      "input": "Subject: ...\\n\\nBody: ...",
      "output": ""
    }
    """
    creds = authenticate()
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    ids = list_message_ids(service, max_emails=max_emails)
    print(f"Found {len(ids)} messages, downloading details…")

    with open(outfile, "w", encoding="utf-8") as f:
        for idx, msg_id in enumerate(ids, 1):
            detail = get_message_details(service, msg_id)

            # Build Alpaca‑style record
            alpaca_record = {
                "instruction": "Classify this email and extract job‑related information.",
                "input": f"Subject: {detail['subject']}\n\nBody: {detail['body']}",
                "output": ""  # leave blank for manual labeling
            }

            f.write(json.dumps(alpaca_record, ensure_ascii=False) + "\n")

            if idx % 50 == 0 or idx == len(ids):
                print(f"  saved {idx}/{len(ids)}")

    print(f"✅ Finished. Saved {len(ids)} messages to {outfile}")


# ------------------------------------------------------------------
# CLI entry point
# ------------------------------------------------------------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Fetch Gmail messages and save them to a JSONL file."
    )
    parser.add_argument(
        "-n",
        "--number",
        type=int,
        default=1000,
        help="Number of emails to fetch (default: 1000)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=os.path.join(os.path.expanduser("~/Desktop"), "emails_finetune.jsonl"),
        help="Output JSONL file path (default: ~/Desktop/emails_finetune.jsonl)",
    )

    args = parser.parse_args()
    fetch_emails(max_emails=args.number, outfile=args.output)