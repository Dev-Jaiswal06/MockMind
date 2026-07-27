# backend/email_utils.py
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_reset_email(to_email, reset_link):
    """Password reset email bhejo via Gmail SMTP"""
    sender    = os.getenv("EMAIL_USER", "")
    password  = os.getenv("EMAIL_PASS", "")

    if not sender or not password:
        print("⚠️ EMAIL_USER or EMAIL_PASS not set — skipping email")
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
        print(f"✅ Reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False
