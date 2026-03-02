#!/bin/bash
# JARVIS PythonAnywhere Setup Script
# Run this in the PythonAnywhere Bash console

echo "Setting up JARVIS on PythonAnywhere..."

# Install dependencies
pip3 install --user flask requests

# Create audio and artifacts directories
mkdir -p audio artifacts

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Go to Web tab"
echo "2. Click 'Add a new web app'"
echo "3. Choose 'Manual configuration' > Python 3.10"
echo "4. Set Source code: /home/antoniomilanyo/jarvis-ai"
echo "5. Set Working directory: /home/antoniomilanyo/jarvis-ai"
echo "6. Edit WSGI file — replace ALL contents with the contents of wsgi_pythonanywhere.py"
echo "7. Click Reload"
echo "8. Visit https://antoniomilanyo.pythonanywhere.com"
