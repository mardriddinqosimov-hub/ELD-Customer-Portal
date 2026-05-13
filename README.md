# ELD Portal - Quick Start Guide

Get the ELD Customer Portal running in 5 minutes!

## ⚡ Quick Start (Development)

### Prerequisites
- Python 3.9+
- pip (Python package manager)
- Git

### Step 1: Clone the Project
```bash
cd ~/projects
git clone <repository-url>
cd eld-portal
```

### Step 2: Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Setup Environment
```bash
cp .env.example .env
# .env is already configured for development
```

### Step 5: Initialize Database
```bash
python
>>> from app import create_app, db
>>> app = create_app()
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

### Step 6: Run the Server
```bash
python app.py
```

### Step 7: Open in Browser
```
http://localhost:5000
```

### Step 8: Login with Demo Account
```
Email: admin@abctrucking.com
Password: demo123
```

---

## 🐳 Quick Start with Docker (Recommended)

### Prerequisites
- Docker Desktop installed
- 4GB RAM available

### One Command to Start
```bash
docker-compose up --build
```

### Access Application
```
http://localhost:5000
```

### Stop Application
```bash
docker-compose down
```

---

## 📋 What Gets Installed

### Backend
- Flask 2.3.3 (Web framework)
- SQLAlchemy 2.0.21 (Database ORM)
- PyJWT 2.8.1 (Authentication)
- bcrypt 4.0.1 (Password hashing)
- Gunicorn (WSGI server)

### Frontend
- HTML5 (Semantic markup)
- CSS3 (Modern styling)
- Vanilla JavaScript (No dependencies)

### Database
- SQLite (Development)
- PostgreSQL (Production)

---

## 🗂️ Project Structure

```
eld-portal/
├── app.py                    # Main Flask app
├── config.py                # Configuration
├── wsgi.py                  # Production entry point
├── requirements.txt         # Dependencies
├── .env.example            # Environment template
├── docker-compose.yml      # Docker setup
├── Dockerfile              # Docker image
│
├── templates/              # HTML templates
│   ├── index.html         # Landing/login
│   ├── dashboard.html     # Customer dashboard
│   └── base.html          # Base template
│
└── static/                # Static files
    ├── css/               # Stylesheets
    ├── js/                # JavaScript
    └── images/            # Images
```

---

## 🔐 Demo Credentials

**Email:** admin@abctrucking.com  
**Password:** demo123

---

## 🌐 Accessing Different Pages

### Public Pages
- Landing Page: http://localhost:5000/
- Login: Click "Login" button on landing page

### Logged In Pages
- Dashboard: http://localhost:5000/dashboard
- Violations: Click "Violations" in navigation
- Devices: Click "Devices" in navigation
- Support: Click "Support" in navigation
- FAQ: Click "FAQ" in navigation

---

## 🛠️ Common Tasks

### Change Database to PostgreSQL
1. Install PostgreSQL
2. Create database and user:
   ```sql
   CREATE USER eld_user WITH PASSWORD 'eld_password';
   CREATE DATABASE eld_portal OWNER eld_user;
   ```
3. Update .env:
   ```
   DATABASE_URL=postgresql://eld_user:eld_password@localhost:5432/eld_portal
   ```

### Create New User
```python
python
>>> from app import create_app, db
>>> from app.models import Company, User
>>> app = create_app()
>>> with app.app_context():
...     company = Company.query.first()
...     user = User(
...         company_id=company.id,
...         email='newuser@company.com',
...         first_name='New',
...         last_name='User',
...         role='user'
...     )
...     user.set_password('password123')
...     db.session.add(user)
...     db.session.commit()
...     print(f"User created: {user.email}")
```

### Reset Database
```bash
# Stop the server first
# Then:
rm eld_portal.db  # SQLite
python app.py     # Restart to create new database
```

### View Logs
```bash
# Flask development
python app.py

# Docker
docker-compose logs -f web
docker-compose logs -f db
```

---

## ⚠️ Troubleshooting

### Port 5000 Already in Use
```bash
# Find what's using port 5000
# Windows:
netstat -ano | findstr :5000
# Mac/Linux:
lsof -i :5000

# Kill the process and run again
```

### Virtual Environment Not Activating
```bash
# Make sure you're in the project directory
cd ~/projects/eld-portal

# Then activate:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# You should see (venv) in your terminal
```

### Import Errors
```bash
# Make sure dependencies are installed
pip install -r requirements.txt

# Or reinstall everything
pip install -r requirements.txt --force-reinstall
```

### Database Locked Error
```bash
# Delete the database file and restart
rm eld_portal.db
python app.py
```

### 502 Bad Gateway (Docker)
```bash
# Check if web container is running
docker-compose ps

# View logs
docker-compose logs web

# Restart services
docker-compose down
docker-compose up --build
```

---

## 📚 API Examples

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@abctrucking.com","password":"demo123"}'
```

### Get Dashboard Metrics
```bash
curl -X GET http://localhost:5000/api/dashboard/metrics \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Get Violations
```bash
curl -X GET http://localhost:5000/api/violations?days=30 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📞 Getting Help

### Check Logs
- Development: Look at terminal output
- Docker: `docker-compose logs -f web`

### View API Documentation
- See `COMPLETE_SETUP_GUIDE.txt` for full API docs

### Common Issues
- See Troubleshooting section above

---

## 🚀 Next Steps After Starting

1. ✅ Login with demo credentials
2. ✅ Explore the dashboard
3. ✅ Check violations
4. ✅ View devices
5. ✅ Create a support ticket
6. ✅ Read FAQ
7. ✅ Download compliance report

---

## 📦 Production Deployment

When ready for production:

1. Use PostgreSQL instead of SQLite
2. Generate strong SECRET_KEY
3. Use environment variables for all settings
4. Enable HTTPS/SSL
5. Use Gunicorn + Nginx
6. Set DEBUG=False
7. Configure backups
8. Set up monitoring

See `COMPLETE_SETUP_GUIDE.txt` for full production guide.

---

## 💡 Tips

- Use `docker-compose up --build` for clean Docker rebuild
- Use `docker-compose logs -f` to watch logs in real-time
- Use `python -m flask shell` to interact with app in Python
- Use `curl` to test API endpoints
- Use browser dev tools to debug frontend

---

## 🎉 You're Ready!

The ELD Portal is now running. Start exploring and building!

For production deployment instructions, see `COMPLETE_SETUP_GUIDE.txt`.
