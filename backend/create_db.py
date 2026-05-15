import psycopg2

conn = psycopg2.connect(host="localhost", user="postgres", password="AsDf1234!", database="postgres")
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname='finbridge'")
if not cur.fetchone():
    cur.execute("CREATE DATABASE finbridge")
    print("Database 'finbridge' created.")
else:
    print("Database 'finbridge' already exists.")
conn.close()
