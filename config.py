"""Application Configuration Settings"""

import os
from dotenv import load_dotenv

load_dotenv()


def csv_env(name, default):
    value = os.getenv(name)
    if not value:
        return default
    return [item.strip() for item in value.split(',') if item.strip()]

class Config:
    """Base configuration shared across all environments"""
    
    # Flask
    FLASK_APP = os.getenv('FLASK_APP', 'app.py')
    
    # Database
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_RECORD_QUERIES = True
    SQLALCHEMY_ECHO = False
    JSON_SORT_KEYS = False
    
    # JWT Configuration
    JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', 24))
    JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
    
    # Security
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_NAME = 'eld_portal_session'
    SESSION_COOKIE_AGE = 604800  # 7 days
    
    # CORS
    CORS_ORIGINS = csv_env('CORS_ORIGINS', ['http://localhost:5000', 'http://127.0.0.1:5000'])
    
    # Pagination
    ITEMS_PER_PAGE = 20
    
    # File Upload
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx'}
    
    # Caching
    CACHE_TYPE = 'simple'
    CACHE_DEFAULT_TIMEOUT = 300


class DevelopmentConfig(Config):
    """Development Configuration"""
    
    DEBUG = True
    TESTING = False
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'sqlite:///eld_portal.db'
    )
    SQLALCHEMY_ECHO = True
    
    # Security
    SECRET_KEY = os.getenv(
        'SECRET_KEY',
        'dev-key-change-in-production-123456789'
    )
    SESSION_COOKIE_SECURE = False
    
    # Logging
    LOG_LEVEL = 'DEBUG'


class TestingConfig(Config):
    """Testing Configuration"""
    
    TESTING = True
    DEBUG = True
    
    # Use in-memory SQLite for tests
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    
    # Disable CSRF for tests
    WTF_CSRF_ENABLED = False
    
    SECRET_KEY = 'test-secret-key'


class ProductionConfig(Config):
    """Production Configuration"""
    
    DEBUG = False
    TESTING = False
    
    # Database - MUST be set in environment
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    
    # Secret Key - MUST be set in environment
    SECRET_KEY = os.getenv('SECRET_KEY')
    
    # Security - Enhanced for production
    SESSION_COOKIE_SECURE = True
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hour
    CORS_ORIGINS = csv_env('CORS_ORIGINS', [])
    
    # Logging
    LOG_LEVEL = 'INFO'
    
    # Performance
    SEND_FILE_MAX_AGE_DEFAULT = 31536000  # 1 year for static files


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}


def get_config(env=None):
    """Get configuration object for the given environment"""
    if env is None:
        env = os.getenv('FLASK_ENV', 'development')

    selected = config.get(env, config['default'])
    if selected is ProductionConfig:
        if not selected.SQLALCHEMY_DATABASE_URI:
            raise ValueError(
                "DATABASE_URL environment variable is not set. "
                "Please configure database connection before running."
            )
        if not selected.SECRET_KEY or len(selected.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY environment variable must be set and at least 32 characters. "
                "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )

    return selected
