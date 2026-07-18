import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

ALLOWED = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED

class CloudinaryService:
    
    @staticmethod
    def upload_book_cover(file, book_id):
        try:
            if not allowed_file(file.filename):
                return {'success': False, 'error': 'Invalid file type'}
            
            filename = secure_filename(f"{book_id}_cover")
            
            result = cloudinary.uploader.upload(
                file,
                folder='lms/books',
                public_id=filename,
                eager=[
                    {'width': 300, 'height': 450, 'crop': 'fill'},
                    {'width': 600, 'height': 900, 'crop': 'fill'},
                ]
            )
            
            return {
                'success': True,
                'url': result['secure_url'],
                'cloudinaryId': result['public_id'],
                'sizes': {
                    'thumbnail': result['eager'][0]['secure_url'],
                    'full': result['eager'][1]['secure_url']
                }
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def upload_member_avatar(file, member_id):
        try:
            if not allowed_file(file.filename):
                return {'success': False, 'error': 'Invalid file type'}
            
            filename = secure_filename(f"{member_id}_avatar")
            
            result = cloudinary.uploader.upload(
                file,
                folder='lms/members',
                public_id=filename,
                eager=[
                    {'width': 150, 'height': 150, 'crop': 'thumb', 'gravity': 'face'},
                    {'width': 300, 'height': 300, 'crop': 'thumb', 'gravity': 'face'}
                ]
            )
            
            return {
                'success': True,
                'url': result['secure_url'],
                'cloudinaryId': result['public_id'],
                'sizes': {
                    'small': result['eager'][0]['secure_url'],
                    'medium': result['eager'][1]['secure_url']
                }
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def delete_image(cloudinary_id):
        try:
            cloudinary.uploader.destroy(cloudinary_id)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}