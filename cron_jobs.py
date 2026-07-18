import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from firebase_admin import credentials, firestore, initialize_app
from email_service import EmailService

# Initialize Firebase
load_dotenv()
try:
    initialize_app(credentials.Certificate('firebase_key.json'))
except ValueError:
    pass

db = firestore.client()

def run_daily_cron():
    print("Starting daily cron job...")
    
    # 1. Fetch all currently issued transactions
    issued_txns = db.collection('transactions').where('status', '==', 'issued').stream()
    
    now = datetime.now(timezone.utc)
    emails_sent = 0
    fines_updated = 0
    
    for doc in issued_txns:
        txn = doc.to_dict()
        txn_id = doc.id
        
        try:
            due_date = datetime.fromisoformat(txn['dueDate'].replace('Z', '+00:00'))
        except Exception:
            continue
            
        days_late = (now - due_date).days
        
        # If overdue
        if days_late > 0:
            current_fine = txn.get('fine', 0)
            calculated_fine = min(days_late * 5, 500)
            
            # Update fine on transaction if it has increased
            if calculated_fine > current_fine:
                db.collection('transactions').document(txn_id).update({
                    'fine': calculated_fine,
                    'updatedAt': firestore.SERVER_TIMESTAMP
                })
                fines_updated += 1
            
            # Send Email reminders on specific days (1st day, 3rd day, 7th day, every 7 days after)
            if days_late in [1, 3, 7] or (days_late > 7 and days_late % 7 == 0):
                # Fetch member to get email
                member_doc = db.collection('members').document(txn['memberId']).get()
                if member_doc.exists:
                    member = member_doc.to_dict()
                    email = member.get('email')
                    name = member.get('fullName', 'Student')
                    book_name = txn.get('bookName', 'Book')
                    
                    if email:
                        try:
                            # Use EmailService
                            subject = f"OVERDUE NOTICE: Please return '{book_name}'"
                            body = f"""
                            <div style="font-family: Arial, sans-serif; padding: 20px;">
                                <h2>Library Overdue Notice</h2>
                                <p>Dear {name},</p>
                                <p>This is a reminder that the book <strong>'{book_name}'</strong> is now <strong>{days_late} days overdue</strong>.</p>
                                <p>Your current accrued fine for this book is <strong>₹{calculated_fine}</strong>.</p>
                                <p>Please return the book to the library as soon as possible to avoid further fines.</p>
                                <p>Thank you.</p>
                            </div>
                            """
                            EmailService.send_email(email, subject, body)
                            emails_sent += 1
                            print(f"Sent overdue email to {email} for {book_name}")
                        except Exception as e:
                            print(f"Failed to send email to {email}: {e}")

    print(f"Cron job complete. Updated {fines_updated} fines and sent {emails_sent} reminder emails.")

if __name__ == "__main__":
    run_daily_cron()
