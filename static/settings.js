document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settings-form');
    const saveBtn = document.getElementById('save-btn');
    
    // Load existing settings
    try {
        const response = await apiClient.getSettings();
        if (response && response.success && response.settings) {
            const s = response.settings;
            if (s.finePerDay) document.getElementById('finePerDay').value = s.finePerDay;
            if (s.maxBorrowDays) document.getElementById('maxBorrowDays').value = s.maxBorrowDays;
            if (s.maxBooksPerMember) document.getElementById('maxBooksPerMember').value = s.maxBooksPerMember;
            if (s.libraryName) document.getElementById('libraryName').value = s.libraryName;
            if (s.supportEmail) document.getElementById('supportEmail').value = s.supportEmail;
            
            document.getElementById('require2FA').checked = s.require2FA || false;
            document.getElementById('forcePasswordReset').checked = s.forcePasswordReset || false;
            document.getElementById('notifyOverdue').checked = s.notifyOverdue !== false;
            document.getElementById('notifyWelcome').checked = s.notifyWelcome !== false;
        }
    } catch (error) {
        console.error("Failed to load settings:", error);
        showMessage("msg-box", "Could not load existing settings", "error");
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i data-lucide="loader" class="icon spin"></i> Saving...';
        saveBtn.disabled = true;
        lucide.createIcons();
        
        const settingsData = {
            finePerDay: parseInt(document.getElementById('finePerDay').value),
            maxBorrowDays: parseInt(document.getElementById('maxBorrowDays').value),
            maxBooksPerMember: parseInt(document.getElementById('maxBooksPerMember').value),
            libraryName: document.getElementById('libraryName').value,
            supportEmail: document.getElementById('supportEmail').value,
            require2FA: document.getElementById('require2FA').checked,
            forcePasswordReset: document.getElementById('forcePasswordReset').checked,
            notifyOverdue: document.getElementById('notifyOverdue').checked,
            notifyWelcome: document.getElementById('notifyWelcome').checked
        };
        
        try {
            const response = await apiClient.updateSettings(settingsData);
            if (response && response.success) {
                showMessage("msg-box", "Settings saved successfully!", "success");
                
                // Update Library Name globally
                if (settingsData.libraryName) {
                    localStorage.setItem("appLibraryName", settingsData.libraryName);
                    document.querySelectorAll('.sidebar-title').forEach(el => el.textContent = settingsData.libraryName);
                }
            } else {
                showMessage("msg-box", response.error || "Failed to save settings", "error");
            }
        } catch (error) {
            showMessage("msg-box", error.message || "An error occurred", "error");
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
            lucide.createIcons();
        }
    });
});
