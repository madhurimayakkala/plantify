# Plantify

A goal tracking app that represents your progress through plant growth.

update your progress → your plant grows  


## Features

- Track daily goals
- Visual progress through plant states
- Simple, clean interface
- Server-rendered (no JavaScript)


## Tech Stack

- Python (Flask)
- HTML, CSS (Jinja2)
- SQLite

## Run Locally

```bash
git clone https://github.com/madhurimayakkala/plantify.git
cd plantify
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python app.py


**## Project Structure**
app.py
init_db.py
templates/
static/
instance/
requirements.txt

**Notes**
No authentication yet
Uses local SQLite database
Focused on simplicity and core functionality
