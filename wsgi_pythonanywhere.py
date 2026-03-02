#!/usr/bin/env python3
"""PythonAnywhere WSGI Configuration
   
   Copy this content to your WSGI file at:
   /var/www/antoniomilanyo_pythonanywhere_com_wsgi.py
"""
import sys
import os

project_home = '/home/antoniomilanyo/jarvis-ai'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

os.chdir(project_home)

from flask_app import app as application
