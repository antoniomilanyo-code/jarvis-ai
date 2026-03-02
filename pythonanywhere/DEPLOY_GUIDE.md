# JARVIS AI — PythonAnywhere Deployment Guide

## Quick Setup (5 minutes)

### Step 1: Create PythonAnywhere Account
1. Go to [pythonanywhere.com](https://www.pythonanywhere.com)
2. Sign up for a **free** "Beginner" account
3. Your site will be at: `https://USERNAME.pythonanywhere.com`

### Step 2: Upload Files
1. Go to **Files** tab in PythonAnywhere
2. Create folder: `/home/USERNAME/jarvis/`
3. Upload these files to `/home/USERNAME/jarvis/`:
   - `flask_app.py`
   - `requirements.txt`
   - `jarvis.db`
   - `wsgi.py`
4. Create `/home/USERNAME/jarvis/static/` folder
5. Upload the entire `static/` folder contents (index.html, js/, audio/, etc.)

**Alternative: Use Git (easier)**
```bash
# In PythonAnywhere Bash console:
cd ~
git clone https://github.com/antoniomilanyo-code/jarvis-ai.git jarvis
cd jarvis
pip install -r requirements.txt
```

### Step 3: Create Web App
1. Go to **Web** tab
2. Click **"Add a new web app"**
3. Choose **"Manual configuration"** (NOT Flask)
4. Select **Python 3.10** (or latest available)

### Step 4: Configure WSGI
1. In the Web tab, click on the **WSGI configuration file** link
2. **Replace ALL contents** with:

```python
import sys
import os

project_home = '/home/USERNAME/jarvis'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

os.chdir(project_home)

from flask_app import app as application
```

3. Save the file

### Step 5: Set Source Code Directory
1. In the Web tab, set **Source code** to: `/home/USERNAME/jarvis`
2. Set **Working directory** to: `/home/USERNAME/jarvis`

### Step 6: Install Dependencies
1. Go to **Consoles** tab → Open **Bash** console
2. Run:
```bash
cd ~/jarvis
pip3 install --user flask requests
```

### Step 7: Reload & Test
1. Go back to **Web** tab
2. Click the green **"Reload"** button
3. Visit: `https://USERNAME.pythonanywhere.com`
4. You should see the JARVIS dashboard
5. Login with: `antonio` / `jarvis2026`

---

## Updating JARVIS

### From GitHub:
```bash
cd ~/jarvis
git pull origin main
```
Then click **Reload** in Web tab.

---

## Free Tier Limits
- 512MB disk space
- 100 seconds CPU/day
- 1 web app
- HTTPS included
- Web app sleeps after inactivity but wakes on request
