import sqlite3
import os

# make sure instance/ exists
os.makedirs("instance", exist_ok=True)

# database path
db_path = "instance/project.db"

# connect to database (this creates the file if it doesn't exist)
conn = sqlite3.connect(db_path)

# create the goals table
conn.execute("""
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    target_value INTEGER NOT NULL,
    unit TEXT,
    current_value INTEGER DEFAULT 0
);
""")

conn.commit()
conn.close()

print("Database created successfully at:", db_path)
