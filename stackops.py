#!/usr/bin/env python

from flask import *
app = Flask(__name__)
application = app

import ConfigParser
config = ConfigParser.ConfigParser()
config.read(app.root_path + "/stackops.conf")
app.secret_key = config.get("app","secret_key")


import logging, sys
logging.basicConfig(stream=sys.stderr)

import MySQLdb, MySQLdb.cursors

@app.before_request
def before_request():
	g.conn = conn = MySQLdb.connect(host=config.get("mysql","host"),
			user=config.get("mysql","user"),
			passwd=config.get("mysql","passwd"),
			db=config.get("mysql","db"), 
			cursorclass=MySQLdb.cursors.DictCursor, charset='utf8')
	g.cursor = g.conn.cursor()

@app.route('/')
def index():
	return "test"