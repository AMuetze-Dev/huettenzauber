from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from entity.DAO import Base
import os

DATABASE_HOST = os.getenv("DATABASE_HOST", "postgres_db")
engine = create_engine(f"postgresql://root:root@{DATABASE_HOST}:5432/huettenzauber")
SessionLocal = sessionmaker(autoflush=True, bind=engine)
Base.metadata.create_all(bind=engine)
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()