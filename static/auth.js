async function handleRegister(event) {
    event.preventDefault();

    const fullName = document.getElementById("full-name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const role = document.getElementById("role").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!role) {
        showMessage("msg-box", "Select role", "error");
        return;
    }

    if (password !== confirmPassword) {
        showMessage("msg-box", "Passwords don't match", "error");
        return;
    }

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPassword.test(password)) {
        showMessage("msg-box", "Weak password (8+ chars, uppercase, lowercase, digit, special)", "error");
        return;
    }

    try {
        const payload = {
            email: email,
            password: password,
            fullName: fullName,
            role: role
        };
        
        if (role === 'admin') {
            payload.adminSecret = document.getElementById("admin-secret").value;
        }

        const response = await apiClient.register(payload);

        if (response.success) {
            alert("Account created successfully! Please check your email (and Spam folder) to verify your account before logging in.");
            window.location.href = "/login";
        } else {
            showMessage("msg-box", response.error || "Registration failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message || "Registration failed", "error");
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const role = document.getElementById("role").value;
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    if (!role || !email || !password) {
        showMessage("msg-box", "All fields required", "error");
        return;
    }

    try {
        const response = await apiClient.login(email, password);

        if (response && response.success) {
            // Validate that the selected role matches the actual role
            if (role !== response.role) {
                // Clear any stored tokens if there's a mismatch to prevent partial login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('current_user');
                showMessage("msg-box", `Access denied. You are registered as a ${response.role}, not a ${role}.`, "error");
                return;
            }

            localStorage.setItem('current_user', JSON.stringify({
                uid: response.uid,
                email: response.email,
                role: response.role,
                fullName: response.fullName,
                avatar: response.avatar
            }));

            showMessage("msg-box", "Login successful!", "success");
            setTimeout(() => {
                if (response.role === "admin") {
                    window.location.href = "/";
                } else {
                    window.location.href = "/student-dashboard";
                }
            }, 1000);
        } else if (response && response.code === 'EMAIL_NOT_VERIFIED') {
            showMessage("msg-box", response.error || "Please verify your email before logging in.", "error");
        } else {
            showMessage("msg-box", response?.error || "Invalid credentials", "error");
        }
    } catch (error) {
        showMessage("msg-box", "Invalid credentials", "error");
    }
}

function logout() {
    apiClient.logout();
}

function getCurrentUser() {
    const userJson = localStorage.getItem('current_user');
    return userJson ? JSON.parse(userJson) : null;
}

function checkAuth(requiredRole = null) {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        window.location.href = "/login";
        return false;
    }

    const user = getCurrentUser();
    if (requiredRole && user && user.role !== requiredRole) {
        window.location.href = "/login";
        return false;
    }

    return true;
}

async function handleForgotPassword(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();

    if (!email) {
        showMessage("msg-box", "Email required", "error");
        return;
    }

    try {
        const response = await apiClient.forgotPassword(email);

        if (response.success) {
            showMessage("msg-box", "Reset link sent to your email!", "success");
        } else {
            showMessage("msg-box", response.error || "Request failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message || "Request failed", "error");
    }
}

async function handleResetPassword(event) {
    event.preventDefault();

    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');

    if (!token) {
        token = localStorage.getItem('auth_token'); // Fallback to logged-in user token
    }

    if (!token) {
        showMessage("msg-box", "Invalid or missing token. Please use a reset link.", "error");
        return;
    }

    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (!newPassword || !confirmPassword) {
        showMessage("msg-box", "Both password fields are required", "error");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage("msg-box", "Passwords do not match", "error");
        return;
    }

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPassword.test(newPassword)) {
        showMessage("msg-box", "Weak password (8+ chars, uppercase, lowercase, digit, special)", "error");
        return;
    }

    try {
        const response = await apiClient.resetPassword(token, newPassword);

        if (response.success) {
            showMessage("msg-box", "Password reset successfully! Redirecting to login...", "success");
            setTimeout(() => {
                window.location.href = "/login";
            }, 2000);
        } else {
            showMessage("msg-box", response.error || "Reset failed", "error");
        }
    } catch (error) {
        showMessage("msg-box", error.message || "Reset failed", "error");
    }
}

function togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        iconElement.innerHTML = '<i data-lucide="eye-off"></i>';
    } else {
        input.type = "password";
        iconElement.innerHTML = '<i data-lucide="eye"></i>';
    }
    lucide.createIcons();
}

// --- Profile Dropdown Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (user) {
        // Populate profile dropdown data
        const initial = user.fullName ? user.fullName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U');
        
        const avatarInitialEls = document.querySelectorAll('#user-avatar-initial, #dropdown-avatar-initial');
        avatarInitialEls.forEach(el => {
            if (user.avatar && user.avatar.url) {
                el.style.backgroundImage = 'none';
                el.style.padding = '0';
                el.innerHTML = `<img src="${escapeHTML(user.avatar.url)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" alt="User">`;
            } else {
                el.innerHTML = '';
                el.textContent = initial;
            }
        });
        
        const nameEl = document.getElementById('dropdown-name');
        const displayName = user.fullName || (user.role === 'admin' ? 'Admin' : 'Student');
        if (nameEl) nameEl.textContent = displayName;
        
        const welcomeEl = document.getElementById('welcome-name');
        if (welcomeEl) welcomeEl.textContent = displayName;
        
        const navNameEl = document.getElementById('nav-user-name');
        if (navNameEl) {
            navNameEl.textContent = user.fullName ? user.fullName.split(' ')[0] : (user.role === 'admin' ? 'Admin' : 'Student');
            navNameEl.style.display = 'inline';
        }
        
        const emailEl = document.getElementById('dropdown-email');
        if (emailEl) emailEl.textContent = user.email || '';
    }

    // Toggle dropdown
    const profileToggle = document.getElementById('profile-toggle');
    const profileMenu = document.getElementById('profile-menu');

    if (profileToggle && profileMenu) {
        profileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileToggle.contains(e.target) && !profileMenu.contains(e.target)) {
                profileMenu.classList.remove('show');
            }
        });
    }

    // Dynamically Load Library Name
    const cachedLibName = localStorage.getItem("appLibraryName");
    const updateSidebarTitle = (name) => {
        document.querySelectorAll('.sidebar-title').forEach(el => el.textContent = name);
    };

    if (cachedLibName) {
        updateSidebarTitle(cachedLibName);
    }
    
    // Fetch fresh settings in background (cached on server for performance)
    fetch('/api/settings/public')
        .then(res => res.json())
        .then(data => {
            if (data && data.libraryName && data.libraryName !== cachedLibName) {
                localStorage.setItem("appLibraryName", data.libraryName);
                updateSidebarTitle(data.libraryName);
            }
        }).catch(err => console.error("Error loading public settings", err));
});