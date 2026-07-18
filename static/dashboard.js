async function loadStudentDashboard() {
    checkAuth("student");
    
    const user = getCurrentUser();
    if (!user) {
        window.location.href = "/login";
        return;
    }

    try {
        const welcomeEl = document.getElementById("welcome-name");
        if (welcomeEl) {
            welcomeEl.textContent = user.fullName || user.email;
        }

        await loadBorrowedBooks();
        await loadNotifications();
        await loadOutstandingFines();

    } catch (error) {
        console.error('Dashboard error:', error);
        showMessage("msg-box", "Failed to load dashboard", "error");
    }
}

async function loadBorrowedBooks() {
    const container = document.getElementById("borrowed-books-container");
    if (!container) return;

    try {
        const transactions = await apiClient.getAllTransactions({
            status: 'issued'
        });

        if (transactions.length === 0) {
            container.innerHTML = '<p>No borrowed books</p>';
            return;
        }

        container.innerHTML = '';

        transactions.forEach(txn => {
            const daysRemaining = APIClient.daysBetween(new Date().toISOString(), txn.dueDate);
            const dueClass = daysRemaining < 3 ? 'due-soon' : 'normal';

            const bookCard = document.createElement("div");
            bookCard.className = `book-transaction ${dueClass}`;
            bookCard.innerHTML = `
                <div class="transaction-info">
                    <h4>${escapeHTML(APIClient.escapeHtml(txn.bookName))}</h4>
                    <p><strong>Issue:</strong> ${escapeHTML(APIClient.formatDate(txn.issueDate))}</p>
                    <p><strong>Due:</strong> ${escapeHTML(APIClient.formatDate(txn.dueDate))}</p>
                    <p><strong>Days Left:</strong> <span class="days-count">${escapeHTML(daysRemaining)}</span></p>
                </div>
                <div class="transaction-actions">
                    <button onclick="renewBookAction('${escapeHTML(APIClient.escapeHtml(txn.id))}')">Renew</button>
                    <button onclick="returnBookAction('${escapeHTML(APIClient.escapeHtml(txn.id))}')">Return</button>
                </div>
            `;
            container.appendChild(bookCard);
        });

    } catch (error) {
        console.error('Error loading borrowed books:', error);
        container.innerHTML = '<p>Error loading books</p>';
    }
}

async function renewBookAction(transactionId) {
    try {
        const response = await apiClient.renewBook(transactionId);
        if (response.success) {
            showMessage("msg-box", `Renewed! New due: ${APIClient.formatDate(response.newDueDate)}`, "success");
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            showMessage("msg-box", response.error || "Renewal failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

async function returnBookAction(transactionId) {
    try {
        const response = await apiClient.returnBook(transactionId, {
            condition: 'good'
        });
        if (response.success) {
            showMessage("msg-box", `Returned! Fine: ₹${response.fine}`, "success");
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            showMessage("msg-box", response.error || "Return failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

async function loadNotifications() {
    const container = document.getElementById("notifications-container");
    if (!container) return;

    try {
        const notifications = await apiClient.getNotifications();

        if (notifications.length === 0) {
            container.innerHTML = '<p>No notifications</p>';
            return;
        }

        container.innerHTML = '';

        notifications.forEach(notif => {
            const notifEl = document.createElement("div");
            notifEl.className = `notification notification-${APIClient.escapeHtml(notif.type)}`;
            notifEl.innerHTML = `
                <h5>${escapeHTML(APIClient.escapeHtml(notif.title))}</h5>
                <p>${escapeHTML(APIClient.escapeHtml(notif.message))}</p>
                <small>${escapeHTML(APIClient.formatDate(notif.createdAt))}</small>
            `;
            container.appendChild(notifEl);
        });

    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function loadOutstandingFines() {
    const container = document.getElementById("fines-container");
    if (!container) return;

    try {
        const transactions = await apiClient.getAllTransactions({
            status: 'returned'
        });

        const totalFine = transactions.reduce((sum, t) => sum + (t.fine || 0), 0);

        if (totalFine === 0) {
            container.innerHTML = '<p>No outstanding fines</p>';
            return;
        }

        container.innerHTML = `
            <div class="fine-summary">
                <h4>Outstanding Fines</h4>
                <p class="fine-amount">₹${escapeHTML(totalFine)}</p>
                <button onclick="window.location.href='/pay-fines'">Pay Now</button>
            </div>
        `;

    } catch (error) {
        console.error('Error loading fines:', error);
    }
}

async function loadAdminDashboard() {
    checkAuth("admin");

    try {
        const stats = await apiClient.getDashboardStats();
        
        if (stats.error) {
            showMessage("msg-box", "Failed to load stats", "error");
            return;
        }

        if (document.getElementById("total-books")) document.getElementById("total-books").textContent = stats.totalBooks;
        if (document.getElementById("total-members")) document.getElementById("total-members").textContent = stats.totalMembers;
        if (document.getElementById("active-txns")) document.getElementById("active-txns").textContent = stats.activeTransactions;
        if (document.getElementById("overdue-books")) document.getElementById("overdue-books").textContent = stats.overdueBooks;
        if (document.getElementById("pending-fines")) document.getElementById("pending-fines").textContent = "₹" + stats.totalFinesPending;

        // Update Live Inventory Capacity
        if (stats.inventory) {
            const availEl = document.getElementById("cap-avail");
            const issuedEl = document.getElementById("cap-issued");
            const resvEl = document.getElementById("cap-resv");
            const circleEl = document.getElementById("inventory-circle");
            const percentEl = document.getElementById("inventory-percent");

            if (availEl) availEl.textContent = stats.inventory.available;
            if (issuedEl) issuedEl.textContent = stats.inventory.issued;
            if (resvEl) resvEl.textContent = stats.inventory.reserved;

            let percentage = 0;
            if (stats.totalBooks > 0) {
                percentage = Math.round((stats.inventory.available / stats.totalBooks) * 100);
            }
            
            if (percentEl) percentEl.textContent = percentage + "%";
            if (circleEl) {
                circleEl.setAttribute("stroke-dasharray", `${percentage}, 100`);
            }
        }

    } catch (error) {
        console.error('Dashboard error:', error);
        showMessage("msg-box", "Failed to load dashboard", "error");
    }
}

async function loadRecentTransactions() {
    try {
        const transactions = await apiClient.getAllTransactions();

        const tableBody = document.querySelector('#transactions tbody');
        if (!tableBody) return;

        // Show only last 5 transactions
        const recent = transactions.slice(0, 5);

        if (recent.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8">No transactions yet</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        recent.forEach((txn, i) => {
            const isOverdue = txn.status === 'issued' && APIClient.daysBetween(new Date().toISOString(), txn.dueDate) < 0;
            const statusClass = txn.status === 'returned' ? 'returned' : (isOverdue ? 'overdue' : 'issued');
            const statusText = txn.status === 'returned' ? 'Returned' : (isOverdue ? 'Overdue' : 'Issued');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="color: var(--text-secondary);">${escapeHTML(txn.id ? APIClient.escapeHtml(txn.id).substring(0,8) : 'TXN-00')}</td>
                <td>${escapeHTML(APIClient.escapeHtml(txn.memberName))}</td>
                <td>${escapeHTML(APIClient.escapeHtml(txn.bookName))}</td>
                <td>${escapeHTML(APIClient.formatDate(txn.issueDate))}</td>
                <td>${escapeHTML(APIClient.formatDate(txn.dueDate))}</td>
                <td><span class="badge ${escapeHTML(statusClass)}">${escapeHTML(statusText)}</span></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function loadStudentHistory() {
    try {
        const user = getCurrentUser();
        if (!user) return;

        const transactions = await apiClient.getAllTransactions({ memberId: user.email });

        // Try both old and new selectors
        let tableBody = document.getElementById('student-recent-history-body') || document.querySelector('#transactions tbody');
        if (!tableBody) return;

        if (transactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 30px;">No borrowing history found</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        transactions.forEach(txn => {
            const isOverdue = txn.status === 'issued' && APIClient.daysBetween(new Date().toISOString(), txn.dueDate) < 0;
            const statusClass = txn.status === 'returned' ? 'returned' : (isOverdue ? 'overdue' : 'issued');
            const statusText = txn.status === 'returned' ? 'Returned' : (isOverdue ? 'Overdue' : 'Issued');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="font-weight: 500;">${escapeHTML(APIClient.escapeHtml(txn.bookName))}</div>
                </td>
                <td style="color: var(--text-secondary);">${escapeHTML(APIClient.escapeHtml(txn.bookId))}</td>
                <td>${escapeHTML(APIClient.formatDate(txn.issueDate))}</td>
                <td style="color: var(--text-secondary);">${escapeHTML(APIClient.formatDate(txn.dueDate))}</td>
                <td><span class="badge ${escapeHTML(statusClass)}">${escapeHTML(statusText)}</span></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading student history:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (user && user.role === 'student') {
        loadStudentDashboard();
    } else if (user && user.role === 'admin') {
        loadAdminDashboard();
        loadRecentTransactions();
        loadNotifications();

        const searchInput = document.getElementById("dashboard-search");
        if (searchInput) {
            searchInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    const val = searchInput.value.trim().toLowerCase();
                    if (!val) return;
                    
                    // If it looks like a member ID (m001, m123) or user explicitly searches members
                    if (val.startsWith("m") && /\d/.test(val)) {
                        window.location.href = `/viewmember?q=${encodeURIComponent(val)}`;
                    } else {
                        // Otherwise redirect to search book page
                        window.location.href = `/searchbook?q=${encodeURIComponent(val)}`;
                    }
                }
            });
        }
    }
});

// Export transactions to CSV
function exportTransactionsCSV() {
    showMessage('msg-box', 'Preparing CSV download...', 'success');
    
    apiClient.getAllTransactions().then(txns => {
        if (!txns) return;
        
        const headers = ['Transaction ID', 'Member ID', 'Member Name', 'Book ID', 'Book Name', 'Status', 'Issue Date', 'Due Date', 'Return Date', 'Fine (Rs)', 'Renewals'];
        const rows = txns.map(t => [
            t.id,
            t.memberId,
            t.memberName || 'Unknown',
            t.bookId,
            t.bookName || 'Unknown',
            t.status,
            t.issueDate ? new Date(t.issueDate).toLocaleDateString() : '',
            t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
            t.returnDate ? new Date(t.returnDate).toLocaleDateString() : 'Not Returned',
            t.fine || 0,
            t.renewalCount || 0
        ]);
        
        const dateStr = new Date().toISOString().split('T')[0];
        exportToCSV(headers, rows, `LMS_Transactions_${dateStr}.csv`);
    }).catch(err => {
        showMessage('msg-box', 'Error exporting transactions', 'error');
        console.error(err);
    });
}
