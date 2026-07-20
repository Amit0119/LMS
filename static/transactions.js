async function displayAllTransactions() {
    checkAuth("admin");
    
    const tableBody = document.getElementById("transactions-table-body");
    if (!tableBody) return;

    try {
        showMessage("msg-box", "Loading transactions...", "success");
        
        const transactions = await apiClient.getAllTransactions();
        
        if (transactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">No transactions found</td></tr>';
            hideMessage("msg-box");
            return;
        }

        tableBody.innerHTML = '';

        for (let txn of transactions) {
            const isOverdue = txn.status === 'issued' && APIClient.daysBetween(new Date().toISOString(), txn.dueDate) < 0;
            const statusClass = txn.status === 'returned' ? 'returned' : (isOverdue ? 'overdue' : 'issued');
            const statusText = txn.status === 'returned' ? 'Returned' : (isOverdue ? 'Overdue' : 'Issued');

            const row = document.createElement("tr");
            row.innerHTML = `
                <td style="color: var(--text-secondary);">${escapeHTML(txn.id ? APIClient.escapeHtml(txn.id) : 'TXN-00')}</td>
                <td>
                    <div style="font-weight: 500;">${escapeHTML(APIClient.escapeHtml(txn.memberName))}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHTML(APIClient.escapeHtml(txn.bookName))}</div>
                </td>
                <td>${escapeHTML(APIClient.formatDate(txn.issueDate))}</td>
                <td>${escapeHTML(APIClient.formatDate(txn.dueDate))}</td>
                <td style="color: var(--text-secondary);">${escapeHTML(txn.returnDate ? APIClient.formatDate(txn.returnDate) : '-')}</td>
                <td style="color: ${txn.fine > 0 ? 'var(--status-error)' : 'var(--text-primary)'}; font-weight: 500;">₹${escapeHTML(txn.fine || 0)}</td>
                <td><span class="badge ${escapeHTML(statusClass)}">${escapeHTML(statusText)}</span></td>
            `;
            tableBody.appendChild(row);
        }

        hideMessage("msg-box");
    } catch (error) {
        showMessage("msg-box", "Error loading transactions", "error");
    }
}

async function handleIssueBook(event) {
    event.preventDefault();

    const memberId = document.getElementById("member-id").value.trim();
    const memberName = document.getElementById("member-name").value.trim();
    const bookId = document.getElementById("book-id").value.trim();
    const bookName = document.getElementById("book-name").value.trim();

    if (!memberId || !bookId || !memberName || !bookName) {
        showMessage("msg-box", "All fields required", "error");
        return;
    }

    try {
        showMessage("msg-box", "Issuing book...", "success");

        const response = await apiClient.issueBook({
            memberId: memberId,
            bookId: bookId,
            memberName: memberName,
            bookName: bookName
        });

        if (response.success) {
            showMessage("msg-box", "Book issued!", "success");
            document.getElementById("issue-book-form").reset();
            setTimeout(() => {
                window.location.href = "/all-transactions";
            }, 1500);
        } else {
            showMessage("msg-box", response.error || "Failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

async function handleReturnBook(event) {
    event.preventDefault();

    const txnSelect = document.getElementById("transaction-select");
    const condition = document.getElementById("condition").value;
    
    const txnId = txnSelect.value;

    if (!txnId) {
        showMessage("msg-box", "Select transaction", "error");
        return;
    }

    try {
        showMessage("msg-box", "Returning book...", "success");

        const response = await apiClient.returnBook(txnId, {
            condition: condition
        });

        if (response.success) {
            showMessage("msg-box", `Book returned! Fine: ₹${response.fine}`, "success");
            document.getElementById("return-book-form").reset();
            setTimeout(() => {
                window.location.href = "/all-transactions";
            }, 1500);
        } else {
            showMessage("msg-box", response.error || "Failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}