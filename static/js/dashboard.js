function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function checkAuth() {
    if (!localStorage.getItem('token')) window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboard();
});

async function loadDashboard() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        document.getElementById('company-name').textContent = `${user.company_name || 'Company'} Dashboard`;
        const metrics = await api.getDashboardMetrics();
        updateMetrics(metrics);
        await Promise.all([loadRecentViolations(), loadTrucks(), loadFAQs(), loadSupportTickets()]);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateMetrics(metrics) {
    document.getElementById('compliance-score').textContent = `${metrics.compliance_score}%`;
    document.getElementById('compliance-status').textContent =
        metrics.compliance_score >= 90 ? 'Excellent' :
        metrics.compliance_score >= 75 ? 'Good' : 'Needs attention';
    document.getElementById('active-devices').textContent = metrics.active_devices;
    document.getElementById('total-devices').textContent = `Total: ${metrics.total_devices}`;
    document.getElementById('violations-month').textContent = metrics.violations_month;
    document.getElementById('fines-avoided').textContent = `$${(metrics.estimated_fines_avoided / 1000).toFixed(1)}K`;
    document.getElementById('compliance-message').textContent =
        metrics.compliance_score >= 90 ? 'Your fleet is performing excellently.' :
        metrics.compliance_score >= 75 ? 'Good performance. Minor improvements needed.' :
        'Action required to improve compliance.';
}

// ── View switching ─────────────────────────────────────────────────────────────

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${viewName}`);
    });
    if (viewName === 'violations') loadViolations(30);
    if (viewName === 'trucks') loadTrucks();
    if (viewName === 'upload') loadImages();
    if (viewName === 'reports') loadReports();
}

// ── Violations ─────────────────────────────────────────────────────────────────

async function loadRecentViolations() {
    const response = await api.getViolations(30);
    document.getElementById('recent-violations').innerHTML = renderViolations(response.violations.slice(0, 3), false);
}

async function loadViolations(days) {
    document.getElementById('all-violations').innerHTML = '<p class="loading">Loading violations...</p>';
    const daysNum = days === 'all' ? 3650 : parseInt(days, 10);
    const response = await api.getViolations(daysNum);
    document.getElementById('all-violations').innerHTML = renderViolations(response.violations, true);
}

function renderViolations(violations, includeFine) {
    if (!violations.length) return '<p class="no-data">No violations in this period.</p>';
    return violations.map(v => `
        <div class="violation-item severity-${escapeHtml(v.severity)}">
            <div class="violation-header">
                <span class="violation-badge">${escapeHtml(v.severity).toUpperCase()}</span>
                <span class="violation-driver">${escapeHtml(v.driver_name)}</span>
                <span class="violation-date">${new Date(v.detected_at).toLocaleDateString()}</span>
                ${includeFine ? `<span class="violation-fine">Fine: $${Number(v.potential_fine).toLocaleString()}</span>` : ''}
            </div>
            <div class="violation-body">
                <p class="violation-type">${escapeHtml(v.violation_type).replace(/_/g, ' ')}</p>
                <p class="violation-description">${escapeHtml(v.description)}</p>
                ${includeFine ? `<p class="violation-status">Status: ${escapeHtml(v.status)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

// ── Trucks ─────────────────────────────────────────────────────────────────────

async function loadTrucks() {
    try {
        const response = await api.getDevices();
        const trucks = response.devices;
        const container = document.getElementById('trucks-list');
        if (!trucks.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
                            <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                    </div>
                    <h3>No trucks yet</h3>
                    <p>Add your first truck to start tracking ELD compliance.</p>
                    <button class="btn btn-primary" onclick="toggleAddTruckForm()">+ Add Your First Truck</button>
                </div>`;
            return;
        }
        container.innerHTML = trucks.map(t => `
            <div class="device-card status-${escapeHtml(t.status)}">
                <div class="device-header">
                    <h3>${escapeHtml(t.device_name)}</h3>
                    <div class="device-header-actions">
                        <span class="device-status">${escapeHtml(t.status).toUpperCase()}</span>
                        <button class="btn-remove" onclick="deleteTruck(${t.id})">Remove</button>
                    </div>
                </div>
                <div class="device-body">
                    <p><strong>Truck ID:</strong> ${escapeHtml(t.device_id)}</p>
                    <p><strong>Last Sync:</strong> ${new Date(t.last_sync).toLocaleString()}</p>
                    <p><strong>Added:</strong> ${new Date(t.created_at).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        document.getElementById('trucks-list').innerHTML = '<p class="no-data">Error loading trucks.</p>';
    }
}

function toggleAddTruckForm() {
    const section = document.getElementById('add-truck-section');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    if (section.style.display === 'block') document.getElementById('truck-name').focus();
}

async function addTruck(event) {
    event.preventDefault();
    const name = document.getElementById('truck-name').value.trim();
    const id = document.getElementById('truck-unit-id').value.trim();
    try {
        await api.addTruck(name, id);
        document.getElementById('add-truck-form').reset();
        toggleAddTruckForm();
        await loadTrucks();
        showToast('Truck added successfully!', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function deleteTruck(truckId) {
    if (!confirm('Remove this truck from your fleet? This cannot be undone.')) return;
    try {
        await api.deleteTruck(truckId);
        await loadTrucks();
        showToast('Truck removed.', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

// ── FAQ ────────────────────────────────────────────────────────────────────────

async function loadFAQs() {
    const response = await api.getFAQs();
    document.getElementById('faqs-list').innerHTML = response.faqs.map(faq => `
        <div class="faq-item">
            <div class="faq-question" onclick="toggleFAQ(this)">
                <span>${escapeHtml(faq.question)}</span>
                <span class="faq-toggle">&#8964;</span>
            </div>
            <div class="faq-answer">${escapeHtml(faq.answer)}</div>
        </div>
    `).join('');
}

function toggleFAQ(element) {
    element.classList.toggle('active');
    element.nextElementSibling.classList.toggle('active');
}

function filterFAQ() {
    const term = document.getElementById('faq-search').value.toLowerCase();
    document.querySelectorAll('.faq-item').forEach(faq => {
        faq.style.display = faq.textContent.toLowerCase().includes(term) ? 'block' : 'none';
    });
}

// ── Support Tickets ────────────────────────────────────────────────────────────

async function loadSupportTickets() {
    const response = await api.getSupportTickets();
    const tickets = response.tickets;
    document.getElementById('support-tickets').innerHTML = tickets.length
        ? tickets.map(t => `
            <div class="ticket-card status-${escapeHtml(t.status)}">
                <div class="ticket-header">
                    <span class="ticket-number">${escapeHtml(t.ticket_number)}</span>
                    <span class="ticket-status">${escapeHtml(t.status).toUpperCase()}</span>
                    <span class="ticket-priority priority-${escapeHtml(t.priority)}">${escapeHtml(t.priority).toUpperCase()}</span>
                </div>
                <div class="ticket-body">
                    <h4>${escapeHtml(t.subject)}</h4>
                    <p>${escapeHtml(t.description).slice(0, 120)}...</p>
                    <p class="ticket-date">Created: ${new Date(t.created_at).toLocaleString()}</p>
                </div>
            </div>
        `).join('')
        : '<p class="no-data">No support tickets yet.</p>';
}

async function createTicket(event) {
    event.preventDefault();
    const subject = document.getElementById('ticket-subject').value.trim();
    const description = document.getElementById('ticket-description').value.trim();
    const priority = document.getElementById('ticket-priority').value;
    try {
        const response = await api.createSupportTicket(subject, description, priority);
        showToast(`Ticket ${response.ticket_number} created!`, 'success');
        document.querySelector('.ticket-form').reset();
        await loadSupportTickets();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

// ── CSV Upload ─────────────────────────────────────────────────────────────────

function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).filter(l => l.trim()).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
}

function setUploadStatus(id, message, type) {
    document.getElementById(id).innerHTML = `<div class="upload-status upload-status-${type}">${message}</div>`;
}

async function handleViolationsUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setUploadStatus('violations-upload-status', 'Processing file...', 'info');
    const text = await file.text();
    const records = parseCSV(text);
    if (!records.length) {
        setUploadStatus('violations-upload-status', 'No valid records found. Check your CSV format.', 'error');
        event.target.value = '';
        return;
    }
    try {
        const result = await api.uploadViolations(records);
        setUploadStatus('violations-upload-status', `&#10003; ${result.message}`, 'success');
        await loadRecentViolations();
    } catch (error) {
        setUploadStatus('violations-upload-status', `Error: ${error.message}`, 'error');
    }
    event.target.value = '';
}

async function handleTrucksUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setUploadStatus('trucks-upload-status', 'Processing file...', 'info');
    const text = await file.text();
    const records = parseCSV(text);
    if (!records.length) {
        setUploadStatus('trucks-upload-status', 'No valid records found. Check your CSV format.', 'error');
        event.target.value = '';
        return;
    }
    try {
        const result = await api.uploadTrucks(records);
        setUploadStatus('trucks-upload-status', `&#10003; ${result.message}`, 'success');
        await loadTrucks();
    } catch (error) {
        setUploadStatus('trucks-upload-status', `Error: ${error.message}`, 'error');
    }
    event.target.value = '';
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadViolationsTemplate() {
    downloadCSV(
        'driver_name,violation_type,severity,description,violation_date,potential_fine\n' +
        'John Smith,excessive_hours,high,Driver exceeded 11-hour driving limit,2024-01-15,2500\n' +
        'Jane Doe,missing_logs,medium,Log entry missing for afternoon shift,2024-01-16,1000\n' +
        'Mike Johnson,improper_status,low,Incorrect duty status recorded,2024-01-17,500',
        'violations_template.csv'
    );
}

function downloadTrucksTemplate() {
    downloadCSV(
        'truck_name,truck_id\nUnit 001,TRUCK-001\nUnit 002,ABC-1234\nBig Blue,TX-5678',
        'trucks_template.csv'
    );
}

// ── Reports ────────────────────────────────────────────────────────────────────

async function loadReports() {
    const container = document.getElementById('reports-list');
    container.innerHTML = '<p class="loading">Loading reports...</p>';
    try {
        const response = await api.getReports();
        const reports = response.reports;
        if (!reports.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                    </div>
                    <h3>No reports yet</h3>
                    <p>Upload photos of inspection reports and violation papers in the Upload Data tab.</p>
                    <button class="btn btn-primary" onclick="switchView('upload')">Go to Upload Data</button>
                </div>`;
            return;
        }
        container.innerHTML = reports.map(r => renderReportCard(r)).join('');
        container.querySelectorAll('.report-thumb[data-url]').forEach(img => {
            img.addEventListener('click', () => window.open(img.dataset.url, '_blank'));
        });
        container.querySelectorAll('button[data-report-id]').forEach(btn => {
            btn.addEventListener('click', () => submitReview(parseInt(btn.dataset.reportId)));
        });
    } catch (error) {
        container.innerHTML = '<p class="no-data">Error loading reports.</p>';
    }
}

function renderReportCard(r) {
    const isPending = r.status === 'pending_review';
    const typeLabel = { eld_violation: 'ELD VIOLATION', other_violation: 'OTHER VIOLATION', clean: 'NO VIOLATION / CLEAN' };
    const typeCls = { eld_violation: 'badge-danger', other_violation: 'badge-warning', clean: 'badge-success' };
    const displayName = escapeHtml(r.filename.split('_').slice(2).join('_') || r.filename);

    const reviewedInfo = !isPending ? `
        <span class="report-badge ${typeCls[r.report_type] || 'badge-success'}">${typeLabel[r.report_type] || 'REVIEWED'}</span>
        ${r.driver_name ? `<p class="report-driver"><strong>Driver:</strong> ${escapeHtml(r.driver_name)}</p>` : ''}
        ${r.severity ? `<p class="report-driver"><strong>Severity:</strong> ${escapeHtml(r.severity)}</p>` : ''}
        ${r.notes ? `<p class="report-notes">${escapeHtml(r.notes)}</p>` : ''}
        ${r.report_type === 'eld_violation' ? '<p class="report-link">ELD violation recorded — visible in Violations tab</p>' : ''}
    ` : '<span class="report-badge badge-pending">PENDING REVIEW</span>';

    const reviewForm = isPending ? `
        <div class="report-review-form">
            <h4>Review This Report</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Classification</label>
                    <select id="rtype-${r.id}">
                        <option value="eld_violation">ELD Violation → add to Violations tab</option>
                        <option value="other_violation">Other Violation → Reports tab only</option>
                        <option value="clean" selected>No Violation / Clean</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Severity</label>
                    <select id="rseverity-${r.id}">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Driver Name</label>
                <input type="text" id="rdriver-${r.id}" placeholder="Driver name (if applicable)">
            </div>
            <div class="form-group">
                <label>Notes / Description</label>
                <textarea id="rnotes-${r.id}" rows="3" placeholder="Describe the violation or add review notes..."></textarea>
            </div>
            <button class="btn btn-primary" data-report-id="${r.id}" id="rbtn-${r.id}">Submit Review</button>
        </div>
    ` : '';

    return `
        <div class="report-card ${isPending ? 'status-pending' : 'status-' + escapeHtml(r.report_type || 'clean')}">
            <div class="report-card-main">
                <img class="report-thumb" src="${escapeHtml(r.url)}" alt="Report" data-url="${escapeHtml(r.url)}">
                <div class="report-meta">
                    <p class="report-filename">${displayName}</p>
                    <p class="report-date">${new Date(r.uploaded_at).toLocaleString()}</p>
                    ${reviewedInfo}
                </div>
            </div>
            ${reviewForm}
        </div>
    `;
}

async function submitReview(reportId) {
    const reportType = document.getElementById(`rtype-${reportId}`).value;
    const severity = document.getElementById(`rseverity-${reportId}`).value;
    const driverName = document.getElementById(`rdriver-${reportId}`).value.trim();
    const notes = document.getElementById(`rnotes-${reportId}`).value.trim();
    const btn = document.getElementById(`rbtn-${reportId}`);
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    try {
        await api.reviewReport(reportId, { report_type: reportType, severity, driver_name: driverName, notes });
        showToast('Report reviewed!', 'success');
        if (reportType === 'eld_violation') showToast('ELD violation added to Violations tab', 'info');
        await loadReports();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        btn.disabled = false;
        btn.textContent = 'Submit Review';
    }
}

// ── Image Upload ───────────────────────────────────────────────────────────────

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        setUploadStatus('image-upload-status', 'File too large. Maximum size is 10 MB.', 'error');
        event.target.value = '';
        return;
    }
    setUploadStatus('image-upload-status', 'Uploading...', 'info');
    try {
        const result = await api.uploadImage(file);
        setUploadStatus('image-upload-status', `&#10003; ${result.message}`, 'success');
        await loadImages();
    } catch (error) {
        setUploadStatus('image-upload-status', `Error: ${error.message}`, 'error');
    }
    event.target.value = '';
}

async function loadImages() {
    try {
        const response = await api.getImages();
        const gallery = document.getElementById('image-gallery');
        if (!gallery) return;
        if (!response.images.length) { gallery.innerHTML = ''; return; }
        gallery.innerHTML = response.images.map(img => `
            <div class="image-card" data-url="${escapeHtml(img.url)}">
                <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.filename)}">
                <p class="image-name">${escapeHtml(img.filename.split('_').slice(2).join('_') || img.filename)}</p>
            </div>
        `).join('');
        gallery.querySelectorAll('.image-card').forEach(card => {
            card.addEventListener('click', () => window.open(card.dataset.url, '_blank'));
        });
    } catch (_) { /* gallery is non-critical */ }
}

// ── Report download ────────────────────────────────────────────────────────────

async function downloadReport() {
    try {
        const [report, metrics] = await Promise.all([api.getComplianceReport(), api.getDashboardMetrics()]);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const W = 210;
        const navy = [15, 52, 96];
        const white = [255, 255, 255];
        const dark = [30, 30, 50];
        const grey = [100, 110, 130];
        const light = [240, 245, 255];

        // Header banner
        doc.setFillColor(...navy);
        doc.rect(0, 0, W, 45, 'F');
        doc.setTextColor(...white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('ELD Compliance Report', W / 2, 18, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(report.company_name, W / 2, 28, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date(report.report_date).toLocaleString()}`, W / 2, 36, { align: 'center' });

        // Compliance score badge
        const score = metrics.compliance_score;
        const scoreColor = score >= 90 ? [16, 185, 129] : score >= 75 ? [245, 158, 11] : [239, 68, 68];
        doc.setFillColor(...scoreColor);
        doc.roundedRect(70, 50, 70, 22, 4, 4, 'F');
        doc.setTextColor(...white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(`${score}%`, W / 2, 60, { align: 'center' });
        doc.setFontSize(9);
        doc.text('COMPLIANCE SCORE', W / 2, 67, { align: 'center' });

        // Summary section
        let y = 82;
        const drawSection = (title) => {
            doc.setFillColor(...light);
            doc.rect(14, y - 6, W - 28, 10, 'F');
            doc.setTextColor(...navy);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(title, 18, y);
            y += 8;
        };

        const drawRow = (label, value, highlight = false) => {
            if (highlight) { doc.setFillColor(250, 250, 255); doc.rect(14, y - 5, W - 28, 8, 'F'); }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...dark);
            doc.text(label, 20, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grey);
            doc.text(String(value), 120, y);
            y += 9;
        };

        drawSection('Fleet Summary');
        drawRow('Total Trucks', report.total_devices, true);
        drawRow('Active Trucks', metrics.active_devices);
        drawRow('Compliance Score', `${score}%`, true);
        drawRow('Violations This Month', metrics.violations_month);
        drawRow('Total Violations on Record', report.total_violations, true);
        drawRow('Estimated Fines Avoided', `$${Number(report.estimated_fines_avoided).toLocaleString()}`);

        y += 4;
        if (Object.keys(report.violations_by_type).length) {
            drawSection('Violations by Type');
            let alt = true;
            for (const [type, count] of Object.entries(report.violations_by_type)) {
                drawRow(type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count, alt);
                alt = !alt;
            }
        }

        // Status message
        y += 4;
        const statusMsg = score >= 90
            ? 'Your fleet is performing excellently. Keep up the great work!'
            : score >= 75
                ? 'Good performance. Minor improvements are needed to reach excellent status.'
                : 'Action required. Please review violations and work to improve compliance.';
        doc.setFillColor(...scoreColor);
        doc.rect(14, y, W - 28, 14, 'F');
        doc.setTextColor(...white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(statusMsg, W / 2, y + 9, { align: 'center', maxWidth: W - 40 });
        y += 20;

        // Footer
        doc.setDrawColor(...navy);
        doc.setLineWidth(0.5);
        doc.line(14, 280, W - 14, 280);
        doc.setFontSize(8);
        doc.setTextColor(...grey);
        doc.setFont('helvetica', 'normal');
        doc.text('ELD Customer Portal — Confidential Compliance Report', W / 2, 285, { align: 'center' });
        doc.text(`Page 1`, W - 14, 285, { align: 'right' });

        doc.save(`compliance-report-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('PDF report downloaded!', 'success');
    } catch (error) {
        showToast(`Error generating report: ${error.message}`, 'error');
    }
}

// ── Toast notifications ────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}
