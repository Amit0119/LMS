from flask import Flask, render_template
from api import api
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

app.register_blueprint(api)

# ===== PAGES =====

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/register')
def register():
    return render_template('register.html')

@app.route('/admin-dashboard')
def admin_dashboard():
    return render_template('index.html')

@app.route('/student-dashboard')
def student_dashboard():
    return render_template('student-dashboard.html')

@app.route('/student-catalog')
def student_catalog():
    return render_template('student-catalog.html')

@app.route('/student-borrowed')
def student_borrowed():
    return render_template('student-borrowed.html')

@app.route('/addbook')
def addbook():
    return render_template('addbook.html')

@app.route('/viewbook')
def viewbook():
    return render_template('viewbook.html')

@app.route('/addmember')
def addmember():
    return render_template('addmember.html')

@app.route('/viewmember')
def viewmember():
    return render_template('viewmember.html')

@app.route('/issuebook')
def issuebook():
    return render_template('issuebook.html')

@app.route('/returnbook')
def returnbook():
    return render_template('returnbook.html')

@app.route('/all-transactions')
def all_transactions():
    return render_template('all-transactions.html')

@app.route('/pay-fines')
def pay_fines():
    return render_template('pay-fines.html')

@app.route('/searchbook')
def searchbook():
    return render_template('searchbook.html')

@app.route('/deletebook')
def deletebook():
    return render_template('deletebook.html')

@app.route('/forgot-password')
def forgot_password():
    return render_template('forgot-password.html')

@app.route('/reset-password')
def reset_password():
    return render_template('reset-password.html')

@app.route('/analytics')
def analytics():
    return render_template('analytics.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/profile')
def profile():
    return render_template('profile.html')

# ===== ERROR HANDLERS =====

@app.errorhandler(404)
def not_found(error):
    return '<div style="text-align:center;padding:60px;font-family:sans-serif;background:#0b0f1a;color:#fff;min-height:100vh;"><h1 style="font-size:72px;margin-bottom:10px;">404</h1><p style="color:#8b8fa3;">Page not found</p><a href="/" style="color:#6388ff;text-decoration:none;">← Back to Home</a></div>', 404

@app.errorhandler(500)
def server_error(error):
    return '<div style="text-align:center;padding:60px;font-family:sans-serif;background:#0b0f1a;color:#fff;min-height:100vh;"><h1 style="font-size:72px;margin-bottom:10px;">500</h1><p style="color:#8b8fa3;">Server error — please try again</p><a href="/" style="color:#6388ff;text-decoration:none;">← Back to Home</a></div>', 500

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_ENV') == 'development')# triggered reload
# triggered reload for soft delete
# Trigger reload for limits update
# Trigger restart for Cloudinary keys
