from flask import Blueprint, request, jsonify
from firebase_service import FirebaseService
from cloudinary_service import CloudinaryService
from auth_service import AuthService
from datetime import datetime, timezone, timedelta
import os
from jose import jwt, JWTError
import uuid

import time

class APIRateLimiter:
    def __init__(self, max_attempts=5, window_seconds=60):
        self.attempts = {}
        self.max_attempts = max_attempts
        self.window = window_seconds

    def is_allowed(self, ip):
        now = time.time()
        # Clean up old attempts safely
        if ip in self.attempts:
            self.attempts[ip] = [t for t in self.attempts[ip] if now - t < self.window]
        else:
            self.attempts[ip] = []
            
        if len(self.attempts[ip]) >= self.max_attempts:
            return False
            
        self.attempts[ip].append(now)
        return True

auth_limiter = APIRateLimiter(max_attempts=5, window_seconds=60)

api = Blueprint('api', __name__, url_prefix='/api')

firebase = FirebaseService()
cloudinary_svc = CloudinaryService()
auth = AuthService()

# ===== AUTH =====

@api.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    
    if len(data.get('fullName', '')) > 50:
        return jsonify({'error': 'Full name must be less than 50 characters'}), 400
    if len(data.get('email', '')) > 100:
        return jsonify({'error': 'Email is too long'}), 400
    if not all(k in data for k in ['email', 'password', 'fullName', 'role']):
        return jsonify({'error': 'Missing fields'}), 400
    
    email = data['email'].lower().strip()
    
    if not auth.is_valid_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    is_valid, msg = auth.is_strong_password(data['password'])
    if not is_valid:
        return jsonify({'error': msg}), 400
    
    role = data.get('role', 'student')
    if role not in ['student', 'admin']:
        return jsonify({'error': 'Invalid role'}), 400
        
    if role == 'admin':
        admin_secret = os.getenv('ADMIN_REGISTRATION_SECRET')
        provided_secret = data.get('adminSecret')
        if not admin_secret or provided_secret != admin_secret:
            return jsonify({'error': 'Invalid or missing Admin Registration Secret. Unauthorized to register as admin.'}), 403
        
        if firebase.admin_exists():
            return jsonify({'error': 'An admin already exists in the system. You can only register as a student.'}), 400
    
    result = firebase.create_user(email, data['password'], {
        'fullName': data['fullName'],
        'role': role,
        'phone': data.get('phone', '')
    })
    
    return jsonify(result), (201 if result['success'] else 400)

@api.route('/auth/login', methods=['POST'])
def login():

    client_ip = request.remote_addr
    if not auth_limiter.is_allowed(client_ip):
        return jsonify({'error': 'Too many attempts. Please try again in 1 minute.'}), 429
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    
    user = firebase.get_user_by_email(email)
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Verify password against stored hash
    if not auth.verify_password(password, user.get('hashedPassword', '')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Check if email is verified in Firebase Auth (MANDATORY - no bypass)
    from firebase_admin import auth as firebase_auth
    try:
        fb_user = firebase_auth.get_user(user['uid'])
        if not fb_user.email_verified:
            # Resend verification email if not verified
            try:
                link = firebase_auth.generate_email_verification_link(email)
                from email_service import EmailService
                EmailService.send_verification_email(email, user.get('fullName', 'User'), link)
            except Exception:
                pass  # Don't block login error for resend failure
            return jsonify({
                'error': 'Email not verified. A new verification link has been sent to your email. Please check your inbox and spam folder.',
                'code': 'EMAIL_NOT_VERIFIED'
            }), 403
    except Exception as e:
        print(f"Auth check error: {e}")
        # SECURITY: If we can't verify email status, deny login
        return jsonify({'error': 'Unable to verify account status. Please try again later.'}), 500

    # Admin Approval Check
    if user.get('role') != 'admin':
        # Check from users collection or members collection
        # We stored it in users collection during registration
        if user.get('membershipStatus') == 'pending_approval':
            return jsonify({'error': 'Your account is pending admin approval. Please wait for the librarian to approve your registration.'}), 403
        
    token = auth.generate_token(user['email'], user['role'], user['uid'])
    
    firebase.update_user(user['uid'], {'lastLogin': datetime.now(timezone.utc).isoformat()})
    
    return jsonify({
        'success': True,
        'accessToken': token,
        'uid': user['uid'],
        'email': user['email'],
        'role': user['role'],
        'fullName': user.get('fullName'),
        'avatar': user.get('avatar'),
        'expiresIn': 7200
    }), 200

@api.route('/auth/me', methods=['GET'])
@auth.require_auth()
def get_current_user():
    user = auth.get_current_user()
    return jsonify(user), 200

@api.route('/auth/forgot-password', methods=['POST'])
def forgot_password():

    client_ip = request.remote_addr
    if not auth_limiter.is_allowed(client_ip):
        return jsonify({'error': 'Too many attempts. Please try again in 1 minute.'}), 429
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    
    if not email:
        return jsonify({'error': 'Email required'}), 400
        
    user = firebase.get_user_by_email(email)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    # Generate a short-lived token for reset
    payload = {
        'email': email,
        'uid': user['uid'],
        'exp': datetime.now(timezone.utc) + timedelta(minutes=15),
        'iat': datetime.now(timezone.utc)
    }
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-min-50-chars')
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
    
    reset_link = f"{request.host_url.rstrip('/')}/reset-password?token={token}"
    
    from email_service import EmailService
    EmailService.send_password_reset_email(email, user.get('fullName', 'User'), reset_link)
    
    return jsonify({'success': True, 'message': 'Password reset link sent to your email.'}), 200

@api.route('/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('newPassword', '')
    
    if not token or not new_password:
        return jsonify({'error': 'Token and new password required'}), 400
        
    # Verify token
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-min-50-chars')
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        email = payload.get('email')
        token_iat = datetime.fromtimestamp(payload.get('iat'), timezone.utc) if payload.get('iat') else None
    except JWTError:
        return jsonify({'error': 'Invalid or expired token. Please request a new reset link.'}), 400
    
    is_valid, msg = auth.is_strong_password(new_password)
    if not is_valid:
        return jsonify({'error': msg}), 400
    
    user = firebase.get_user_by_email(email)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    # Prevent token reuse by checking if password was updated after token was issued
    if token_iat and user.get('updatedAt'):
        updated_at = user['updatedAt']
        if hasattr(updated_at, 'timestamp'):
            updated_at_dt = datetime.fromtimestamp(updated_at.timestamp(), timezone.utc)
        elif isinstance(updated_at, datetime):
            updated_at_dt = updated_at
        else:
            updated_at_dt = None
            
        if updated_at_dt and token_iat < updated_at_dt:
            return jsonify({'error': 'This reset token has already been used.'}), 400
    
    hashed = auth.hash_password(new_password)
    firebase.update_user(user['uid'], {'hashedPassword': hashed})
    
    # Try updating Firebase Auth password as well
    from firebase_admin import auth as firebase_auth
    try:
        firebase_auth.update_user(user['uid'], password=new_password)
    except Exception as e:
        print(f"Warning: Could not update Firebase Auth password - {e}")
    
    from email_service import EmailService
    EmailService.send_password_change_confirmation(email, user.get('fullName', 'User'))
    
    return jsonify({'success': True, 'message': 'Password reset successfully'}), 200

@api.route('/auth/profile', methods=['GET'])
@auth.require_auth()
def get_profile():
    current_user = auth.get_current_user()
    uid = current_user.get('uid')
    
    user_data = firebase.get_user_by_uid(uid)
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
        
    stats = firebase.get_user_stats(uid)
    
    # Do not send hashed password to client
    if 'hashedPassword' in user_data:
        del user_data['hashedPassword']
        
    return jsonify({
        'profile': user_data,
        'stats': stats
    }), 200

@api.route('/auth/profile', methods=['PUT'])
@auth.require_auth()
def update_profile():
    current_user = auth.get_current_user()
    uid = current_user.get('uid')
    
    data = request.get_json()
    updates = {}
    
    if 'fullName' in data:
        updates['fullName'] = data['fullName']
    if 'phone' in data:
        updates['phone'] = data['phone']
    if 'notificationsEnabled' in data:
        updates['notificationsEnabled'] = data['notificationsEnabled']
        
    if not updates:
        return jsonify({'error': 'No data provided to update'}), 400
        
    result = firebase.update_user(uid, updates)
    return jsonify(result), (200 if result['success'] else 400)

# ===== BOOKS =====

@api.route('/books', methods=['GET'])
def get_books():
    filters = {}
    if request.args.get('category'):
        filters['category'] = request.args.get('category')
    
    books = firebase.get_all_books(filters)
    return jsonify(books), 200

@api.route('/books/<book_id>', methods=['GET'])
def get_book(book_id):
    book = firebase.get_book_by_id(book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    return jsonify(book), 200

@api.route('/books', methods=['POST'])
@auth.require_auth('admin')
def add_book():
    data = request.get_json()
    
    
    if len(data.get('name', '')) > 150 or len(data.get('author', '')) > 100:
        return jsonify({'error': 'Book name or author is too long'}), 400
    if not all(k in data for k in ['id', 'name', 'author', 'category']):
        return jsonify({'error': 'Missing fields'}), 400
    
    result = firebase.add_book(data)
    return jsonify(result), (201 if result['success'] else 400)

@api.route('/books/<book_id>', methods=['PUT'])
@auth.require_auth('admin')
def update_book(book_id):
    data = request.get_json()
    result = firebase.update_book(book_id, data)
    return jsonify(result), (200 if result['success'] else 400)

@api.route('/books/<book_id>', methods=['DELETE'])
@auth.require_auth('admin')
def delete_book(book_id):
    result = firebase.delete_book(book_id)
    return jsonify(result), (200 if result['success'] else 400)

@api.route('/books/<book_id>/upload-cover', methods=['POST'])
@auth.require_auth('admin')
def upload_book_cover(book_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    result = cloudinary_svc.upload_book_cover(file, book_id)
    
    if result['success']:
        firebase.update_book(book_id, {'cover': {
            'url': result['url'],
            'cloudinaryId': result['cloudinaryId']
        }})
    
    return jsonify(result), (200 if result['success'] else 400)

# ===== MEMBERS =====

@api.route('/members', methods=['GET'])
@auth.require_auth('admin')
def get_members():
    filters = {}
    if request.args.get('status'):
        filters['status'] = request.args.get('status')
    
    members = firebase.get_all_members(filters)
    return jsonify(members), 200

@api.route('/members/<member_id>', methods=['GET'])
@auth.require_auth()
def get_member(member_id):
    current_user = auth.get_current_user()
    if current_user.get('role') != 'admin' and current_user.get('uid') != member_id:
        return jsonify({'error': 'Unauthorized access'}), 403
        
    member = firebase.get_member_by_id(member_id)
    if not member:
        return jsonify({'error': 'Member not found'}), 404
    return jsonify(member), 200

@api.route('/members', methods=['POST'])
@auth.require_auth('admin')
def add_member():
    data = request.get_json()
    
    if 'id' not in data:
        return jsonify({'error': 'Missing member ID (id field required)'}), 400
        
    result = firebase.add_member(data)
    return jsonify(result), (201 if result['success'] else 400)

@api.route('/members/<member_id>', methods=['PUT'])
@auth.require_auth('admin')
def update_member(member_id):
    data = request.get_json()
    result = firebase.update_member(member_id, data)
    return jsonify(result), (200 if result['success'] else 400)

@api.route('/members/<member_id>', methods=['DELETE'])
@auth.require_auth('admin')
def delete_member(member_id):
    hard = request.args.get('hard') == 'true'
    result = firebase.delete_member(member_id, hard_delete=hard)
    return jsonify(result), (200 if result['success'] else 400)

@api.route('/members/<member_id>/upload-avatar', methods=['POST'])
@auth.require_auth()
def upload_avatar(member_id):
    current_user = auth.get_current_user()
    if current_user.get('role') != 'admin' and current_user.get('uid') != member_id:
        return jsonify({'error': 'Unauthorized access'}), 403

    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    result = cloudinary_svc.upload_member_avatar(file, member_id)
    
    if result['success']:
        avatar_data = {
            'url': result['url'],
            'cloudinaryId': result['cloudinaryId']
        }
        # Update members collection (if user is a member)
        firebase.update_member(member_id, {'avatar': avatar_data})
        # Update users collection (so profile page can see it)
        firebase.update_user(member_id, {'avatar': avatar_data})
    
    return jsonify(result), (200 if result['success'] else 400)

@api.route('/members/<member_id>/pay-fine', methods=['POST'])
@auth.require_auth('admin')
def pay_member_fine(member_id):
    result = firebase.pay_fine(member_id)
    return jsonify(result), (200 if result['success'] else 400)

# ===== TRANSACTIONS =====

@api.route('/transactions', methods=['GET'])
@auth.require_auth()
def get_transactions():
    filters = {}
    if request.args.get('status'):
        filters['status'] = request.args.get('status')
    
    current_user = auth.get_current_user()
    if current_user.get('role') != 'admin':
        filters['memberId'] = current_user.get('uid')
    elif request.args.get('memberId'):
        filters['memberId'] = request.args.get('memberId')
    
    transactions = firebase.get_all_transactions(filters)
    return jsonify(transactions), 200

@api.route('/transactions/issue', methods=['POST'])
@auth.require_auth('admin')
def issue_book():
    data = request.get_json()
    
    if not all(k in data for k in ['memberId', 'bookId']):
        return jsonify({'error': 'Missing fields'}), 400
    
    txn_data = {
        'id': f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
        'memberId': data['memberId'],
        'bookId': data['bookId'],
        'memberName': data.get('memberName'),
        'bookName': data.get('bookName'),
        'issuedBy': auth.get_current_user()['uid']
    }
    
    result = firebase.create_transaction(txn_data)
    return jsonify(result), (201 if result['success'] else 400)

@api.route('/transactions/<txn_id>/return', methods=['PUT'])
@auth.require_auth('admin')
def return_book(txn_id):
    data = request.get_json()
    result = firebase.return_book(txn_id, {'condition': data.get('condition', 'good')})
    return jsonify(result), (200 if result['success'] else 400)

@api.route('/transactions/<txn_id>/renew', methods=['PUT'])
@auth.require_auth()
def renew_book(txn_id):
    current_user = auth.get_current_user()
    result = firebase.renew_book(txn_id, current_user)
    if not result.get('success') and result.get('error') == 'Unauthorized':
        return jsonify(result), 403
    return jsonify(result), (200 if result['success'] else 400)

# ===== NOTIFICATIONS =====

@api.route('/notifications', methods=['GET'])
@auth.require_auth()
def get_notifications():
    current_user = auth.get_current_user()
    unread_only = request.args.get('unread') == 'true'
    
    notifications = firebase.get_user_notifications(current_user['uid'], unread_only)
    return jsonify(notifications), 200

# ===== ANALYTICS =====

@api.route('/analytics/report/<int:year>/<int:month>', methods=['GET'])
@auth.require_auth('admin')
def get_monthly_report(year, month):
    report = firebase.generate_monthly_report(year, month)
    return jsonify(report), 200

@api.route('/analytics/dashboard', methods=['GET'])
@auth.require_auth('admin')
def get_dashboard_stats():
    stats = firebase.get_dashboard_stats()
    return jsonify(stats), 200

# ===== SETTINGS =====

_cached_public_settings = None
_last_settings_fetch = 0

@api.route('/settings/public', methods=['GET'])
def get_public_settings():
    global _cached_public_settings, _last_settings_fetch
    import time
    
    # Cache for 5 minutes (300 seconds)
    if not _cached_public_settings or (time.time() - _last_settings_fetch > 300):
        settings = firebase.get_settings()
        if 'error' not in settings:
            _cached_public_settings = {'libraryName': settings.get('libraryName', 'SmartLMS')}
            _last_settings_fetch = time.time()
        else:
            return jsonify({'libraryName': 'SmartLMS'}), 200
            
    return jsonify(_cached_public_settings), 200

@api.route('/settings', methods=['GET'])
@auth.require_auth('admin')
def get_settings():
    settings = firebase.get_settings()
    if 'error' in settings:
        return jsonify(settings), 400
    return jsonify({'success': True, 'settings': settings}), 200

@api.route('/settings', methods=['POST'])
@auth.require_auth('admin')
def update_settings():
    data = request.get_json()
    result = firebase.update_settings(data)
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result), 200

# ===== HEALTH =====

@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now(timezone.utc).isoformat()}), 200