
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv
import bcrypt
from functools import wraps
from flask import request, jsonify
import re

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-min-50-chars')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_HOURS = 2

class AuthService:
    
    @staticmethod
    def hash_password(password: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        except Exception:
            return False

    @staticmethod
    def generate_token(email: str, role: str, uid: str) -> str:
        payload = {
            'email': email,
            'role': role,
            'uid': uid,
            'exp': datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
            'iat': datetime.now(timezone.utc)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def verify_token(token: str):
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            return None

    @staticmethod
    def get_token_from_request(headers):
        auth_header = headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        return auth_header.split(' ')[1]

    @staticmethod
    def require_auth(required_role=None):
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                token = AuthService.get_token_from_request(request.headers)
                
                if not token:
                    return jsonify({'error': 'Missing token'}), 401
                
                payload = AuthService.verify_token(token)
                if not payload:
                    return jsonify({'error': 'Invalid token'}), 401
                
                if required_role and payload.get('role') != required_role:
                    return jsonify({'error': f'Role {required_role} required'}), 403
                
                request.current_user = payload
                return f(*args, **kwargs)
            
            return decorated_function
        return decorator

    @staticmethod
    def get_current_user():
        return getattr(request, 'current_user', None)

    @staticmethod
    def is_strong_password(password: str) -> tuple:
        if len(password) < 8:
            return False, "Min 8 chars"
        if not re.search(r'[A-Z]', password):
            return False, "Need uppercase"
        if not re.search(r'[a-z]', password):
            return False, "Need lowercase"
        if not re.search(r'\d', password):
            return False, "Need digit"
        if not re.search(r'[@$!%*?&]', password):
            return False, "Need special char"
        return True, "Strong"

    @staticmethod
    def is_valid_email(email: str) -> bool:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None