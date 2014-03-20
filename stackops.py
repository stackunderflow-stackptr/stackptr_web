#!/usr/bin/env python

from flask import *
from flask_wtf import *

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

class Follower(db.Model):
	follower = db.Column(db.String(80), db.ForeignKey('user.username'), primary_key=True)
	following = db.Column(db.String(80), db.ForeignKey('user.username'), primary_key=True)
	confirmed = db.Column(db.Integer)
	
	def __init__(self, follower, following):
		self.follower = follower
		self.following = following
		confirmed = 0

class Object(db.Model):
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(128))
	group = db.Column(db.Integer, db.ForeignKey('group.id'))
	owner = db.Column(db.String(80), db.ForeignKey('user.username'))
	json = db.Column(db.Text)

class Group(db.Model):
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(128), unique=True)
	owner = db.Column(db.String(80), db.ForeignKey('user.username'))
	description = db.Column(db.Text)
	status = db.Column(db.Integer)

db.create_all()

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

#from opsmodels import *

@app.before_request
def before_request():
	g.user = current_user

@app.route('/')
@login_required
def index():
	return render_template("map.html", current_user=g.user.username)

@app.route('/csrf')
def csrftoken():
	return render_template("csrf.html")

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
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=32&d=retro'}
	
	others = [ {'loc': [tu.lat, tu.lon],
	'user': tu.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=32&d=retro'}
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

@app.route('/groupdata', methods=['POST'])
@login_required
def groupdata():
	res = []
	gd = Object.query.filter_by(group = 1).all()
	for item in gd:
		feature = {'id': item.id, 'name': item.name, 'owner': item.owner, 'json': json.loads(item.json)}
		res.append(feature)
	return json.dumps(res)

@app.route('/addfeature', methods=['POST'])
@login_required
def addfeature():
	feature = Object()
	feature.name = "Untitled"
	feature.group = 1
	feature.owner = g.user.username
	feature.json = request.form['geojson']
	db.session.add(feature)
	db.session.commit()
	return "success"

@app.route('/delfeature', methods=['POST'])
@login_required
def delfeature():
	feature = Object.query.filter_by(id = int(request.form['id'])).first()
	db.session.delete(feature)
	db.session.commit()
	return "deleting feature " + request.form['id']



