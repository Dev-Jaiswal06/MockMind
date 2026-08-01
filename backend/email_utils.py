# backend/email_utils.py
import re
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dns import resolver

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def validate_email_address(email):
    """Best-effort email existence check: format + MX + SMTP RCPT"""
    if not EMAIL_REGEX.match(email):
        return False

    domain = email.split("@")[1]

    # 1) MX records — domain ka mail server hona chahiye
    try:
        mx_records = resolver.resolve(domain, "MX")
        if not mx_records:
            return False
        mx_host = str(sorted(mx_records, key=lambda r: r.preference)[0].exchange).rstrip(".")
    except Exception:
        return False

    # 2) SMTP RCPT — mail server se puchho mailbox exists hai ya nahi
    sender = os.getenv("EMAIL_USER", "verify@mockmind.local")
    try:
        server = smtplib.SMTP(mx_host, 25, timeout=8)
        server.ehlo("mockmind.local")
        if server.has_extn("starttls"):
            server.starttls()
            server.ehlo("mockmind.local")
        mail_code, _ = server.mail(sender)
        if mail_code >= 400:
            try:
                server.quit()
            except Exception:
                pass
            return True
        rcpt_code, _ = server.rcpt(email)
        try:
            server.quit()
        except Exception:
            pass
        return rcpt_code < 500
    except Exception:
        # Server ne probe reject kiya / timeout — block mat karo
        return True


def send_verification_email(to_email, code):
    """6-digit email verification code bhejo via Gmail SMTP"""
    sender    = os.getenv("EMAIL_USER", "")
    password  = os.getenv("EMAIL_PASS", "")

    if not sender or not password:
        print("[!] EMAIL_USER or EMAIL_PASS not set -- skipping email")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"]    = f"MockMind <{sender}>"
    msg["To"]      = to_email
    msg["Subject"] = "Your MockMind verification code"

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:900;">
          <span style="color:#7c3aed;">Mock</span><span style="color:#0f172a;">Mind</span>
        </span>
      </div>
      <h1 style="color:#0f172a;text-align:center;font-size:24px;margin:0 0 24px;">
        Verify Your MockMind Account
      </h1>
      <p style="color:#475569;font-size:15px;line-height:1.6;">Hi,</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">
        Thank you for signing up for <strong>MockMind</strong>.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">
        Please use the following <strong>6-digit verification code</strong> to verify your account:
      </p>
      <div style="text-align:center;margin:28px 0;">
        <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#0f172a;">
          {code}
        </span>
      </div>
      <blockquote style="margin:0 0 24px;padding:12px 16px;background:#f8fafc;border-left:4px solid #7c3aed;color:#0f172a;font-size:15px;font-weight:600;">
        This verification code is valid for 15 minutes.
      </blockquote>
      <p style="color:#475569;font-size:15px;line-height:1.6;">
        If you did not create a MockMind account, you can safely ignore this email.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;">Thank you,<br/><strong>MockMind Team</strong></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="color:#94a3b8;font-size:12px;text-align:center;">
        MockMind — AI-Powered Mock Interview System
      </p>
    </div>
    """

    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10)
        server.login(sender, password)
        server.sendmail(sender, to_email, msg.as_string())
        server.quit()
        print(f"[OK] Verification email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[ERR] Failed to send email: {e}")
        return False


def send_reset_email(to_email, reset_link):
    """Password reset email bhejo via Gmail SMTP"""
    sender    = os.getenv("EMAIL_USER", "")
    password  = os.getenv("EMAIL_PASS", "")

    if not sender or not password:
        print("[!] EMAIL_USER or EMAIL_PASS not set -- skipping email")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"]    = f"MockMind <{sender}>"
    msg["To"]      = to_email
    msg["Subject"] = "Reset your MockMind password"

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:28px;font-weight:900;">
          <span style="color:#7c3aed;">Mock</span><span style="color:#0f172a;">Mind</span>
        </span>
      </div>
      <h2 style="color:#0f172a;text-align:center;margin-bottom:16px;">Reset your password</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;">
        We received a request to reset the password for your MockMind account.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{reset_link}"
           style="background:linear-gradient(135deg,#7c3aed,#06b6d4);
                  color:#fff;padding:14px 32px;border-radius:10px;
                  text-decoration:none;font-weight:700;font-size:15px;
                  display:inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;text-align:center;">
        This link expires in 15 minutes.<br/>
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="color:#94a3b8;font-size:12px;text-align:center;">
        MockMind — AI-Powered Mock Interview System
      </p>
    </div>
    """

    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10)
        server.login(sender, password)
        server.sendmail(sender, to_email, msg.as_string())
        server.quit()
        print(f"[OK] Reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[ERR] Failed to send email: {e}")
        return False
