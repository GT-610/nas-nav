# This project is still **under heavy development**.

# nas-nav
Lightweight navigation page for self-hosted NAS

## Features

- Simple web interface for NAS service navigation
- Flask-based backend with RESTful API
- SQLAlchemy for database management
- CORS support for API endpoints
- User authentication support
- Easy migration system

## Installation

### Prerequisites
- Python 3.11+
- Poetry (recommended)

### Using Poetry
```bash
# Install Poetry if not already installed
pip install poetry

# Or use the official installer
curl -sSL https://install.python-poetry.org | python3 -

# Clone repository
git clone https://github.com/yourusername/nas-nav.git
cd nas-nav

# Install dependencies
poetry install

# Initialize database
poetry run flask db upgrade

# Run application
poetry run flask run
```
### Using `pip`
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e .
flask init-db
flask run
```

## Configuration
Create a .env file in the root directory with environment variables:

```bash
FLASK_APP=nasnav
FLASK_ENV=development
SECRET_KEY=your-secret-key
DATABASE_URI=sqlite:///instance/nasnav.db
```

## Usage
Access the web interface at http://localhost:5000 after starting the server.

## Default endpoints:
Web UI: `/`
API Base: `/api/`

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright © 2025 GT610

