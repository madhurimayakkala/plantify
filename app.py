from flask import Flask, render_template, request, redirect, url_for
import sqlite3
import os

app = Flask(__name__)

# === DATABASE PATH FIX FOR RENDER ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")

# Make sure instance/ exists (Render needs this)
os.makedirs(INSTANCE_DIR, exist_ok=True)

DB = os.path.join(INSTANCE_DIR, "project.db")


def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def compute_stage(percentage: int) -> str:
    if percentage <= 20:
        return "seed"
    if percentage <= 40:
        return "sprout"
    if percentage <= 60:
        return "baby"
    if percentage <= 80:
        return "bloom"
    return "full"


def row_to_goal_dict(row):
    gid = row["id"] if "id" in row.keys() else None
    name = row["name"] if row["name"] is not None else "Untitled Goal"
    category = row["category"] if row["category"] is not None else "General"

    try:
        target = int(row["target_value"]) if row["target_value"] is not None else 0
    except Exception:
        target = 0

    try:
        current = int(row["current_value"]) if row["current_value"] is not None else 0
    except Exception:
        current = 0

    unit = row["unit"] if row["unit"] is not None else ""

    percentage = 0
    if target > 0:
        percentage = int((current / target) * 100)
        if percentage > 100:
            percentage = 100

    stage = compute_stage(percentage)

    return {
        "id": gid,
        "name": name,
        "category": category,
        "target_value": target,
        "current_value": current,
        "unit": unit,
        "percentage": percentage,
        "stage": stage
    }


@app.route("/")
def dashboard():
    conn = get_db()
    rows = conn.execute("SELECT * FROM goals ORDER BY id DESC").fetchall()
    conn.close()
    goals = [row_to_goal_dict(r) for r in rows]
    return render_template("dashboard.html", goals=goals)


@app.route("/goals", methods=["GET", "POST"])
def goals():
    conn = get_db()

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        category = request.form.get("category", "").strip()

        try:
            target_value = int(request.form.get("target_value", "0"))
        except ValueError:
            target_value = 0

        unit = request.form.get("unit", "").strip()

        if name and target_value > 0:
            conn.execute(
                "INSERT INTO goals (name, category, target_value, unit) VALUES (?, ?, ?, ?)",
                (name, category, target_value, unit)
            )
            conn.commit()

        conn.close()
        return redirect(url_for("goals"))

    rows = conn.execute("SELECT * FROM goals ORDER BY id DESC").fetchall()
    conn.close()
    goals = [row_to_goal_dict(r) for r in rows]
    return render_template("goals.html", goals=goals)


@app.route("/goals/update/<int:id>", methods=["POST"])
def update(id):
    try:
        new_value = int(request.form.get("current_value", "0"))
    except ValueError:
        new_value = 0

    conn = get_db()
    conn.execute("UPDATE goals SET current_value = ? WHERE id = ?", (new_value, id))
    conn.commit()
    conn.close()
    return redirect(url_for("dashboard"))


@app.route("/goals/delete/<int:id>")
def delete(id):
    conn = get_db()
    conn.execute("DELETE FROM goals WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return redirect(url_for("goals"))


if __name__ == "__main__":
    # Render needs 0.0.0.0 + the PORT environment variable
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
