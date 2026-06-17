import os
import shutil
import asyncio
import pytest
from app.db.base import engine


@pytest.fixture(scope="session", autouse=True)
def clean_db_session():
    # 1. Clean up db files and uploads before the session starts
    for db_file in ["test.db", "app.db", "sentinel.db"]:
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
            except Exception:
                pass
    if os.path.exists("uploads"):
        try:
            shutil.rmtree("uploads")
        except Exception:
            pass
            
    yield
    
    # 2. Dispose of the engine to close all connections
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    
    if loop.is_running():
        loop.create_task(engine.dispose())
    else:
        loop.run_until_complete(engine.dispose())
        
    # 3. Clean up db files and uploads after session ends
    for db_file in ["test.db", "app.db", "sentinel.db"]:
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
            except Exception:
                pass
    if os.path.exists("uploads"):
        try:
            shutil.rmtree("uploads")
        except Exception:
            pass
