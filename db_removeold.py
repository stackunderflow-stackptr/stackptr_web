from sqlalchemy import *
from sqlalchemy.orm import sessionmaker
from ConfigParser import ConfigParser
from datetime import datetime, timedelta
import os

config = ConfigParser()
config.read('./stackptr.conf')

db = create_engine(config.get("database", "uri"))
db.session = sessionmaker(bind=db)()
db.echo = True

retention_period = datetime.utcnow() - timedelta(hours=24)

count = db.session.execute("select count(*) from track_history where time < :time", {"time": retention_period}).fetchone()[0]
print "Cleaning up %i rows..." % count
db.session.execute("delete from track_history where time < :time", {"time": retention_period})
db.session.commit()