class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('auth_token');
    }

    _getHeaders(contentType = 'application/json') {
        const headers = {};
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async _request(method, endpoint, data = null, isFormData = false) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method: method,
            headers: this._getHeaders(isFormData ? null : 'application/json')
        };
        
        if (data) {
            if (isFormData) {
                options.body = data;
            } else {
                options.body = JSON.stringify(data);
            }
        }
        
        try {
            const response = await fetch(url, options);
            
            if (response.status === 401) {
                this.logout();
                return null;
            }

            if (response.status === 403) {
                const errorData = await response.json();
                return { success: false, error: errorData.error, code: errorData.code };
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error: ${method} ${endpoint}`, error);
            throw error;
        }
    }

    // AUTH
    async register(userData) {
        return await this._request('POST', '/auth/register', userData);
    }

    async login(email, password) {
        const response = await this._request('POST', '/auth/login', {
            email: email,
            password: password
        });
        
        if (response && response.accessToken) {
            this.token = response.accessToken;
            localStorage.setItem('auth_token', this.token);
        }
        
        return response;
    }

    async logout() {
        localStorage.removeItem('auth_token');
        this.token = null;
        window.location.href = '/login';
    }

    async getCurrentUser() {
        return await this._request('GET', '/auth/me');
    }

    async forgotPassword(email) {
        return await this._request('POST', '/auth/forgot-password', {
            email: email
        });
    }

    async resetPassword(token, newPassword) {
        return await this._request('POST', '/auth/reset-password', {
            token: token,
            newPassword: newPassword
        });
    }

    // BOOKS
    async getAllBooks(filters = {}) {
        let url = '/books';
        const params = new URLSearchParams();
        
        if (filters.category) params.append('category', filters.category);
        if (filters.minYear) params.append('minYear', filters.minYear);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        return await this._request('GET', url);
    }

    async getBook(bookId) {
        return await this._request('GET', `/books/${bookId}`);
    }

    async addBook(bookData) {
        return await this._request('POST', '/books', bookData);
    }

    async updateBook(bookId, updates) {
        return await this._request('PUT', `/books/${bookId}`, updates);
    }

    async deleteBook(bookId) {
        return await this._request('DELETE', `/books/${bookId}`);
    }

    async uploadBookCover(bookId, file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bookId', bookId);
        
        return await this._request('POST', `/books/${bookId}/upload-cover`, formData, true);
    }

    // MEMBERS
    async getAllMembers(filters = {}) {
        let url = '/members';
        const params = new URLSearchParams();
        
        if (filters.status) params.append('status', filters.status);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        return await this._request('GET', url);
    }

    async getMember(memberId) {
        return await this._request('GET', `/members/${memberId}`);
    }

    async addMember(memberData) {
        return await this._request('POST', '/members', memberData);
    }

    async updateMember(memberId, updates) {
        return await this._request('PUT', `/members/${memberId}`, updates);
    }

    async deleteMember(memberId, hard = false) {
        let url = `/members/${memberId}`;
        if (hard) url += '?hard=true';
        return await this._request('DELETE', url);
    }

    async payMemberFine(memberId) {
        return await this._request('POST', `/members/${memberId}/pay-fine`);
    }

    async uploadMemberAvatar(memberId, file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('memberId', memberId);
        
        return await this._request('POST', `/members/${memberId}/upload-avatar`, formData, true);
    }

    // TRANSACTIONS
    async getAllTransactions(filters = {}) {
        let url = '/transactions';
        const params = new URLSearchParams();
        
        if (filters.status) params.append('status', filters.status);
        if (filters.memberId) params.append('memberId', filters.memberId);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        return await this._request('GET', url);
    }

    async issueBook(transactionData) {
        return await this._request('POST', '/transactions/issue', transactionData);
    }

    async returnBook(transactionId, returnData) {
        return await this._request('PUT', `/transactions/${transactionId}/return`, returnData);
    }

    async renewBook(transactionId) {
        return await this._request('PUT', `/transactions/${transactionId}/renew`, {});
    }

    // NOTIFICATIONS
    async getNotifications(unreadOnly = false) {
        let url = '/notifications';
        if (unreadOnly) {
            url += '?unread=true';
        }
        return await this._request('GET', url);
    }

    // ANALYTICS
    async getMonthlyReport(year, month) {
        return await this._request('GET', `/analytics/report/${year}/${month}`);
    }

    async getDashboardStats() {
        return await this._request('GET', '/analytics/dashboard');
    }

    // SETTINGS
    async getSettings() {
        return await this._request('GET', '/settings');
    }

    async updateSettings(settingsData) {
        return await this._request('POST', '/settings', settingsData);
    }

    // HELPERS
    static formatDate(dateString) {
        const date = new Date(dateString);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    static daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const difference = d2.getTime() - d1.getTime();
        return Math.ceil(difference / (1000 * 60 * 60 * 24));
    }

    static calculateFine(dueDate, returnDate, ratePerDay = 5) {
        const daysLate = this.daysBetween(dueDate, returnDate);
        return daysLate > 0 ? Math.min(daysLate * ratePerDay, 500) : 0;
    }

    isAuthenticated() {
        return this.token !== null && this.token !== undefined;
    }

    static escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

const apiClient = new APIClient();