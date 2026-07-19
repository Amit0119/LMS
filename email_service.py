import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import threading
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    @staticmethod
    def send_verification_email(receiver_email, user_name, verification_link):
        sender_email = os.getenv('SMTP_EMAIL')
        sender_password = os.getenv('SMTP_PASSWORD')

        if not sender_email or not sender_password or sender_email == 'your_gmail_id@gmail.com':
            print("WARNING: SMTP credentials not set. Email not sent.")
            return False

        from firebase_service import FirebaseService
        settings = FirebaseService.get_settings()
        library_name = settings.get('libraryName', 'SmartLMS') if 'error' not in settings else 'SmartLMS'
        support_email = settings.get('supportEmail', 'support@smartlms.com') if 'error' not in settings else 'support@smartlms.com'

        message = MIMEMultipart("alternative")
        message["Subject"] = f"Verify your email for {library_name}"
        message["From"] = f"{library_name} Admin <{sender_email}>"
        message["To"] = receiver_email

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
                .logo {{ font-size: 24px; font-weight: bold; color: #6388ff; margin-bottom: 20px; text-align: center; }}
                h2 {{ color: #1a1f36; font-size: 22px; }}
                p {{ color: #4f566b; line-height: 1.6; font-size: 15px; }}
                .button {{ display: inline-block; background-color: #6388ff; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; text-align: center; }}
                .footer {{ margin-top: 40px; font-size: 13px; color: #8b8fa3; text-align: center; border-top: 1px solid #e3e8ee; padding-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">📚 {library_name}</div>
                <h2>Welcome, {user_name}!</h2>
                <p>Thank you for registering with {library_name}. To complete your registration and gain access to the dashboard, please verify your email address by clicking the button below.</p>
                
                <div style="text-align: center;">
                    <a href="{verification_link}" class="button">Verify Email Address</a>
                </div>
                
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="font-size: 13px; word-break: break-all; color: #6388ff;">{verification_link}</p>
                
                <div class="footer">
                    <p>If you did not create an account, no further action is required.</p>
                    <p>Need help? Contact us at <a href="mailto:{support_email}">{support_email}</a></p>
                    <p>&copy; 2026 {library_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        part = MIMEText(html, "html")
        message.attach(part)
        
        def send_email_async():
            try:
                # Add 5 second timeout to prevent hanging on Render where SMTP might be blocked
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=5) as server:
                    server.login(sender_email, sender_password)
                    server.sendmail(sender_email, receiver_email, message.as_string())
            except Exception as e:
                print(f"Failed to send email async: {e}")

        # Send in background so UI doesn't hang if SMTP is blocked
        threading.Thread(target=send_email_async).start()
        return True

    @staticmethod
    def send_password_reset_email(receiver_email, user_name, reset_link):
        sender_email = os.getenv('SMTP_EMAIL')
        sender_password = os.getenv('SMTP_PASSWORD')

        if not sender_email or not sender_password or sender_email == 'your_gmail_id@gmail.com':
            print("WARNING: SMTP credentials not set. Email not sent.")
            return False

        from firebase_service import FirebaseService
        settings = FirebaseService.get_settings()
        library_name = settings.get('libraryName', 'SmartLMS') if 'error' not in settings else 'SmartLMS'
        support_email = settings.get('supportEmail', 'support@smartlms.com') if 'error' not in settings else 'support@smartlms.com'

        message = MIMEMultipart("alternative")
        message["Subject"] = f"Reset your password for {library_name}"
        message["From"] = f"{library_name} Admin <{sender_email}>"
        message["To"] = receiver_email

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
                .logo {{ font-size: 24px; font-weight: bold; color: #6388ff; margin-bottom: 20px; text-align: center; }}
                h2 {{ color: #1a1f36; font-size: 22px; }}
                p {{ color: #4f566b; line-height: 1.6; font-size: 15px; }}
                .button {{ display: inline-block; background-color: #fca5a5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; text-align: center; }}
                .footer {{ margin-top: 40px; font-size: 13px; color: #8b8fa3; text-align: center; border-top: 1px solid #e3e8ee; padding-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">📚 {library_name}</div>
                <h2>Hello, {user_name}!</h2>
                <p>We received a request to reset the password for your {library_name} account. Click the button below to choose a new password.</p>
                
                <div style="text-align: center;">
                    <a href="{reset_link}" class="button">Reset Password</a>
                </div>
                
                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="font-size: 13px; word-break: break-all; color: #6388ff;">{reset_link}</p>
                
                <div class="footer">
                    <p>If you did not request a password reset, you can safely ignore this email.</p>
                    <p>Need help? Contact us at <a href="mailto:{support_email}">{support_email}</a></p>
                    <p>&copy; 2026 {library_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        part = MIMEText(html, "html")
        message.attach(part)

        def send_async():
            try:
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=5) as server:
                    server.login(sender_email, sender_password)
                    server.sendmail(sender_email, receiver_email, message.as_string())
            except Exception as e:
                print(f"Failed to send email: {e}")

        threading.Thread(target=send_async).start()
        return True

    @staticmethod
    def send_password_change_confirmation(receiver_email, user_name):
        sender_email = os.getenv('SMTP_EMAIL')
        sender_password = os.getenv('SMTP_PASSWORD')

        if not sender_email or not sender_password or sender_email == 'your_gmail_id@gmail.com':
            print("WARNING: SMTP credentials not set. Email not sent.")
            return False

        from firebase_service import FirebaseService
        settings = FirebaseService.get_settings()
        library_name = settings.get('libraryName', 'SmartLMS') if 'error' not in settings else 'SmartLMS'
        support_email = settings.get('supportEmail', 'support@smartlms.com') if 'error' not in settings else 'support@smartlms.com'

        message = MIMEMultipart("alternative")
        message["Subject"] = f"Your Password Has Been Changed - {library_name}"
        message["From"] = f"{library_name} Admin <{sender_email}>"
        message["To"] = receiver_email

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
                .logo {{ font-size: 24px; font-weight: bold; color: #6388ff; margin-bottom: 20px; text-align: center; }}
                h2 {{ color: #1a1f36; font-size: 22px; }}
                p {{ color: #4f566b; line-height: 1.6; font-size: 15px; }}
                .footer {{ margin-top: 40px; font-size: 13px; color: #8b8fa3; text-align: center; border-top: 1px solid #e3e8ee; padding-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">📚 {library_name}</div>
                <h2>Hello, {user_name}!</h2>
                <p>This is a confirmation that the password for your {library_name} account has just been changed.</p>
                
                <p>If you made this change, you can safely ignore this email.</p>
                <p style="color: #ef4444; font-weight: bold;">If you did not change your password, please contact an administrator immediately.</p>
                
                <div class="footer">
                    <p>Need help? Contact us at <a href="mailto:{support_email}">{support_email}</a></p>
                    <p>&copy; 2026 {library_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        part = MIMEText(html, "html")
        message.attach(part)

        def send_async():
            try:
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=5) as server:
                    server.login(sender_email, sender_password)
                    server.sendmail(sender_email, receiver_email, message.as_string())
            except Exception as e:
                print(f"Failed to send email: {e}")

        threading.Thread(target=send_async).start()
        return True
