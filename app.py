"""
ELD CUSTOMER PORTAL - MAIN APPLICATION
Professional Flask Backend for ELD Compliance Management
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import jwt
import bcrypt
import os
from dotenv import load_dotenv
from config import get_config

load_dotenv()

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}

def allowed_image(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

app = Flask(__name__,
            static_folder='static',
            static_url_path='/static',
            template_folder='templates')

db = SQLAlchemy()


def create_app(env=None):
    """Configure and return the Flask application instance."""
    config_object = get_config(env)
    app.config.from_object(config_object)

    origins = os.getenv('CORS_ORIGINS')
    cors_origins = [origin.strip() for origin in origins.split(',')] if origins else app.config.get('CORS_ORIGINS', [])
    CORS(app, resources={r"/api/*": {"origins": cors_origins}})

    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///eld_portal.db'

    if 'sqlalchemy' not in app.extensions:
        db.init_app(app)

    return app

# ============================================================================
# DATABASE MODELS
# ============================================================================

class Company(db.Model):
    __tablename__ = 'companies'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    subscription_tier = db.Column(db.String(50), default='basic')
    num_devices = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    users = db.relationship('User', backref='company', lazy=True, cascade='all, delete-orphan')
    violations = db.relationship('Violation', backref='company', lazy=True, cascade='all, delete-orphan')
    devices = db.relationship('Device', backref='company', lazy=True, cascade='all, delete-orphan')
    support_tickets = db.relationship('SupportTicket', backref='company', lazy=True, cascade='all, delete-orphan')
    inspection_reports = db.relationship('InspectionReport', backref='company', lazy=True, cascade='all, delete-orphan')

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    
    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def generate_token(self):
        payload = {
            'user_id': self.id,
            'company_id': self.company_id,
            'email': self.email,
            'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
        }
        return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

class Device(db.Model):
    __tablename__ = 'devices'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    device_id = db.Column(db.String(100), unique=True, nullable=False)
    device_name = db.Column(db.String(255), nullable=False)
    driver_name = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default='active')
    last_sync = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Violation(db.Model):
    __tablename__ = 'violations'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    driver_name = db.Column(db.String(255), nullable=False)
    violation_type = db.Column(db.String(100), nullable=False)
    severity = db.Column(db.String(50), default='medium')
    description = db.Column(db.Text, nullable=False)
    violation_date = db.Column(db.DateTime, nullable=False)
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='pending')
    action_taken = db.Column(db.Text, nullable=True)
    potential_fine = db.Column(db.Float, default=1000.0)

class SupportTicket(db.Model):
    __tablename__ = 'support_tickets'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    ticket_number = db.Column(db.String(50), unique=True, nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default='open')
    priority = db.Column(db.String(50), default='normal')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)

class FAQ(db.Model):
    __tablename__ = 'faqs'
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(500), nullable=False)
    answer = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

class InspectionReport(db.Model):
    __tablename__ = 'inspection_reports'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='pending_review')
    report_type = db.Column(db.String(50), nullable=True)
    driver_name = db.Column(db.String(255), nullable=True)
    severity = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    linked_violation_id = db.Column(db.Integer, nullable=True)
    truck_id = db.Column(db.Integer, nullable=True)

# ============================================================================
# AUTHENTICATION
# ============================================================================

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = db.session.get(User, data['user_id'])
            if not current_user:
                return jsonify({'message': 'User not found'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    
    if not all(k in data for k in ['company_name', 'email', 'password', 'first_name', 'last_name']):
        return jsonify({'message': 'Missing required fields'}), 400
    if len(data['password']) < 8:
        return jsonify({'message': 'Password must be at least 8 characters'}), 400
    
    email = data['email'].strip().lower()
    if Company.query.filter_by(email=email).first() or User.query.filter_by(email=email).first():
        return jsonify({'message': 'Company already exists'}), 400
    
    company = Company(name=data['company_name'].strip(), email=email)
    user = User(company=company, email=email, first_name=data['first_name'].strip(), 
                last_name=data['last_name'].strip(), role='admin')
    user.set_password(data['password'])
    
    db.session.add(company)
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'Registration successful', 'user_id': user.id, 'company_id': company.id}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing credentials'}), 400
    
    user = User.query.filter_by(email=data['email'].strip().lower(), is_active=True).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid email or password'}), 401
    
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'token': user.generate_token(),
        'user_id': user.id,
        'company_id': user.company_id,
        'company_name': user.company.name,
        'first_name': user.first_name,
        'email': user.email
    }), 200

@app.route('/api/dashboard/metrics', methods=['GET'])
@token_required
def get_dashboard_metrics(current_user):
    company = current_user.company
    total_devices = Device.query.filter_by(company_id=company.id).count()
    active_devices = Device.query.filter_by(company_id=company.id, status='active').count()
    violations = Violation.query.filter_by(company_id=company.id).order_by(Violation.detected_at.desc()).all()
    violations_month = [v for v in violations if (datetime.utcnow() - v.detected_at).days <= 30]
    
    compliance_score = 100
    if total_devices > 0:
        compliance_score = max(0, 100 - (len(violations_month) / total_devices * 10))
    
    return jsonify({
        'compliance_score': round(compliance_score, 1),
        'total_devices': total_devices,
        'active_devices': active_devices,
        'violations_month': len(violations_month),
        'total_violations': len(violations),
        'estimated_fines_avoided': len(violations) * 1000,
        'company_name': company.name,
        'subscription_tier': company.subscription_tier
    }), 200

@app.route('/api/violations', methods=['GET'])
@token_required
def get_violations(current_user):
    company = current_user.company
    days = request.args.get('days', 30, type=int)
    violations = Violation.query.filter_by(company_id=company.id).all()
    
    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        violations = [v for v in violations if v.detected_at >= cutoff_date]
    
    violations_data = [{
        'id': v.id, 'driver_name': v.driver_name, 'violation_type': v.violation_type,
        'severity': v.severity, 'description': v.description, 'detected_at': v.detected_at.isoformat(),
        'status': v.status, 'potential_fine': v.potential_fine
    } for v in violations]
    
    return jsonify({'violations': violations_data, 'count': len(violations_data)}), 200

@app.route('/api/violations/<int:violation_id>/acknowledge', methods=['POST'])
@token_required
def acknowledge_violation(current_user, violation_id):
    data = request.get_json(silent=True) or {}
    violation = Violation.query.filter_by(id=violation_id, company_id=current_user.company_id).first()
    
    if not violation:
        return jsonify({'message': 'Violation not found'}), 404
    
    violation.status = 'acknowledged'
    violation.action_taken = data.get('action_taken', '')
    db.session.commit()
    
    return jsonify({'message': 'Violation acknowledged'}), 200

@app.route('/api/devices', methods=['GET'])
@token_required
def get_devices(current_user):
    company = current_user.company
    devices = Device.query.filter_by(company_id=company.id).all()
    devices_data = []
    for d in devices:
        reports = InspectionReport.query.filter_by(company_id=company.id, truck_id=d.id).all()
        devices_data.append({
            'id': d.id, 'device_id': d.device_id, 'device_name': d.device_name,
            'driver_name': d.driver_name,
            'status': d.status, 'last_sync': d.last_sync.isoformat(), 'created_at': d.created_at.isoformat(),
            'inspections_total': len(reports),
            'eld_violations': sum(1 for r in reports if r.report_type == 'eld_violation')
        })
    return jsonify({'devices': devices_data, 'count': len(devices_data)}), 200

@app.route('/api/faqs', methods=['GET'])
def get_faqs():
    faqs = FAQ.query.filter_by(is_active=True).order_by(FAQ.order).all()
    faqs_data = [{'id': f.id, 'question': f.question, 'answer': f.answer, 'category': f.category} for f in faqs]
    return jsonify({'faqs': faqs_data, 'count': len(faqs_data)}), 200

@app.route('/api/support-tickets', methods=['GET'])
@token_required
def get_support_tickets(current_user):
    company = current_user.company
    tickets = SupportTicket.query.filter_by(company_id=company.id).order_by(SupportTicket.created_at.desc()).all()
    tickets_data = [{
        'id': t.id, 'ticket_number': t.ticket_number, 'subject': t.subject, 'description': t.description,
        'status': t.status, 'priority': t.priority, 'created_at': t.created_at.isoformat(), 'updated_at': t.updated_at.isoformat()
    } for t in tickets]
    return jsonify({'tickets': tickets_data, 'count': len(tickets_data)}), 200

@app.route('/api/support-tickets', methods=['POST'])
@token_required
def create_support_ticket(current_user):
    data = request.get_json(silent=True) or {}
    if not data.get('subject') or not data.get('description'):
        return jsonify({'message': 'Missing required fields'}), 400
    if data.get('priority', 'normal') not in {'low', 'normal', 'high', 'urgent'}:
        return jsonify({'message': 'Invalid priority'}), 400
    
    last_ticket = SupportTicket.query.order_by(SupportTicket.id.desc()).first()
    ticket_number = f"TKT-{(last_ticket.id + 1 if last_ticket else 1):05d}"
    
    ticket = SupportTicket(
        company_id=current_user.company_id, ticket_number=ticket_number,
        subject=data['subject'].strip(), description=data['description'].strip(), priority=data.get('priority', 'normal')
    )
    
    db.session.add(ticket)
    db.session.commit()
    
    return jsonify({'message': 'Ticket created', 'ticket_number': ticket_number, 'id': ticket.id}), 201

@app.route('/api/compliance-report', methods=['GET'])
@token_required
def get_compliance_report(current_user):
    company = current_user.company
    devices = Device.query.filter_by(company_id=company.id).all()
    violations = Violation.query.filter_by(company_id=company.id).all()
    
    violations_by_type = {}
    for v in violations:
        violations_by_type[v.violation_type] = violations_by_type.get(v.violation_type, 0) + 1
    
    return jsonify({
        'report_date': datetime.utcnow().isoformat(),
        'company_name': company.name,
        'total_devices': len(devices),
        'total_violations': len(violations),
        'violations_by_type': violations_by_type,
        'estimated_fines_avoided': len(violations) * 1000
    }), 200

@app.route('/api/trucks', methods=['POST'])
@token_required
def add_truck(current_user):
    data = request.get_json(silent=True) or {}
    if not data.get('truck_name') or not data.get('truck_id'):
        return jsonify({'message': 'Truck name and ID are required'}), 400

    truck_id = data['truck_id'].strip().upper()
    if Device.query.filter_by(device_id=truck_id).first():
        return jsonify({'message': 'Truck ID already exists'}), 400

    truck = Device(
        company_id=current_user.company_id,
        device_id=truck_id,
        device_name=data['truck_name'].strip(),
        driver_name=(data.get('driver_name') or '').strip() or None,
        status='active'
    )
    db.session.add(truck)
    db.session.commit()
    return jsonify({'message': 'Truck added successfully', 'id': truck.id}), 201


@app.route('/api/trucks/<int:truck_id>', methods=['PATCH'])
@token_required
def update_truck(current_user, truck_id):
    truck = Device.query.filter_by(id=truck_id, company_id=current_user.company_id).first()
    if not truck:
        return jsonify({'message': 'Truck not found'}), 404

    data = request.get_json(silent=True) or {}
    if 'device_name' in data:
        name = (data['device_name'] or '').strip()
        if not name:
            return jsonify({'message': 'Truck name cannot be empty'}), 400
        truck.device_name = name
    if 'device_id' in data:
        new_id = (data['device_id'] or '').strip().upper()
        if not new_id:
            return jsonify({'message': 'Truck ID cannot be empty'}), 400
        conflict = Device.query.filter_by(device_id=new_id).first()
        if conflict and conflict.id != truck_id:
            return jsonify({'message': 'Truck ID already in use'}), 400
        truck.device_id = new_id
    if 'driver_name' in data:
        truck.driver_name = (data['driver_name'] or '').strip() or None
    if 'status' in data:
        if data['status'] not in {'active', 'inactive'}:
            return jsonify({'message': 'Invalid status'}), 400
        truck.status = data['status']

    db.session.commit()
    return jsonify({'message': 'Truck updated', 'id': truck.id}), 200


@app.route('/api/trucks/<int:truck_id>', methods=['DELETE'])
@token_required
def delete_truck(current_user, truck_id):
    truck = Device.query.filter_by(id=truck_id, company_id=current_user.company_id).first()
    if not truck:
        return jsonify({'message': 'Truck not found'}), 404
    db.session.delete(truck)
    db.session.commit()
    return jsonify({'message': 'Truck removed'}), 200


@app.route('/api/upload/violations', methods=['POST'])
@token_required
def upload_violations(current_user):
    data = request.get_json(silent=True) or {}
    records = data.get('violations', [])
    if not records:
        return jsonify({'message': 'No violation records provided'}), 400

    valid_severities = {'critical', 'high', 'medium', 'low'}
    added = 0
    errors = []

    for i, v in enumerate(records[:500]):
        try:
            severity = str(v.get('severity', 'medium')).lower().strip()
            if severity not in valid_severities:
                severity = 'medium'
            vdate_str = v.get('violation_date', '')
            try:
                vdate = datetime.fromisoformat(str(vdate_str)) if vdate_str else datetime.utcnow()
            except (ValueError, TypeError):
                vdate = datetime.utcnow()
            violation = Violation(
                company_id=current_user.company_id,
                driver_name=str(v.get('driver_name', 'Unknown Driver'))[:255].strip(),
                violation_type=str(v.get('violation_type', 'unspecified'))[:100].strip(),
                severity=severity,
                description=str(v.get('description', 'Uploaded record')).strip(),
                violation_date=vdate,
                potential_fine=max(0.0, float(v.get('potential_fine', 1000.0)))
            )
            db.session.add(violation)
            added += 1
        except Exception as e:
            errors.append(f'Row {i+1}: {str(e)}')

    db.session.commit()
    return jsonify({'message': f'{added} violations uploaded successfully', 'added': added, 'errors': errors[:10]}), 201


@app.route('/api/upload/trucks', methods=['POST'])
@token_required
def upload_trucks(current_user):
    data = request.get_json(silent=True) or {}
    records = data.get('trucks', [])
    if not records:
        return jsonify({'message': 'No truck records provided'}), 400

    added = 0
    skipped = 0
    for t in records[:200]:
        try:
            truck_id = str(t.get('truck_id', '')).strip().upper()
            truck_name = str(t.get('truck_name', '')).strip()
            if not truck_id or not truck_name:
                skipped += 1
                continue
            if Device.query.filter_by(device_id=truck_id).first():
                skipped += 1
                continue
            db.session.add(Device(
                company_id=current_user.company_id,
                device_id=truck_id,
                device_name=truck_name,
                status='active'
            ))
            added += 1
        except Exception:
            skipped += 1

    db.session.commit()
    return jsonify({'message': f'{added} trucks added, {skipped} skipped', 'added': added, 'skipped': skipped}), 201


@app.route('/api/upload/images', methods=['POST'])
@token_required
def upload_image(current_user):
    if 'file' not in request.files:
        return jsonify({'message': 'No file provided'}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'message': 'No file selected'}), 400
    if not allowed_image(file.filename):
        return jsonify({'message': 'Only JPG, JPEG, and PNG files are allowed'}), 400

    company_folder = os.path.join(UPLOAD_FOLDER, str(current_user.company_id))
    os.makedirs(company_folder, exist_ok=True)

    ext = file.filename.rsplit('.', 1)[1].lower()
    timestamp = int(datetime.utcnow().timestamp())
    safe_base = secure_filename(file.filename.rsplit('.', 1)[0])[:40] or 'image'
    filename = f"{timestamp}_{safe_base}.{ext}"
    url = f'/static/uploads/{current_user.company_id}/{filename}'
    file.save(os.path.join(company_folder, filename))

    report = InspectionReport(company_id=current_user.company_id, filename=filename, url=url)
    db.session.add(report)
    db.session.commit()

    return jsonify({
        'message': 'Image uploaded successfully — pending review in Reports tab',
        'filename': filename,
        'url': url,
        'report_id': report.id
    }), 201


@app.route('/api/reports', methods=['GET'])
@token_required
def get_reports(current_user):
    reports = InspectionReport.query.filter_by(company_id=current_user.company_id)\
        .order_by(InspectionReport.uploaded_at.desc()).all()
    result = []
    for r in reports:
        truck = Device.query.filter_by(id=r.truck_id, company_id=current_user.company_id).first() if r.truck_id else None
        result.append({
            'id': r.id, 'filename': r.filename, 'url': r.url,
            'uploaded_at': r.uploaded_at.isoformat(),
            'status': r.status, 'report_type': r.report_type,
            'driver_name': r.driver_name, 'severity': r.severity,
            'notes': r.notes, 'linked_violation_id': r.linked_violation_id,
            'truck_id': r.truck_id,
            'truck_name': truck.device_name if truck else None,
            'truck_unit_id': truck.device_id if truck else None
        })
    return jsonify({'reports': result}), 200


@app.route('/api/reports/<int:report_id>', methods=['DELETE'])
@token_required
def delete_report(current_user, report_id):
    report = InspectionReport.query.filter_by(id=report_id, company_id=current_user.company_id).first()
    if not report:
        return jsonify({'message': 'Report not found'}), 404

    file_path = os.path.join(UPLOAD_FOLDER, str(current_user.company_id), os.path.basename(report.filename))
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass

    db.session.delete(report)
    db.session.commit()
    return jsonify({'message': 'Report deleted'}), 200


@app.route('/api/reports/<int:report_id>/review', methods=['POST'])
@token_required
def review_report(current_user, report_id):
    report = InspectionReport.query.filter_by(id=report_id, company_id=current_user.company_id).first()
    if not report:
        return jsonify({'message': 'Report not found'}), 404

    data = request.get_json(silent=True) or {}
    report_type = data.get('report_type', 'clean')
    if report_type not in {'eld_violation', 'other_violation', 'clean'}:
        return jsonify({'message': 'Invalid report type'}), 400

    report.status = 'reviewed'
    report.report_type = report_type
    report.driver_name = (data.get('driver_name') or '').strip() or None
    report.notes = (data.get('notes') or '').strip() or None
    report.severity = data.get('severity', 'medium')
    truck_id = data.get('truck_id')
    report.truck_id = int(truck_id) if truck_id else None

    if report_type == 'eld_violation':
        violation = Violation(
            company_id=current_user.company_id,
            driver_name=report.driver_name or 'Unknown Driver',
            violation_type='eld_inspection_violation',
            severity=report.severity or 'medium',
            description=report.notes or 'Violation detected from uploaded inspection report',
            violation_date=datetime.utcnow(),
            potential_fine=2500.0
        )
        db.session.add(violation)
        db.session.flush()
        report.linked_violation_id = violation.id

    db.session.commit()
    return jsonify({'message': 'Report reviewed successfully', 'report_type': report_type}), 200


@app.route('/api/upload/images', methods=['GET'])
@token_required
def get_images(current_user):
    company_folder = os.path.join(UPLOAD_FOLDER, str(current_user.company_id))
    if not os.path.exists(company_folder):
        return jsonify({'images': []}), 200
    images = []
    for fname in sorted(os.listdir(company_folder), reverse=True):
        if fname.rsplit('.', 1)[-1].lower() in ALLOWED_IMAGE_EXTENSIONS:
            images.append({
                'filename': fname,
                'url': f'/static/uploads/{current_user.company_id}/{fname}'
            })
    return jsonify({'images': images}), 200


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    db.session.execute(db.text('SELECT 1'))
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'eld-portal'
    }), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'message': 'Internal server error'}), 500

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def migrate_db():
    """Add new columns to existing tables without dropping data."""
    migrations = [
        'ALTER TABLE devices ADD COLUMN driver_name VARCHAR(255)',
        'ALTER TABLE inspection_reports ADD COLUMN truck_id INTEGER',
    ]
    for sql in migrations:
        try:
            db.session.execute(db.text(sql))
            db.session.commit()
        except Exception:
            db.session.rollback()

def init_db():
    with app.app_context():
        db.create_all()
        migrate_db()
        
        if Company.query.first():
            print("Database already initialized")
            return
        
        company = Company(name='ABC Trucking', email='admin@abctrucking.com',
                         phone='1-800-ABC-TRUCK', address='123 Main St, Anytown USA',
                         subscription_tier='business', num_devices=45)
        db.session.add(company)
        db.session.flush()
        
        user = User(company_id=company.id, email='admin@abctrucking.com',
                   first_name='John', last_name='Smith', role='admin')
        user.set_password('demo123')
        db.session.add(user)
        
        for i in range(1, 46):
            device = Device(company_id=company.id, device_id=f'DEVICE-{i:03d}',
                          device_name=f'Device {i}', status='active' if i <= 43 else 'inactive')
            db.session.add(device)
        
        violation_types = ['excessive_hours', 'missing_logs', 'improper_status']
        severities = ['critical', 'high', 'medium', 'low']
        drivers = ['John Smith', 'Jane Doe', 'Mike Johnson', 'Sarah Williams']
        
        for i in range(5):
            violation = Violation(
                company_id=company.id, driver_name=drivers[i % len(drivers)],
                violation_type=violation_types[i % len(violation_types)],
                severity=severities[i % len(severities)], description=f'Sample violation {i+1}',
                violation_date=datetime.utcnow() - timedelta(days=i), potential_fine=5000 if i % 2 == 0 else 1000
            )
            db.session.add(violation)
        
        faqs = [
            FAQ(question='What is an HOS violation?', 
                answer='HOS (Hours of Service) violations occur when drivers exceed maximum driving hours.',
                category='HOS', order=1),
            FAQ(question='How can I prevent violations?',
                answer='Monitor your portal daily for alerts and schedule breaks before drivers hit limits.',
                category='HOS', order=2),
            FAQ(question='How do I submit a support ticket?',
                answer='Click Submit Ticket button and fill in the details.',
                category='Support', order=3),
            FAQ(question='Can I download reports?',
                answer='Yes, go to Reports section and select date range.',
                category='Reports', order=4),
        ]
        for faq in faqs:
            db.session.add(faq)
        
        db.session.commit()
        print("Database initialized with sample data")
        print("Demo login: admin@abctrucking.com / demo123")

if __name__ == '__main__':
    create_app(os.getenv('FLASK_ENV', 'development'))
    init_db()
    print("ELD Portal starting on http://localhost:5000")
    print("Demo: admin@abctrucking.com / demo123")
    app.run(debug=app.config.get('DEBUG', False), host='0.0.0.0', port=5000)

