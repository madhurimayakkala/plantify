import os
import sqlite3
import sys
from jinja2 import Environment, FileSystemLoader, TemplateSyntaxError

print("===== PROJECT DEBUG CHECK =====")
here = os.getcwd()
print("Working dir:", here)
print()

# 1) essential files
expected_files = ["app.py", "init_db.py", "requirements.txt"]
print("Checking presence of main files...")
for f in expected_files:
    path = os.path.join(here, f)
    print(f" - {f}: {'FOUND' if os.path.exists(path) else 'MISSING'}")
print()

# 2) folders
folders = ["templates", os.path.join("static","css"), os.path.join("static","js"), "instance"]
print("Folders:")
for fol in folders:
    print(f" - {fol}: {'FOUND' if os.path.isdir(os.path.join(here, fol)) else 'MISSING'}")
print()

# 3) list templates and their sizes
tpl_dir = os.path.join(here, "templates")
if os.path.isdir(tpl_dir):
    print("Templates (name : bytes):")
    for name in sorted(os.listdir(tpl_dir)):
        p = os.path.join(tpl_dir, name)
        try:
            size = os.path.getsize(p)
        except Exception:
            size = -1
        print(f" - {name} : {size}")
    print()
else:
    print("No templates folder found.\n")

# 4) check instance DB
db_path = os.path.join(here, "instance", "project.db")
print("DB path:", db_path)
if os.path.exists(db_path):
    print(" - project.db FOUND")
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        print(" - sqlite version:", sqlite3.sqlite_version)
        print(" - Tables:")
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        rows = cur.fetchall()
        for r in rows:
            print("    *", r[0])
        print()
        # show schema for goals if exists
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='goals';")
        if cur.fetchone():
            print("Schema for table 'goals':")
            cur.execute("PRAGMA table_info(goals);")
            for col in cur.fetchall():
                print("  ", col)
            print()
            # show up to 10 rows
            cur.execute("SELECT id, name, category, target_value, current_value, unit FROM goals LIMIT 10;")
            sample = cur.fetchall()
            print("Sample rows (up to 10):")
            if sample:
                for r in sample:
                    print("  ", r)
            else:
                print("  (no rows)")
        else:
            print(" - NOTE: table 'goals' does not exist.")
        conn.close()
    except Exception as e:
        print(" - ERROR when opening DB:", repr(e))
else:
    print(" - project.db NOT FOUND (run python init_db.py)")
print()

# 5) quick template syntax check using jinja2 (will point to syntax errors)
print("Doing Jinja2 syntax check of templates (this detects template parse errors)...")
try:
    env = Environment(loader=FileSystemLoader(tpl_dir))
    for fname in os.listdir(tpl_dir):
        if not fname.lower().endswith(".html"):
            continue
        fpath = os.path.join(tpl_dir, fname)
        try:
            src = open(fpath, "r", encoding="utf-8").read()
            env.parse(src)  # raises TemplateSyntaxError if broken
            print(f" - {fname}: ok")
        except TemplateSyntaxError as tse:
            print(f" - {fname}: TEMPLATE SYNTAX ERROR -> {tse.message} at line {tse.lineno}")
        except Exception as e:
            print(f" - {fname}: error reading/parsing -> {repr(e)}")
except Exception as e:
    print(" - Could not run Jinja2 check. Is jinja2 installed? Error:", repr(e))
print()

# 6) final guidance
print("=== DONE ===")
print("If anything is MISSING or shows 'TEMPLATE SYNTAX ERROR', copy-paste the exact lines above and send them to me.")
