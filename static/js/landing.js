function showLoginForm() {
    document.getElementById('login-modal').style.display = 'block';
}

function closeLoginForm() {
    document.getElementById('login-modal').style.display = 'none';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`${tabName}-tab`).classList.add('active');
    const button = document.querySelector(`[data-tab="${tabName}"]`);
    if (button) {
        button.classList.add('active');
    }
}

function persistSession(response) {
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify({
        id: response.user_id,
        company_id: response.company_id,
        company_name: response.company_name,
        email: response.email,
        first_name: response.first_name
    }));
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const response = await api.login(email, password);
        persistSession(response);
        window.location.href = '/dashboard';
    } catch (error) {
        alert(`Login failed: ${error.message}`);
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const companyName = document.getElementById('register-company').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const firstName = document.getElementById('register-first-name').value.trim();
    const lastName = document.getElementById('register-last-name').value.trim();
    const password = document.getElementById('register-password').value;

    try {
        await api.register(companyName, email, password, firstName, lastName);
        const loginResponse = await api.login(email, password);
        persistSession(loginResponse);
        window.location.href = '/dashboard';
    } catch (error) {
        alert(`Registration failed: ${error.message}`);
    }
}

window.addEventListener('click', event => {
    const modal = document.getElementById('login-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});
