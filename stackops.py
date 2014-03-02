#!/usr/bin/env python

from flask import *
from flask_wtf.csrf import CsrfProtect
app = Flask(__name__)
application = app
CsrfProtect(app)

import os
import json
import md5

import ConfigParser
config = ConfigParser.ConfigParser()
config.read(os.path.join(app.root_path, "stackops.conf"))
app.secret_key = config.get("app","secret_key")
app.CSRF_ENABLED = True

import logging, sys
logging.basicConfig(stream=sys.stderr)

#import MySQLdb, MySQLdb.cursors

from werkzeug.security import *
from flask.ext.login import login_user, logout_user, login_required, current_user, LoginManager
from flask.ext.sqlalchemy import SQLAlchemy

app.config['SQLALCHEMY_DATABASE_URI'] = config.get("database","uri")
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True)
    email = db.Column(db.String(128), unique=True)
    password = db.Column(db.String(128))
    locations = db.relationship("TrackPerson", backref="user")
    

    def __init__(self, username, email):
        self.username = username
        self.email = email

    def is_authenticated(self):
        return True
 
    def is_active(self):
        return True
 
    def is_anonymous(self):
        return False
 
    def get_id(self):
        return unicode(self.id)
 
    def __repr__(self):
        return 'User %r' % (self.username)

class TrackPerson(db.Model):
	username = db.Column(db.String(80), db.ForeignKey('user.username'))
	device = db.Column(db.String(128), primary_key=True)
	lat = db.Column(db.Float(Precision=64))
	lon = db.Column(db.Float(Precision=64))
	alt = db.Column(db.Float())
	hdg = db.Column(db.Float())
	spd = db.Column(db.Float())
	lastupd = db.Column(db.DateTime())
	
	def __init__(self, username, device):
		self.username = username
		self.device = device

db.create_all()

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

#from opsmodels import *

@app.before_request
def before_request():
	g.user = current_user
    
#	g.conn = conn = MySQLdb.connect(host=config.get("mysql","host"),
#			user=config.get("mysql","user"),
#			passwd=config.get("mysql","passwd"),
#			db=config.get("mysql","db"), 
#			cursorclass=MySQLdb.cursors.DictCursor, charset='utf8')
#	g.cursor = g.conn.cursor()



@app.route('/')
@login_required
def index():
	return render_template("map.html", current_user=g.user.username)

@app.route('/login', methods=['GET', 'POST'])
def login():
	if request.method == "GET":
		return render_template("login.html")
	else:
		email = request.form['email']
		password = request.form['password']
		registered_user = User.query.filter_by(email=email).first()
		if not registered_user:
			return "no such user %s" % email
		if check_password_hash(registered_user.password, password):
			login_user(registered_user)
			return redirect("/")
		else:
			return "incorrect password"

@app.route('/logout')
@login_required
def logout():
	logout_user()
	return redirect("/")

@app.route('/user.json')
@login_required
def userjson():
	tu = TrackPerson.query.filter_by(username = g.user.username).first()
	me = {'loc': [tu.lat, tu.lon],
	'user': tu.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=32'}
	
	others = [ {'loc': [tu.lat, tu.lon],
	'user': tu.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=32'}
	for tu in TrackPerson.query.filter(TrackPerson.username != g.user.username).all() ]
	
	data = {'me': me, 'following': others}
	
	return json.dumps(data)

@app.route('/update', methods=['POST'])
@login_required
def update():
	lat = request.form['lat']
	lon = request.form['lon']
	tu = TrackPerson.query.filter_by(username = g.user.username).first()
	tu.lat = lat
	tu.lon = lon
	db.session.commit()
	return "lat: %s, lon: %s" % (lat,lon)




