#!/usr/bin/env python3
"""WSGI configuration for PythonAnywhere.

Replace USERNAME with your PythonAnywhere username.
This file goes at: /var/www/USERNAME_pythonanywhere_com_wsgi.py
"""
import sys
import os

# Add your project directory to the sys.path
project_home = '/home/USERNAME/jarvis'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

os.chdir(project_home)

# Import Flask app
from flask_app import app as application
