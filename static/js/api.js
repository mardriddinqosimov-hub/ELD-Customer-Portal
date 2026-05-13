const API_BASE_URL = '/api';

class APIClient {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    async request(method, endpoint, data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        this.token = localStorage.getItem('token');
        if (this.token) {
            options.headers.Authorization = `Bearer ${this.token}`;
        }

        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            return null;
        }

        if (!response.ok) {
            throw new Error(result.message || 'Request failed');
        }

        return result;
    }

    login(email, password) {
        return this.request('POST', '/auth/login', { email, password });
    }

    register(company_name, email, password, first_name, last_name) {
        return this.request('POST', '/auth/register', {
            company_name,
            email,
            password,
            first_name,
            last_name
        });
    }

    getDashboardMetrics() {
        return this.request('GET', '/dashboard/metrics');
    }

    getViolations(days = 30) {
        return this.request('GET', `/violations?days=${encodeURIComponent(days)}`);
    }

    acknowledgeViolation(violationId, actionTaken) {
        return this.request('POST', `/violations/${violationId}/acknowledge`, {
            action_taken: actionTaken
        });
    }

    getDevices() {
        return this.request('GET', '/devices');
    }

    getFAQs() {
        return this.request('GET', '/faqs');
    }

    getSupportTickets() {
        return this.request('GET', '/support-tickets');
    }

    createSupportTicket(subject, description, priority = 'normal') {
        return this.request('POST', '/support-tickets', {
            subject,
            description,
            priority
        });
    }

    getComplianceReport() {
        return this.request('GET', '/compliance-report');
    }

    addTruck(truck_name, truck_id, driver_name = '') {
        return this.request('POST', '/trucks', { truck_name, truck_id, driver_name });
    }

    deleteTruck(id) {
        return this.request('DELETE', `/trucks/${id}`);
    }

    uploadViolations(violations) {
        return this.request('POST', '/upload/violations', { violations });
    }

    uploadTrucks(trucks) {
        return this.request('POST', '/upload/trucks', { trucks });
    }

    getImages() {
        return this.request('GET', '/upload/images');
    }

    getReports() {
        return this.request('GET', '/reports');
    }

    reviewReport(id, data) {
        return this.request('POST', `/reports/${id}/review`, data);
    }

    async uploadImage(file) {
        const formData = new FormData();
        formData.append('file', file);
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/upload/images`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData
        });
        const result = await res.json().catch(() => ({}));
        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
            return null;
        }
        if (!res.ok) throw new Error(result.message || 'Upload failed');
        return result;
    }
}

const api = new APIClient();
