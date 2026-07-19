// ============================================
// FILE: utils.js
// PURPOSE: Yeh file sabka base hai — Database helpers, Date helpers, Message display
// NOTE: Yeh file sabse pehle load honi chahiye har HTML page mein
// ============================================

// --- THEME INITIALIZATION ---
// Runs immediately to prevent flickering
;(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
    }
})();


// ============================================
// SECTION 1: DATABASE HELPERS (localStorage)
// ============================================
// Hum browser ke localStorage ko apna "database" ki tarah use kar rahe hain.
// localStorage mein data STRING format mein store hota hai,
// isliye hum JSON.parse (string → object) aur JSON.stringify (object → string) use karte hain.

// ---------- BOOKS ----------

// Saari books ka array return karta hai
function getAllBooks() {
    var data = localStorage.getItem("lms_books");
    if (data === null) {
        return []; // Agar koi book nahi hai toh empty array return karo
    }
    return JSON.parse(data);
}

// Books ka updated array save karta hai
function saveAllBooks(booksArray) {
    localStorage.setItem("lms_books", JSON.stringify(booksArray));
}

// ---------- MEMBERS ----------

// Saare members ka array return karta hai
function getAllMembers() {
    var data = localStorage.getItem("lms_members");
    if (data === null) {
        return [];
    }
    return JSON.parse(data);
}

// Members ka updated array save karta hai
function saveAllMembers(membersArray) {
    localStorage.setItem("lms_members", JSON.stringify(membersArray));
}

// ---------- TRANSACTIONS (Issue/Return Records) ----------

// Saari transactions ka array return karta hai
function getAllTransactions() {
    var data = localStorage.getItem("lms_transactions");
    if (data === null) {
        return [];
    }
    return JSON.parse(data);
}

// Transactions ka updated array save karta hai
function saveAllTransactions(transactionsArray) {
    localStorage.setItem("lms_transactions", JSON.stringify(transactionsArray));
}

// ---------- USERS (Login Accounts) ----------

// Saare registered users (login accounts) ka array return karta hai
function getAllUsers() {
    var data = localStorage.getItem("lms_users");
    if (data === null) {
        return [];
    }
    return JSON.parse(data);
}

// Users ka updated array save karta hai
function saveAllUsers(usersArray) {
    localStorage.setItem("lms_users", JSON.stringify(usersArray));
}


// ============================================
// SECTION 2: DATE HELPERS
// ============================================

// Date ko "06-Jul-2026" format mein convert karta hai (readable format)
function formatDate(dateString) {
    var date = new Date(dateString);
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var day = date.getDate();
    if (day < 10) day = "0" + day; // Single digit ke aage 0 lagao (e.g., 6 → 06)
    var month = months[date.getMonth()];
    var year = date.getFullYear();
    return day + "-" + month + "-" + year; // e.g., "06-Jul-2026"
}

// Do dates ke beech kitne din ka farak hai, woh return karta hai
// Positive = future mein hai (time baaki), Negative = past mein hai (late ho gaya)
function daysBetween(date1, date2) {
    var d1 = new Date(date1);
    var d2 = new Date(date2);
    var difference = d2.getTime() - d1.getTime(); // Milliseconds mein difference
    var days = Math.ceil(difference / (1000 * 60 * 60 * 24)); // Milliseconds → Days
    return days;
}

// Fine calculate karta hai — ₹5 per day agar book late return hui
function calculateFine(dueDate, returnDate) {
    var daysLate = daysBetween(dueDate, returnDate); // Due date se return date tak kitne din
    if (daysLate > 0) {
        return daysLate * 5; // ₹5 per day fine
    }
    return 0; // Agar time pe return kiya toh 0 fine
}


// ============================================
// SECTION 3: MESSAGE HELPER
// ============================================
// Yeh function kisi bhi page par success (green) ya error (red) message dikhata hai
// Har form ke andar ek <div id="msg-box"> hona chahiye jahan yeh message show hoga

function showMessage(elementId, message, type) {
    var msgBox = document.getElementById(elementId);
    if (msgBox === null) return; // Agar element nahi mila toh kuch mat karo

    msgBox.textContent = message;

    if (type === "error") {
        msgBox.className = "msg-error";
    } else if (type === "success") {
        msgBox.className = "msg-success";
    }
}

// Message box ko hide karne ke liye
function hideMessage(elementId) {
    var msgBox = document.getElementById(elementId);
    if (msgBox === null) return;
    msgBox.className = "";
    msgBox.style.display = "none";
}


// ============================================
// SECTION 4: SAMPLE DATA LOADER
// ============================================
// Jab pehli baar website khule aur koi data na ho, toh kuch sample data daal do
// Taki dashboard aur tables empty na dikhen

function loadSampleData() {
    // Agar pehle se data hai toh kuch mat karo
    if (getAllBooks().length > 0) return;

    // Sample Books
    var sampleBooks = [
        { id: "B001", name: "Python Programming", author: "Guido van Rossum", category: "technology", totalCopies: 5, availableCopies: 3, pubYear: 2022 },
        { id: "B002", name: "Data Structures", author: "Mark Allen Weiss", category: "technology", totalCopies: 4, availableCopies: 0, pubYear: 2020 },
        { id: "B003", name: "Web Development", author: "Jon Duckett", category: "technology", totalCopies: 3, availableCopies: 2, pubYear: 2021 },
        { id: "B004", name: "Database Management", author: "Ramez Elmasri", category: "technology", totalCopies: 6, availableCopies: 4, pubYear: 2019 },
        { id: "B005", name: "Operating Systems", author: "Abraham Silberschatz", category: "technology", totalCopies: 5, availableCopies: 5, pubYear: 2018 }
    ];

    // Sample Members
    var sampleMembers = [
        { id: "M001", name: "Rahul Sharma", phone: "9876543210", email: "rahul@email.com", type: "student", joinDate: "2026-01-01" },
        { id: "M002", name: "Priya Singh", phone: "9812345678", email: "priya@email.com", type: "student", joinDate: "2026-02-15" },
        { id: "M003", name: "Amit Kumar", phone: "9898989898", email: "amit@email.com", type: "teacher", joinDate: "2026-03-10" },
        { id: "M004", name: "Sneha Patel", phone: "9765432100", email: "sneha@email.com", type: "student", joinDate: "2026-04-20" },
        { id: "M005", name: "Vikram Yadav", phone: "9654321009", email: "vikram@email.com", type: "staff", joinDate: "2026-05-05" }
    ];

    // Sample Transactions
    var sampleTransactions = [
        { memberId: "M001", memberName: "Rahul Sharma", bookId: "B005", bookName: "Python Programming", issueDate: "2026-07-01", dueDate: "2026-07-15", returnDate: null, fine: 0, status: "Issued" },
        { memberId: "M002", memberName: "Priya Singh", bookId: "B012", bookName: "Data Structures", issueDate: "2026-06-28", dueDate: "2026-07-12", returnDate: null, fine: 0, status: "Issued" },
        { memberId: "M003", memberName: "Amit Kumar", bookId: "B023", bookName: "Web Development", issueDate: "2026-07-03", dueDate: "2026-07-17", returnDate: null, fine: 0, status: "Issued" },
        { memberId: "M004", memberName: "Sneha Patel", bookId: "B031", bookName: "Database Management", issueDate: "2026-06-25", dueDate: "2026-07-09", returnDate: "2026-07-08", fine: 0, status: "Returned" },
        { memberId: "M005", memberName: "Vikram Yadav", bookId: "B044", bookName: "Operating Systems", issueDate: "2026-07-04", dueDate: "2026-07-18", returnDate: null, fine: 0, status: "Issued" }
    ];

    saveAllBooks(sampleBooks);
    saveAllMembers(sampleMembers);
    saveAllTransactions(sampleTransactions);
}

// NOTE: loadSampleData() removed — project uses Firebase API backend, not localStorage.
// To manually load sample data for testing, call loadSampleData() from the console.

// CSV Export Utility
function exportToCSV(headers, rows, filename) {
    let csvContent = '';
    
    // Add headers
    csvContent += headers.join(',') + '\r\n';
    
    // Add rows
    rows.forEach(row => {
        let rowData = row.map(cell => {
            let cellStr = String(cell || '').replace(/"/g, '""');
            if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
                return `"${cellStr}"`;
            }
            return cellStr;
        });
        csvContent += rowData.join(',') + '\r\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- SECURITY UTILITIES ---
function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- RESPONSIVE SIDEBAR (MOBILE) ---
document.addEventListener("DOMContentLoaded", function() {
    const topNav = document.querySelector('.top-nav');
    const sidebar = document.querySelector('.sidebar');
    
    if (topNav && sidebar) {
        // Inject hamburger button
        const btn = document.createElement('button');
        btn.className = 'mobile-menu-btn';
        btn.innerHTML = '<i data-lucide="menu"></i>';
        
        // Find page title to insert button before it
        const pageTitle = topNav.querySelector('.page-title');
        if (pageTitle) {
            topNav.insertBefore(btn, pageTitle);
        } else {
            topNav.insertBefore(btn, topNav.firstChild);
        }
        
        // Re-initialize lucide icons for the new button
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
        
        // Toggle sidebar
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // prevent document click from firing immediately
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('mobile-open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-open')) {
                if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
    }
});
