# 📚 Smart Library Management System (LMS)

A comprehensive, modern, and full-stack Library Management System built with **Python (Flask)**, **Firebase**, and **Vanilla JavaScript**. It features a stunning glassmorphism UI with seamless dark and light modes, providing a premium experience for both Administrators (Librarians) and Students.

---

## ✨ Key Features

### 👑 For Administrators (Librarian)
- **Dashboard & Analytics:** Real-time metrics, dynamic donut and bar charts tracking book issuance and inventory capacity.
- **Inventory Management:** Add, edit, and delete books. Manage book stock and upload cover images directly to Cloudinary.
- **Member Directory:** Register new students, view active/blocked members, and access their complete transaction history.
- **Transaction Handling:** Issue books, handle returns, assess book conditions, and automatically calculate overdue fines.
- **Global Settings:** Update library name, configure fine rates, and manage system preferences that reflect instantly across the app.

### 🎓 For Students (Members)
- **Student Dashboard:** Track currently borrowed books, outstanding fines, and library notifications.
- **Digital ID Card:** Unique generated barcode ID with cloud-hosted avatar profiles.
- **Catalog Search:** Browse the entire library catalog with real-time stock availability.
- **Book Renewal:** Extend due dates with a single click (within limits).
- **Secure Authentication:** Verified email sign-ups, password resets, and robust session management.

### 🛡️ System Security & Automations
- **Anti-XSS Protection:** Comprehensive sanitization of all user-generated content.
- **Rate Limiting:** In-memory brute-force protection on authentication routes.
- **Automated Cron Jobs:** Background scripts that run daily to calculate late fines and send automated reminder emails to students.

---

## 🛠️ Technology Stack

- **Backend:** Python 3, Flask, Werkzeug, JWT (Jose)
- **Database:** Firebase Firestore (Admin SDK), Firebase Authentication
- **Frontend:** HTML5, CSS3 (Custom Variables, Glassmorphism), Vanilla JavaScript
- **Cloud Storage:** Cloudinary (for book covers and user avatars)
- **Email Service:** SMTP (Gmail)
- **Deployment Ready:** Configured with Gunicorn for platforms like Render.

---

## 🚀 How to Run Locally

### 1. Prerequisites
Ensure you have **Python 3.9+** installed on your machine.

### 2. Clone the Repository
```bash
git clone https://github.com/Amit0119/LMS.git
cd LMS
```

### 3. Install Dependencies
Create a virtual environment and install the required packages:
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Environment Variables
Create a `.env` file in the root directory and add the following keys:
```env
FLASK_ENV=development
SECRET_KEY=your_super_secret_key_here
FIREBASE_CONFIG_PATH=./firebase_key.json
FIREBASE_DATABASE_URL=https://your-firebase-url.firebaseio.com
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
ADMIN_REGISTRATION_SECRET=secret_code_to_create_admin
```

### 5. Firebase Setup
Add your Firebase Admin SDK JSON file to the root directory and name it `firebase_key.json`.

### 6. Run the Application
```bash
python app.py
```
The application will start at `http://127.0.0.1:5000/`.

---

## 📅 Background Tasks
To run the automated fine calculation and email reminder script, execute:
```bash
python cron_jobs.py
```
*(In production, set this script to run daily via a Cron Job service).*

---

*Designed & Developed with ❤️*
