"""
WSGI entry point for production deployment
Use with Gunicorn: gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app
"""

import os
import logging
from pathlib import Path
from sqlalchemy import inspect

# Set environment if not set
if not os.getenv('FLASK_ENV'):
    os.environ['FLASK_ENV'] = 'production'

# Add project root to path
project_root = Path(__file__).parent
if str(project_root) not in os.sys.path:
    os.sys.path.insert(0, str(project_root))

# Import and create Flask app
from app import create_app, db

# Create Flask application instance
app = create_app(os.getenv('FLASK_ENV', 'production'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Initialize database on startup
try:
    with app.app_context():
        # Check if tables exist
        inspector = inspect(db.engine)
        if not inspector.get_table_names():
            logger.info("Creating database tables...")
            db.create_all()
            logger.info("Database tables created successfully")
        else:
            logger.info("Database tables already exist")
except Exception as e:
    logger.error(f"Error initializing database: {e}")
    raise

logger.info("ELD Portal application initialized successfully")

if __name__ == "__main__":
    # Should not run directly in production
    # Use: gunicorn wsgi:app
    app.run(host='0.0.0.0', port=5000)
