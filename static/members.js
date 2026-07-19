async function getAllMembers(filters = {}) {
    try {
        return await apiClient.getAllMembers(filters);
    } catch (error) {
        console.error('Failed to load members:', error);
        showMessage("msg-box", "Failed to load members", "error");
        return [];
    }
}

async function displayAllMembers() {
    checkAuth("admin");
    
    const tableBody = document.getElementById("members-table-body");
    if (!tableBody) return;

    try {
        showMessage("msg-box", "Loading members...", "success");
        
        const members = await getAllMembers();
        
        if (members.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8">No members found</td></tr>';
            hideMessage("msg-box");
            return;
        }

        tableBody.innerHTML = '';

        const currentUser = getCurrentUser();

        for (let member of members) {
            const row = document.createElement("tr");
            const memberName = member.fullName || member.name || 'Unknown';
            const fineAmount = member.outstandingFine || 0;
            const isSelf = currentUser && currentUser.uid === member.id;
            const isAdmin = member.type === 'admin' || member.role === 'admin';
            let statusBadge = '';
            if (member.membershipStatus === 'pending_approval') {
                statusBadge = '<span class="badge warning" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">Pending</span>';
            } else if (member.membershipStatus === 'blocked') {
                statusBadge = '<span class="badge error">Blocked</span>';
            } else {
                statusBadge = '<span class="badge available">Active</span>';
            }

            let actionButtons = '';
            if (isAdmin) {
                actionButtons = '<span class="badge" style="background: var(--accent-purple); color: #fff;">Admin</span>';
            } else if (member.membershipStatus === 'pending_approval') {
                actionButtons = `
                    <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="approveMember('${APIClient.escapeHtml(member.id)}')">Approve</button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; color: var(--status-error); border-color: rgba(239, 68, 68, 0.2);" onclick="rejectMember('${APIClient.escapeHtml(member.id)}')">Revoke</button>
                `;
            } else if (member.membershipStatus !== 'blocked') {
                actionButtons = `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; color: var(--status-error); border-color: rgba(239, 68, 68, 0.2);" onclick="deleteMemberConfirm('${APIClient.escapeHtml(member.id)}')"><i data-lucide="ban" style="width: 14px;"></i></button>`;
            }

            row.innerHTML = `
                <td style="color: var(--text-secondary);">${escapeHTML(APIClient.escapeHtml(member.id))}</td>
                <td>
                    <div style="font-weight: 500; display: flex; align-items: center; gap: 8px;">
                        ${escapeHTML(APIClient.escapeHtml(memberName))} ${isSelf ? '<span class="badge" style="background: var(--accent-blue); color: #fff;">You</span>' : ''}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHTML(APIClient.escapeHtml(member.email))}</div>
                </td>
                <td style="color: var(--text-secondary);">${escapeHTML(APIClient.escapeHtml(member.phone || '-'))}</td>
                <td>${statusBadge}</td>
                <td>${escapeHTML(member.currentlyBorrowed || 0)}</td>
                <td style="color: ${fineAmount > 0 ? 'var(--status-error)' : 'var(--status-success)'}; font-weight: 500;">₹${escapeHTML(fineAmount)}</td>
                <td style="display: flex; gap: 8px; align-items: center;">
                    ${fineAmount > 0 ? `<button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="payMemberFine('${APIClient.escapeHtml(member.id)}')">Clear</button>` : ''}
                    ${actionButtons}
                </td>
            `;
            tableBody.appendChild(row);
        }
        
        // Re-init icons
        if(typeof lucide !== 'undefined') lucide.createIcons();

        hideMessage("msg-box");
    } catch (error) {
        showMessage("msg-box", "Error loading members", "error");
    }
}

async function handleAddMember(event) {
    event.preventDefault();

    const memberId = document.getElementById("member-id").value.trim();
    const name = document.getElementById("member-name").value.trim();
    const email = document.getElementById("member-email").value.trim();
    const phone = document.getElementById("member-phone").value.trim();
    const type = document.getElementById("member-type").value;
    const department = document.getElementById("department").value.trim();
    const semester = document.getElementById("semester").value;
    const rollNumber = document.getElementById("roll-number").value.trim();
    const joinDate = document.getElementById("join-date").value;

    if (!memberId || !name || !email || !phone || !type || !joinDate) {
        showMessage("msg-box", "All required fields must be filled", "error");
        return;
    }

    try {
        showMessage("msg-box", "Adding member...", "success");

        const response = await apiClient.addMember({
            id: memberId,
            name: name,
            email: email,
            phone: phone,
            type: type,
            joinDate: joinDate,
            membershipStatus: "active",
            metadata: {
                department: department,
                semester: parseInt(semester) || null,
                rollNumber: rollNumber
            }
        });

        if (response.success) {
            showMessage("msg-box", "Member added!", "success");
            document.getElementById("add-member-form").reset();
            setTimeout(() => {
                window.location.href = "/viewmember";
            }, 1500);
        } else {
            showMessage("msg-box", response.error || "Failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

async function deleteMemberConfirm(memberId) {
    if (!confirm("Block this member? They will no longer be able to log in, but their record will be kept.")) {
        return;
    }

    try {
        showMessage("msg-box", "Blocking...", "success");

        const response = await apiClient.deleteMember(memberId);

        if (response.success) {
            showMessage("msg-box", "Member blocked successfully!", "success");
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showMessage("msg-box", response.error || "Delete failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message, "error");
    }
}

async function payMemberFine(memberId) {
    if (!confirm('Clear all fine for this member?')) return;
    try {
        showMessage('msg-box', 'Clearing fine...', 'success');
        const response = await apiClient.payMemberFine(memberId);
        if (response.success) {
            showMessage('msg-box', `Fine of ₹${response.paidAmount} cleared!`, 'success');
            displayAllMembers();
        } else {
            showMessage('msg-box', response.error || 'Failed to clear fine', 'error');
        }
    } catch (error) {
        showMessage('msg-box', error.message, 'error');
    }
}

// Export members to CSV
function exportMembersCSV() {
    showMessage('msg-box', 'Preparing CSV download...', 'success');
    
    // We already have all members loaded in the 'members' array from loadMembers() if it's global,
    // wait, the 'members' array is not global. Let's just fetch it again.
    
    apiClient.getAllMembers().then(data => {
        if (!data || !data.members) return;
        
        const headers = ['Member ID', 'Full Name', 'Email', 'Phone', 'Type', 'Status', 'Books Issued', 'Outstanding Fine (Rs)'];
        const rows = data.members.map(m => [
            m.id,
            m.fullName || m.name || 'Unknown',
            m.email || 'N/A',
            m.phone || 'N/A',
            m.type || m.role || 'student',
            m.membershipStatus || 'active',
            m.currentlyBorrowed || 0,
            m.outstandingFine || 0
        ]);
        
        const dateStr = new Date().toISOString().split('T')[0];
        exportToCSV(headers, rows, `LMS_Members_${dateStr}.csv`);
    }).catch(err => {
        showMessage('msg-box', 'Error exporting members', 'error');
        console.error(err);
    });
}

// Admin Approval Actions
async function approveMember(memberId) {
    if (!confirm('Are you sure you want to approve this member?')) return;
    
    try {
        const response = await apiClient.updateMember(memberId, { membershipStatus: 'active' });
        if (response && response.success) {
            showMessage('msg-box', 'Member approved successfully!', 'success');
            displayAllMembers();
        } else {
            showMessage('msg-box', response.error || 'Failed to approve member', 'error');
        }
    } catch (error) {
        showMessage('msg-box', error.message, 'error');
    }
}

async function rejectMember(memberId) {
    if (!confirm('Are you sure you want to reject and revoke this member?')) return;
    
    try {
        // deleteMember does a soft delete (block) in backend
        const response = await apiClient.deleteMember(memberId);
        if (response && response.success) {
            showMessage('msg-box', 'Member request revoked successfully.', 'success');
            displayAllMembers();
        } else {
            showMessage('msg-box', response.error || 'Failed to revoke member', 'error');
        }
    } catch (error) {
        showMessage('msg-box', error.message, 'error');
    }
}
