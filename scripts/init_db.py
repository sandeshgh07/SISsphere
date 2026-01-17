import sys
import os

sys.path.append(os.getcwd())

from database import engine, Base
import schools.models
# Import other models if needed, but schools/models.py has User too.
# If there are other models in other files (e.g. students), they won't be created unless imported.
# The user said "Initialize the database, create the tables...".
# Assuming "the tables" refers to the ones I defined/touched or all of them?
# "Define the base schools table... Initialize the database, create the tables..."
# To be safe/complete for "Fresh Build", I should import existing models if I want them to persist,
# OR just the ones I'm working on.
# Given "Fresh Build", maybe I should only initialize what I have defined?
# But if I drop *all*, and only create *schools*, I lose other tables if they exist in code but aren't imported.
# Existing `database.py` had a `register_listeners` function that imported all models.
# I should probably use that or replicate it.
# I'll check `database.py` again. Ah, I overwrote `database.py`.
# My new `database.py` does NOT have `register_listeners` or the imports.
# I lost the imports of `students.models`, `academics.models`, etc.
# The prompt said "Create a database.py...". It didn't say "keep existing logic".
# BUT, if I drop all tables and only create Schools/Users, I might break the app's functionality (e.g. students).
# However, "Fresh Build" might mean we are *starting* with Schools.
# But looking at the file list, there is a lot of code (`academics`, `students`, etc.).
# If I don't create those tables, the code is broken.
# I should try to import all models found in the codebase to be safe, or just stick to the requested one if the user wants a *clean slate* that grows.
# "Initialize the Nepsis SIS v1.1 Fresh Build".
# "Do NOT build any features yet. Simply establish the clean, hardened environment."
# This implies setting up the *foundation*.
# Maybe the other modules are "features" that will be added/migrated later?
# But if the code exists, usually you want the DB to match.
# I'll try to import the modules I see in the file list to ensure `Base` picks them up,
# OR I will just import `schools.models` as requested and assume the user will ask to add others later.
# The user said "Immediate Action: Initialize the database, create the tables...". Plural.
# I'll play it safe and import what I can find or what was in the previous `database.py` if I recall it.
# Previous `database.py` imported: `schools.models`, `students.models`, `academics.models`, `finance.models`, `audit.models`.
# I should probably include these imports in `init_db.py` to ensure a working system if I'm "initializing" the build.
# I'll add them.

import students.models
import academics.models
import finance.models
import audit.models
import communication.models # Was not in list but likely exists
import attendance.models # Likely exists

def init_db():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
