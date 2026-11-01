"""
Shared Flask extension instances.

Kept in a separate module so app.py and the service layer can import them
without creating circular imports (e.g. auth needs login_manager, app needs
both, services import neither).
"""
from flask_login import LoginManager

login_manager = LoginManager()
login_manager.login_view = "login"          # where unauthorized requests are redirected
login_manager.login_message = "Please sign in to continue."
login_manager.login_message_category = "warning"
login_manager.session_protection = "strong"
