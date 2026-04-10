#!/usr/bin/env python3
"""
Post-Delivery Follow-Up Email Sender for Taylor's Bakery.
Queries orders delivered yesterday, sends branded follow-up emails,
and logs each send to communication_logs.
"""

import os
import sys
import json
import uuid
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta

def load_env():
    """Load environment variables from .env file."""
    env_path = "/home/ubuntu/shared/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    value = value.strip().strip('"').strip("'")
                    os.environ.setdefault(key.strip(), value)

def build_email_html(display_name, delivery_date_str):
    """Build branded HTML email body."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9f5f0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f5f0;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.5px;">🍞 Taylor's Bakery</h1>
      <p style="margin:6px 0 0;color:#fef3c7;font-size:14px;">Fresh-baked goodness, delivered with care</p>
    </td>
  </tr>
  <tr>
    <td style="padding:36px 40px;">
      <h2 style="margin:0 0 18px;color:#92400e;font-size:22px;">Hi {display_name},</h2>
      <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 16px;">
        Thank you for your recent order delivered on <strong style="color:#d97706;">{delivery_date_str}</strong>! We hope everything arrived fresh and exactly as you expected.
      </p>
      <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 16px;">
        Your satisfaction means the world to us. If there's anything that didn't meet your expectations, or if you have any feedback at all, we'd love to hear from you.
      </p>
      <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:0 0 16px;">
        Need to place another order or have questions? Don't hesitate to reach out — we're always here to help!
      </p>
      <p style="color:#4b5563;font-size:16px;line-height:1.7;margin:24px 0 0;">
        Warm regards,<br>
        <strong style="color:#92400e;">The Taylor's Bakery Team</strong>
      </p>
    </td>
  </tr>
  <tr>
    <td style="background-color:#fffbeb;padding:20px 40px;text-align:center;border-top:1px solid #fde68a;">
      <p style="margin:0;color:#92400e;font-size:13px;">Taylor's Bakery &bull; Baked Fresh Daily</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>"""

def send_notification_email(recipient_email, subject, body_html):
    """Send email via AbacusAI notification API."""
    url = "https://apps.abacus.ai/api/sendNotificationEmail"
    payload = {
        "deploymentToken": os.environ["ABACUSAI_API_KEY"],
        "appId": os.environ["WEB_APP_ID"],
        "notificationId": os.environ["NOTIF_ID_POSTDELIVERY_FOLLOWUP"],
        "email": recipient_email,
        "senderAlias": "Taylor's Bakery",
        "subject": subject,
        "body": body_html,
    }
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()

def main():
    load_env()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Get yesterday's date (ET timezone context — script runs at 9 AM ET)
    yesterday = (datetime.now() - timedelta(days=1)).date()
    yesterday_start = datetime.combine(yesterday, datetime.min.time())
    yesterday_end = datetime.combine(yesterday, datetime.max.time())

    print(f"Looking for completed deliveries on {yesterday} ...")

    # Find admin user for created_by_user_id
    cur.execute("SELECT id FROM users WHERE email = %s", ("john@doe.com",))
    admin_row = cur.fetchone()
    if not admin_row:
        print("ERROR: Admin user john@doe.com not found")
        conn.close()
        sys.exit(1)
    admin_user_id = admin_row["id"]

    # Query orders delivered yesterday with qualifying statuses
    cur.execute("""
        SELECT DISTINCT o.parent_account_id,
               pa.display_name,
               pa.billing_contact_email,
               o.delivery_date
        FROM orders o
        JOIN parent_accounts pa ON pa.id = o.parent_account_id
        WHERE o.delivery_date >= %s
          AND o.delivery_date <= %s
          AND o.status IN ('completed', 'submitted', 'confirmed')
          AND pa.billing_contact_email IS NOT NULL
          AND pa.billing_contact_email != ''
    """, (yesterday_start, yesterday_end))

    accounts = cur.fetchall()
    print(f"Found {len(accounts)} unique account(s) with deliveries yesterday.")

    sent_count = 0
    skipped_count = 0

    for acct in accounts:
        parent_account_id = acct["parent_account_id"]
        display_name = acct["display_name"]
        email = acct["billing_contact_email"]
        delivery_date = acct["delivery_date"]

        # Check for existing follow_up communication_log for this account on yesterday
        cur.execute("""
            SELECT id FROM communication_logs
            WHERE parent_account_id = %s
              AND type = 'follow_up'
              AND created_at >= %s
              AND created_at <= %s
            LIMIT 1
        """, (parent_account_id, yesterday_start, yesterday_end + timedelta(days=1)))

        if cur.fetchone():
            print(f"  SKIP: {display_name} ({email}) — follow-up already sent.")
            skipped_count += 1
            continue

        delivery_date_str = delivery_date.strftime("%B %-d, %Y")
        subject = f"How was everything, {display_name}?"
        body_html = build_email_html(display_name, delivery_date_str)

        try:
            send_notification_email(email, subject, body_html)
            print(f"  SENT: {display_name} ({email})")

            # Log to communication_logs
            log_id = str(uuid.uuid4()).replace("-", "")[:25]
            now = datetime.now()
            cur.execute("""
                INSERT INTO communication_logs
                    (id, parent_account_id, type, subject, body, recipient_email,
                     template_used, status, created_by_user_id, created_at)
                VALUES (%s, %s, 'follow_up', %s, %s, %s,
                        'Auto: Post-Delivery Follow-Up', 'sent', %s, %s)
            """, (log_id, parent_account_id, subject, body_html, email,
                  admin_user_id, now))
            conn.commit()
            sent_count += 1

        except Exception as e:
            print(f"  ERROR sending to {display_name} ({email}): {e}")
            conn.rollback()

    print(f"\nDone. Sent: {sent_count}, Skipped (already sent): {skipped_count}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
