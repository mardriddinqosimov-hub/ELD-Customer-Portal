// static/js/api.js - API Client

const API_BASE_URL = '/api';

class APIClient {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    async request(method, endpoint, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/';
                return null;
            }

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'API Error');
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        return this.request('POST', '/auth/login', { email, password });
    }

    async register(company_name, email, password, first_name, last_name) {
        return this.request('POST', '/auth/register', {
            company_name,
            email,
            password,
            first_name,
            last_name
        });
    }

    // Dashboard endpoints
    async getDashboardMetrics() {
        return this.request('GET', '/dashboard/metrics');
    }

    async getViolations(days = 30) {
        return this.request('GET', `/violations?days=${days}`);
    }

    async acknowledgeViolation(violationId, actionTaken) {
        return this.request('POST', `/violations/${violationId}/acknowledge`, {
            action_taken: actionTaken
        });
    }

    async getDevices() {
        return this.request('GET', '/devices');
    }

    async getFAQs() {
        return this.request('GET', '/faqs');
    }

    async getSupportTickets() {
        return this.request('GET', '/support-tickets');
    }

    async createSupportTicket(subject, description, priority = 'normal') {
        return this.request('POST', '/support-tickets', {
            subject,
            description,
            priority
        });
    }

    async getComplianceReport() {
        return this.request('GET', '/compliance-report');
    }
}

// Initialize API client
const api = new APIClient();

// static/js/landing.js - Landing Page Logic

function showLoginForm() {
    document.getElementById('login-modal').style.display = 'block';
}

function closeLoginForm() {
    document.getElementById('login-modal').style.display = 'none';
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await api.login(email, password);
        
        // Save token and user info
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify({
            id: response.user_id,
            company_id: response.company_id,
            company_name: response.company_name,
            email: response.email,
            first_name: response.first_name
        }));
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const company_name = document.getElementById('register-company').value;
    const email = document.getElementById('register-email').value;
    const first_name = document.getElementById('register-first-name').value;
    const last_name = document.getElementById('register-last-name').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await api.register(company_name, email, password, first_name, last_name);
        
        // Auto-login after registration
        const loginResponse = await api.login(email, password);
        
        localStorage.setItem('token', loginResponse.token);
        localStorage.setItem('user', JSON.stringify({
            id: loginResponse.user_id,
            company_id: loginResponse.company_id,
            company_name: loginResponse.company_name,
            email: loginResponse.email,
            first_name: loginResponse.first_name
        }));
        
        window.location.href = '/dashboard';
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('login-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// static/js/dashboard.js - Dashboard Logic

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
    }
}

// Load dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadDashboard();
});

async function loadDashboard() {
    try {
        // Get user info
        const user = JSON.parse(localStorage.getItem('user'));
        document.getElementById('company-name').textContent = user.company_name + ' Dashboard';
        
        // Load metrics
        const metrics = await api.getDashboardMetrics();
        updateMetrics(metrics);
        
        // Load recent violations
        loadRecentViolations();
        
        // Load other data
        loadDevices();
        loadFAQs();
        loadSupportTickets();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateMetrics(metrics) {
    document.getElementById('compliance-score').textContent = metrics.compliance_score + '%';
    document.getElementById('compliance-status').textContent = 
        metrics.compliance_score >= 90 ? '✓ Excellent' : 
        metrics.compliance_score >= 75 ? '⚠ Good' : 
        '✗ Poor';
    
    document.getElementById('active-devices').textContent = metrics.active_devices;
    document.getElementById('total-devices').textContent = `Total: ${metrics.total_devices}`;
    document.getElementById('violations-month').textContent = metrics.violations_month;
    document.getElementById('fines-avoided').textContent = '$' + (metrics.estimated_fines_avoided / 1000).toFixed(1) + 'K';
    
    // Update compliance message
    const message = metrics.compliance_score >= 90 
        ? '✓ Your fleet is performing excellently!'
        : metrics.compliance_score >= 75
        ? '⚠ Good performance. Minor improvements needed.'
        : '✗ Action required to improve compliance.';
    document.getElementById('compliance-message').textContent = message;
}

async function loadRecentViolations() {
    try {
        const response = await api.getViolations(30);
        const violations = response.violations.slice(0, 3); // Show only 3
        
        const html = violations.length > 0 
            ? violations.map(v => `
                <div class="violation-item severity-${v.severity}">
                    <div class="violation-header">
                        <span class="violation-badge">${v.severity.toUpperCase()}</span>
                        <span class="violation-driver">${v.driver_name}</span>
                        <span class="violation-date">${new Date(v.detected_at).toLocaleDateString()}</span>
                    </div>
                    <div class="violation-body">
                        <p class="violation-type">${v.violation_type.replace(/_/g, ' ')}</p>
                        <p class="violation-description">${v.description}</p>
                    </div>
                </div>
            `).join('')
            : '<p class="no-data">No violations - excellent compliance!</p>';
        
        document.getElementById('recent-violations').innerHTML = html;
    } catch (error) {
        console.error('Error loading violations:', error);
    }
}

async function loadViolations(days) {
    try {
        const daysNum = days === 'all' ? 365 : parseInt(days);
        const response = await api.getViolations(daysNum);
        const violations = response.violations;
        
        const html = violations.length > 0
            ? violations.map(v => `
                <div class="violation-item severity-${v.severity}">
                    <div class="violation-header">
                        <span class="violation-badge">${v.severity.toUpperCase()}</span>
                        <span class="violation-driver">${v.driver_name}</span>
                        <span class="violation-date">${new Date(v.detected_at).toLocaleDateString()}</span>
                        <span class="violation-fine">Fine: $${v.potential_fine}</span>
                    </div>
                    <div class="violation-body">
                        <p class="violation-type">${v.violation_type.replace(/_/g, ' ')}</p>
                        <p class="violation-description">${v.description}</p>
                        <p class="violation-status">Status: ${v.status}</p>
                    </div>
                </div>
            `).join('')
            : '<p class="no-data">No violations in this period</p>';
        
        document.getElementById('all-violations').innerHTML = html;
    } catch (error) {
        console.error('Error loading violations:', error);
    }
}

async function loadDevices() {
    try {
        const response = await api.getDevices();
        const devices = response.devices;
        
        const html = devices.length > 0
            ? devices.map(d => `
                <div class="device-card status-${d.status}">
                    <div class="device-header">
                        <h3>${d.device_name}</h3>
                        <span class="device-status">${d.status.toUpperCase()}</span>
                    </div>
                    <div class="device-body">
                        <p><strong>Device ID:</strong> ${d.device_id}</p>
                        <p><strong>Last Sync:</strong> ${new Date(d.last_sync).toLocaleString()}</p>
                        <p><strong>Created:</strong> ${new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            `).join('')
            : '<p class="no-data">No devices configured</p>';
        
        document.getElementById('devices-list').innerHTML = html;
    } catch (error) {
        console.error('Error loading devices:', error);
    }
}

async function loadFAQs() {
    try {
        const response = await api.getFAQs();
        const faqs = response.faqs;
        
        const html = faqs.map(faq => `
            <div class="faq-item">
                <div class="faq-question" onclick="toggleFAQ(this)">
                    <span>${faq.question}</span>
                    <span class="faq-toggle">▼</span>
                </div>
                <div class="faq-answer">${faq.answer}</div>
            </div>
        `).join('');
        
        document.getElementById('faqs-list').innerHTML = html;
    } catch (error) {
        console.error('Error loading FAQs:', error);
    }
}

function toggleFAQ(element) {
    const answer = element.nextElementSibling;
    answer.classList.toggle('active');
}

function filterFAQ() {
    const searchTerm = document.getElementById('faq-search').value.toLowerCase();
    const faqs = document.querySelectorAll('.faq-item');
    
    faqs.forEach(faq => {
        const question = faq.querySelector('.faq-question').textContent.toLowerCase();
        const answer = faq.querySelector('.faq-answer').textContent.toLowerCase();
        
        if (question.includes(searchTerm) || answer.includes(searchTerm)) {
            faq.style.display = 'block';
        } else {
            faq.style.display = 'none';
        }
    });
}

async function loadSupportTickets() {
    try {
        const response = await api.getSupportTickets();
        const tickets = response.tickets;
        
        const html = tickets.length > 0
            ? tickets.map(t => `
                <div class="ticket-card status-${t.status}">
                    <div class="ticket-header">
                        <span class="ticket-number">${t.ticket_number}</span>
                        <span class="ticket-status">${t.status.toUpperCase()}</span>
                        <span class="ticket-priority priority-${t.priority}">${t.priority.toUpperCase()}</span>
                    </div>
                    <div class="ticket-body">
                        <h4>${t.subject}</h4>
                        <p>${t.description.substring(0, 100)}...</p>
                        <p class="ticket-date">Created: ${new Date(t.created_at).toLocaleString()}</p>
                    </div>
                </div>
            `).join('')
            : '<p class="no-data">No support tickets yet</p>';
        
        document.getElementById('support-tickets').innerHTML = html;
    } catch (error) {
        console.error('Error loading support tickets:', error);
    }
}

async function createTicket(event) {
    event.preventDefault();
    
    const subject = document.getElementById('ticket-subject').value;
    const description = document.getElementById('ticket-description').value;
    const priority = document.getElementById('ticket-priority').value;
    
    try {
        const response = await api.createSupportTicket(subject, description, priority);
        alert('Ticket created: ' + response.ticket_number);
        
        // Clear form
        document.querySelector('.ticket-form').reset();
        
        // Reload tickets
        loadSupportTickets();
    } catch (error) {
        alert('Error creating ticket: ' + error.message);
    }
}

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    document.getElementById(viewName + '-view').classList.add('active');
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
}

async function downloadReport() {
    try {
        const report = await api.getComplianceReport();
        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    } catch (error) {
        alert('Error downloading report: ' + error.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}
