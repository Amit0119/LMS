document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    await loadProfileData();

    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    document.getElementById('theme-toggle').addEventListener('change', handleThemeToggle);
    
    // Avatar upload listeners
    document.getElementById('id-avatar').addEventListener('click', () => {
        document.getElementById('avatar-upload').click();
    });
    document.getElementById('avatar-upload').addEventListener('change', handleAvatarUpload);
    
    // Check local storage for theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.getElementById('theme-toggle').checked = false;
        // In future, you can apply .light-theme to body here
    }
});

async function loadProfileData() {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('current_user');
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            showMessage("msg-box", "Failed to load profile data", "error");
            return;
        }

        const data = await response.json();
        const profile = data.profile;
        const stats = data.stats;

        // Populate Form
        document.getElementById('edit-email').value = profile.email || '';
        document.getElementById('edit-name').value = profile.fullName || '';
        document.getElementById('edit-phone').value = profile.phone || '';
        document.getElementById('notif-toggle').checked = profile.notificationsEnabled !== false;

        // Populate ID Card
        const navInitial = document.getElementById('user-avatar-initial');
        if (profile.avatar && profile.avatar.url) {
            document.getElementById('id-avatar').innerHTML = `
                <img src="${escapeHTML(profile.avatar.url)}" alt="Profile" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;">
                <div class="avatar-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; z-index: 1;">
                    <i data-lucide="camera" style="color: white; width: 20px; height: 20px;"></i>
                </div>`;
                
            if (navInitial) {
                navInitial.textContent = '';
                navInitial.style.backgroundImage = `url(${profile.avatar.url})`;
                navInitial.style.backgroundSize = 'cover';
                navInitial.style.backgroundPosition = 'center';
            }
            
            // Update localStorage with latest avatar
            const user = JSON.parse(localStorage.getItem('current_user') || '{}');
            user.avatar = profile.avatar;
            localStorage.setItem('current_user', JSON.stringify(user));
        } else {
            const initial = profile.fullName ? profile.fullName.charAt(0).toUpperCase() : (profile.email ? profile.email.charAt(0).toUpperCase() : 'U');
            document.getElementById('id-avatar').innerHTML = `
                ${escapeHTML(initial)}
                <div class="avatar-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;">
                    <i data-lucide="camera" style="color: white; width: 20px; height: 20px;"></i>
                </div>`;
            if (navInitial) {
                navInitial.style.backgroundImage = 'none';
                navInitial.textContent = initial;
            }
        }
        
        document.getElementById('id-name').textContent = profile.fullName || 'No Name Provided';
        document.getElementById('id-role').textContent = profile.role === 'admin' ? 'Librarian / Admin' : 'Student Member';

        // Generate Barcode using UID
        if (profile.role === 'admin') {
            document.querySelector('.barcode-container').style.display = 'none';
            // Hide the 'Library Member ID' label which is the previous element sibling
            const barcodeContainer = document.querySelector('.barcode-container');
            if (barcodeContainer && barcodeContainer.previousElementSibling) {
                barcodeContainer.previousElementSibling.style.display = 'none';
            }
        } else if (profile.uid) {
            JsBarcode("#barcode", profile.uid, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 12,
                margin: 0,
                background: "#ffffff",
                lineColor: "#000000"
            });
        }

        // Populate Stats
        if (profile.role === 'admin') {
            document.getElementById('lifetime-stats-card').style.display = 'none';
            document.querySelector('.profile-container').classList.add('admin-layout');
        } else {
            document.getElementById('stat-read').textContent = stats.lifetime_books || 0;
            document.getElementById('stat-issued').textContent = stats.currently_issued || 0;
            document.getElementById('stat-fine').textContent = `₹${stats.total_fine || 0}`;
        }

    } catch (error) {
        console.error("Profile load error:", error);
        showMessage("msg-box", "Error loading profile data", "error");
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const btnSave = document.getElementById('btn-save');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="lucide-loader"></i> Saving...';
    btnSave.disabled = true;

    const updates = {
        fullName: document.getElementById('edit-name').value,
        phone: document.getElementById('edit-phone').value,
        notificationsEnabled: document.getElementById('notif-toggle').checked
    };

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(updates)
        });

        const data = await response.json();

        if (response.ok) {
            showMessage("msg-box", "Profile updated successfully!", "success");
            
            // Update local storage user data
            const user = JSON.parse(localStorage.getItem('current_user') || '{}');
            user.fullName = updates.fullName;
            localStorage.setItem('current_user', JSON.stringify(user));
            
            // Reload UI
            await loadProfileData();
            
            // If the avatar in navbar exists and isn't an image, update the initial
            const navInitial = document.getElementById('user-avatar-initial');
            if (navInitial && navInitial.style.backgroundImage === '') {
                navInitial.textContent = updates.fullName.charAt(0).toUpperCase();
            }
            const dropName = document.getElementById('dropdown-name');
            if (dropName) dropName.textContent = updates.fullName;
        } else {
            showMessage("msg-box", data.error || "Failed to update profile", "error");
        }
    } catch (error) {
        showMessage("msg-box", "Network error", "error");
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
        lucide.createIcons();
    }
}

function handleThemeToggle(e) {
    const isDark = e.target.checked;
    if (!isDark) {
        localStorage.setItem('theme', 'light');
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
    } else {
        localStorage.setItem('theme', 'dark');
        document.documentElement.classList.remove('light-theme');
        document.body.classList.remove('light-theme');
    }
}


async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showMessage('msg-box', 'Please select an image file', 'error');
        return;
    }

    try {
        showMessage('msg-box', 'Uploading photo...', 'success');
        
        // Fetch current user from API to get the correct UID reliably
        const userData = await apiClient.getCurrentUser();
        if (!userData || !userData.uid) {
            showMessage('msg-box', 'Session error. Please logout and login again.', 'error');
            return;
        }
        
        const response = await apiClient.uploadMemberAvatar(userData.uid, file);

        if (response && response.success) {
            showMessage('msg-box', 'Profile photo updated successfully!', 'success');
            
            // Reload profile data to reflect changes
            await loadProfileData();
        } else {
            showMessage('msg-box', (response && response.error) ? response.error : 'Failed to upload photo', 'error');
        }
    } catch (error) {
        showMessage('msg-box', error.message || 'Error uploading photo', 'error');
    }
    
    // Reset file input
    event.target.value = '';
}
