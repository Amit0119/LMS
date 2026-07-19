import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv
from auth_service import AuthService

load_dotenv()

cred = credentials.Certificate(os.getenv('FIREBASE_CONFIG_PATH'))
firebase_admin.initialize_app(cred, {
    'databaseURL': os.getenv('FIREBASE_DATABASE_URL')
})

db = firestore.client()

class FirebaseService:
    
    # ===== BOOKS =====
    @staticmethod
    def get_all_books(filters=None):
        query = db.collection('books').where('isActive', '==', True)
        
        if filters:
            if filters.get('category'):
                query = query.where('category', '==', filters['category'])
            if filters.get('minYear'):
                query = query.where('publicationYear', '>=', filters['minYear'])
                
        page = int(filters.get('page', 1)) if filters else 1
        limit_val = int(filters.get('limit', 100)) if filters else 100
        offset_val = (page - 1) * limit_val
        
        try:
            count_result = query.count().get()
            total_count = count_result[0][0].value if count_result else 0
        except Exception:
            total_count = 0
            
        books = []
        paginated_query = query.offset(offset_val).limit(limit_val)
        for doc in paginated_query.stream():
            book = doc.to_dict()
            book['id'] = doc.id
            books.append(book)
            
        return {
            'books': books,
            'total': total_count,
            'page': page,
            'limit': limit_val,
            'totalPages': (total_count + limit_val - 1) // limit_val if total_count > 0 else 0
        }

    @staticmethod
    def get_book_by_id(book_id):
        doc = db.collection('books').document(book_id).get()
        if doc.exists:
            book = doc.to_dict()
            book['id'] = doc.id
            return book
        return None

    @staticmethod
    def add_book(book_data):
        try:
            book_id = book_data.get('id')
            if not book_id:
                return {'success': False, 'error': 'Book ID required'}
            
            book_data['createdAt'] = firestore.SERVER_TIMESTAMP
            book_data['updatedAt'] = firestore.SERVER_TIMESTAMP
            book_data['isActive'] = True
            book_data['rating'] = {'averageRating': 0, 'totalReviews': 0, 'reviews': []}
            book_data['cover'] = book_data.get('cover', {'url': None, 'cloudinaryId': None})
            
            db.collection('books').document(book_id).set(book_data)
            return {'success': True, 'id': book_id}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def update_book(book_id, updates):
        try:
            updates['updatedAt'] = firestore.SERVER_TIMESTAMP
            db.collection('books').document(book_id).update(updates)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def delete_book(book_id):
        try:
            # Soft delete instead of db.collection('books').document(book_id).delete()
            db.collection('books').document(book_id).update({
                'isActive': False,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ===== MEMBERS =====
    @staticmethod
    def get_all_members(filters=None):
        query = db.collection('members')
        
        if filters:
            if filters.get('type'):
                query = query.where('type', '==', filters['type'])
            if filters.get('status'):
                query = query.where('membershipStatus', '==', filters['status'])
        
        members = []
        for doc in query.stream():
            member = doc.to_dict()
            member['id'] = doc.id
            members.append(member)
        return members

    @staticmethod
    def get_member_by_id(member_id):
        doc = db.collection('members').document(member_id).get()
        if doc.exists:
            return doc.to_dict()
        return None

    @staticmethod
    def add_member(member_data):
        try:
            member_id = member_data.get('id')
            if not member_id:
                return {'success': False, 'error': 'Member ID required'}
            
            member_data['createdAt'] = firestore.SERVER_TIMESTAMP
            member_data['updatedAt'] = firestore.SERVER_TIMESTAMP
            member_data['outstandingFine'] = 0
            member_data['totalBooksIssued'] = 0
            member_data['currentlyBorrowed'] = 0
            member_data['avatar'] = member_data.get('avatar', {'url': None, 'cloudinaryId': None})
            
            db.collection('members').document(member_id).set(member_data)
            return {'success': True, 'id': member_id}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def update_member(member_id, updates):
        try:
            updates['updatedAt'] = firestore.SERVER_TIMESTAMP
            db.collection('members').document(member_id).update(updates)
            
            user_updates = {}
            if 'membershipStatus' in updates:
                user_updates['membershipStatus'] = updates['membershipStatus']
            if 'fullName' in updates:
                user_updates['fullName'] = updates['fullName']
            if 'phone' in updates:
                user_updates['phone'] = updates['phone']
                
            if user_updates:
                user_updates['updatedAt'] = firestore.SERVER_TIMESTAMP
                try:
                    db.collection('users').document(member_id).update(user_updates)
                except Exception as user_e:
                    print(f"Warning: Could not sync update to users collection - {user_e}")
                    
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def delete_member(member_id):
        try:
            # Soft Delete (Block/Deactivate) instead of hard delete
            # 1. Update members collection
            db.collection('members').document(member_id).update({
                'membershipStatus': 'blocked',
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            
            # 2. Update users collection
            db.collection('users').document(member_id).update({
                'isActive': False,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            
            # 3. Disable user in Firebase Auth (prevents login)
            try:
                auth.update_user(member_id, disabled=True)
            except Exception as auth_err:
                print(f"Warning: Could not disable auth user - {auth_err}")
                
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def pay_fine(member_id):
        try:
            doc_ref = db.collection('members').document(member_id)
            doc = doc_ref.get()
            if not doc.exists:
                return {'success': False, 'error': 'Member not found'}
                
            member_data = doc.to_dict()
            fine_amount = member_data.get('outstandingFine', 0)
            
            if fine_amount <= 0:
                return {'success': False, 'error': 'No outstanding fine to pay'}
                
            doc_ref.update({
                'outstandingFine': 0,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            
            return {'success': True, 'paidAmount': fine_amount}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ===== TRANSACTIONS =====
    @staticmethod
    def get_all_transactions(filters=None):
        query = db.collection('transactions')
        
        if filters:
            if filters.get('status'):
                query = query.where('status', '==', filters['status'])
            if filters.get('memberId'):
                query = query.where('memberId', '==', filters['memberId'])
        
        transactions = []
        for doc in query.stream():
            txn = doc.to_dict()
            txn['id'] = doc.id
            transactions.append(txn)
        return transactions

    @staticmethod
    def create_transaction(txn_data):
        try:
            txn_id = txn_data.get('id')
            
            # 1. Validate Book Inventory
            book_ref = db.collection('books').document(txn_data['bookId'])
            book_doc = book_ref.get()
            if not book_doc.exists:
                return {'success': False, 'error': 'Book not found'}
            book_data = book_doc.to_dict()
            if book_data.get('copies', {}).get('available', 0) <= 0:
                return {'success': False, 'error': 'Book is currently out of stock'}

            # 2. Validate Member Borrow Limit
            member_ref = db.collection('members').document(txn_data['memberId'])
            member_doc = member_ref.get()
            if not member_doc.exists:
                return {'success': False, 'error': 'Member not found'}
            member_data = member_doc.to_dict()
            if member_data.get('currentlyBorrowed', 0) >= 3:
                return {'success': False, 'error': 'Member has reached maximum borrow limit (3 books)'}
            
            # Calculate due date (14 days from now)
            issue_date = datetime.now(timezone.utc)
            due_date = issue_date + timedelta(days=14)
            
            txn_data['issueDate'] = issue_date.isoformat() + 'Z'
            txn_data['dueDate'] = due_date.isoformat() + 'Z'
            txn_data['returnDate'] = None
            txn_data['returnedBy'] = None
            txn_data['fine'] = 0
            txn_data['status'] = 'issued'
            txn_data['renewalCount'] = 0
            txn_data['renewalDates'] = []
            txn_data['createdAt'] = firestore.SERVER_TIMESTAMP
            
            db.collection('transactions').document(txn_id).set(txn_data)
            
            # Decrement available copies
            book_ref.update({
                'copies.available': firestore.Increment(-1),
                'copies.issued': firestore.Increment(1)
            })
            
            # Update member borrow count
            member_ref.update({
                'currentlyBorrowed': firestore.Increment(1),
                'totalBooksIssued': firestore.Increment(1)
            })
            
            # Create "due_soon" notification for day 11
            FirebaseService.create_notification(
                txn_data['memberId'],
                {
                    'type': 'due_soon',
                    'title': 'Book Due Soon!',
                    'message': f"{txn_data['bookName']} is due in 3 days ({due_date.strftime('%d-%b-%Y')})",
                    'relatedBookId': txn_data['bookId'],
                    'relatedTransactionId': txn_id
                }
            )
            
            return {'success': True, 'id': txn_id}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def return_book(txn_id, return_data):
        try:
            # Get transaction to calculate fine
            doc = db.collection('transactions').document(txn_id).get()
            if not doc.exists:
                return {'success': False, 'error': 'Transaction not found'}
            
            txn = doc.to_dict()
            return_date = datetime.now(timezone.utc)
            due_date = datetime.fromisoformat(txn['dueDate'].replace('Z', '+00:00'))
            
            # Calculate fine: ₹5 per day, max ₹500
            days_late = (return_date - due_date).days
            fine = 0
            if days_late > 0:
                fine = min(days_late * 5, 500)
            
            return_data['returnDate'] = return_date.isoformat() + 'Z'
            return_data['fine'] = fine
            return_data['status'] = 'returned'
            return_data['updatedAt'] = firestore.SERVER_TIMESTAMP
            
            db.collection('transactions').document(txn_id).update(return_data)
            
            # Update member fine and borrow count
            db.collection('members').document(txn['memberId']).update({
                'outstandingFine': firestore.Increment(fine),
                'currentlyBorrowed': firestore.Increment(-1)
            })
            
            # Increment available copies back
            db.collection('books').document(txn['bookId']).update({
                'copies.available': firestore.Increment(1),
                'copies.issued': firestore.Increment(-1)
            })
            
            return {'success': True, 'fine': fine}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def renew_book(txn_id, current_user=None):
        try:
            doc = db.collection('transactions').document(txn_id).get()
            if not doc.exists:
                return {'success': False, 'error': 'Transaction not found'}
            
            txn = doc.to_dict()
            
            # Security: IDOR protection
            if current_user and current_user.get('role') != 'admin':
                if txn.get('memberId') != current_user.get('uid'):
                    return {'success': False, 'error': 'Unauthorized'}
            
            # Check max renewals (2 times)
            if txn.get('renewalCount', 0) >= 2:
                return {'success': False, 'error': 'Max renewal limit reached'}
            
            # Check if overdue
            current_due = datetime.fromisoformat(txn['dueDate'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            if now > current_due:
                return {'success': False, 'error': 'Cannot renew an overdue book. Please return it and clear your fine.'}
            
            # Extend due date by 14 days from today
            new_due = now + timedelta(days=14)
            
            db.collection('transactions').document(txn_id).update({
                'dueDate': new_due.isoformat() + 'Z',
                'renewalCount': firestore.Increment(1),
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            
            return {'success': True, 'newDueDate': new_due.isoformat() + 'Z'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ===== USERS =====
    @staticmethod
    def create_user(email, password, user_data):
        try:
            user = auth.create_user(
                email=email,
                password=password,
                display_name=user_data.get('fullName')
            )
            
            hashed_password = AuthService.hash_password(password)
            
            # Determine initial status
            initial_status = 'active' if user_data.get('role') == 'admin' else 'pending_approval'

            user_doc = {
                'uid': user.uid,
                'email': email,
                'fullName': user_data.get('fullName'),
                'role': user_data.get('role', 'student'),
                'phone': user_data.get('phone', ''),
                'hashedPassword': hashed_password,
                'avatar': {'url': None, 'cloudinaryId': None},
                'createdAt': firestore.SERVER_TIMESTAMP,
                'lastLogin': None,
                'isActive': True,
                'emailVerified': False,
                'membershipStatus': initial_status
            }
            
            db.collection('users').document(user.uid).set(user_doc)
            
            # Also create corresponding member document to keep DB synced
            member_doc = {
                'email': email,
                'fullName': user_data.get('fullName'),
                'type': user_data.get('role', 'student'),
                'phone': user_data.get('phone', ''),
                'outstandingFine': 0,
                'totalBooksIssued': 0,
                'currentlyBorrowed': 0,
                'membershipStatus': initial_status,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'avatar': {'url': None, 'cloudinaryId': None}
            }
            db.collection('members').document(user.uid).set(member_doc)
            
            # Clean up any orphaned Firestore docs with same email but different UID
            try:
                old_docs = db.collection('users').where('email', '==', email).stream()
                for old_doc in old_docs:
                    if old_doc.id != user.uid:
                        db.collection('users').document(old_doc.id).delete()
                        db.collection('members').document(old_doc.id).delete()
                        print(f"Cleaned up orphaned user and member doc: {old_doc.id}")
            except Exception as cleanup_err:
                print(f"Warning: Orphan cleanup failed - {cleanup_err}")
            
            # Generate and send verification link
            try:
                link = auth.generate_email_verification_link(email)
                from email_service import EmailService
                EmailService.send_verification_email(email, user_data.get('fullName', 'User'), link)
            except Exception as email_err:
                print(f"Warning: Could not send email - {email_err}")
                
            return {'success': True, 'uid': user.uid}
        except auth.EmailAlreadyExistsError:
            return {'success': False, 'error': 'Email already registered'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def admin_exists():
        try:
            admins = db.collection('users').where('role', '==', 'admin').limit(1).get()
            return len(admins) > 0
        except Exception as e:
            return False

    @staticmethod
    def get_user_by_email(email):
        try:
            users = db.collection('users').where('email', '==', email).stream()
            for doc in users:
                return doc.to_dict()
            return None
        except Exception as e:
            return None

    @staticmethod
    def get_user_by_uid(uid):
        try:
            doc = db.collection('users').document(uid).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            return None

    @staticmethod
    def update_user(uid, updates):
        try:
            updates['updatedAt'] = firestore.SERVER_TIMESTAMP
            db.collection('users').document(uid).update(updates)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def get_user_stats(uid):
        try:
            txns = db.collection('transactions').where('memberId', '==', uid).stream()
            stats = {
                'lifetime_books': 0,
                'currently_issued': 0,
                'total_fine': 0
            }
            for t in txns:
                txn = t.to_dict()
                stats['lifetime_books'] += 1
                if txn.get('status') == 'issued':
                    stats['currently_issued'] += 1
                stats['total_fine'] += txn.get('fine', 0)
            return stats
        except Exception as e:
            print("Error getting user stats:", e)
            return {'lifetime_books': 0, 'currently_issued': 0, 'total_fine': 0}

    # ===== NOTIFICATIONS =====
    @staticmethod
    def create_notification(member_id, notif_data):
        try:
            notif = {
                'memberId': member_id,
                'type': notif_data['type'],
                'title': notif_data.get('title'),
                'message': notif_data.get('message'),
                'relatedBookId': notif_data.get('relatedBookId'),
                'relatedTransactionId': notif_data.get('relatedTransactionId'),
                'isRead': False,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'expiresAt': datetime.now(timezone.utc) + timedelta(days=7)
            }
            
            db.collection('notifications').document(member_id).collection('notifications').document().set(notif)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def get_user_notifications(member_id, unread_only=False):
        try:
            query = db.collection('notifications').document(member_id).collection('notifications')
            
            if unread_only:
                query = query.where('isRead', '==', False)
            
            notifications = []
            for doc in query.stream():
                notif = doc.to_dict()
                notif['id'] = doc.id
                notifications.append(notif)
            
            return notifications
        except Exception as e:
            return []

    # ===== ANALYTICS =====
    @staticmethod
    def generate_monthly_report(year, month):
        try:
            # Get all transactions for the month
            start_date = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
            
            transactions = db.collection('transactions').where(
                'createdAt', '>=', start_date
            ).where('createdAt', '<', end_date).stream()
            
            issued_count = 0
            returned_count = 0
            on_time = 0
            late = 0
            total_fine = 0
            collected_fine = 0
            
            for doc in transactions:
                txn = doc.to_dict()
                if txn.get('status') in ['issued', 'returned']:
                    issued_count += 1
                
                if txn.get('status') == 'returned':
                    returned_count += 1
                    if txn.get('returnDate'):
                        return_date = datetime.fromisoformat(txn['returnDate'].replace('Z', '+00:00'))
                        due_date = datetime.fromisoformat(txn['dueDate'].replace('Z', '+00:00'))
                        if return_date <= due_date:
                            on_time += 1
                        else:
                            late += 1
                
                total_fine += txn.get('fine', 0)
            
            report = {
                'year': year,
                'month': month,
                'booksIssued': {'count': issued_count},
                'booksReturned': {'count': returned_count, 'onTime': on_time, 'late': late},
                'fineCollection': {'totalFine': total_fine},
                'generatedOn': datetime.now(timezone.utc).isoformat()
            }
            
            db.collection('analytics').document(f'{year}-{month:02d}').set(report)
            return report
        except Exception as e:
            return {'error': str(e)}

    @staticmethod
    def get_dashboard_stats():
        try:
            books_count = db.collection('books').count().get()
            total_books = books_count[0][0].value if books_count else 0
            
            members_count = db.collection('members').count().get()
            total_members = members_count[0][0].value if members_count else 0
            
            active_txns = 0
            overdue = 0
            total_fine = 0
            
            # Fetch fine amounts safely
            fine_txns = db.collection('transactions').where('fine', '>', 0).stream()
            for txn_doc in fine_txns:
                total_fine += txn_doc.to_dict().get('fine', 0)
                
            # Fetch active transactions for overdue logic
            active_txns_query = db.collection('transactions').where('status', '==', 'issued').stream()
            for txn_doc in active_txns_query:
                active_txns += 1
                txn = txn_doc.to_dict()
                due_date = datetime.fromisoformat(txn['dueDate'].replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > due_date:
                    overdue += 1
            
            return {
                'totalBooks': total_books,
                'totalMembers': total_members,
                'activeTransactions': active_txns,
                'overdueBooks': overdue,
                'totalFinesPending': total_fine,
                'inventory': {
                    'available': max(0, total_books - active_txns),
                    'issued': active_txns,
                    'reserved': 0
                }
            }
        except Exception as e:
            return {'error': str(e)}

    # ===== SETTINGS =====
    @staticmethod
    def get_settings():
        try:
            doc = db.collection('config').document('general_settings').get()
            if doc.exists:
                return doc.to_dict()
            return {
                'finePerDay': 5,
                'maxBorrowDays': 14,
                'maxBooksPerMember': 3,
                'libraryName': 'SmartLMS',
                'supportEmail': 'support@smartlms.com',
                'require2FA': False,
                'forcePasswordReset': False,
                'notifyOverdue': True,
                'notifyWelcome': True
            }
        except Exception as e:
            return {'error': str(e)}

    @staticmethod
    def update_settings(data):
        try:
            db.collection('config').document('general_settings').set(data, merge=True)
            return {'success': True}
        except Exception as e:
            return {'error': str(e)}