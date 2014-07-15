#!/usr/bin/env python

from flask import *
from flask_wtf import *
from flask_cors import *

app = Flask(__name__)
application = app

csrf = CsrfProtect()
csrf.init_app(app)
csrf_protect = app.before_request_funcs[None][0]
app.before_request_funcs[None] = []

import os
import json
import md5
import datetime
import random
import string
import calendar

import ConfigParser
config = ConfigParser.ConfigParser()
config.read(os.path.join(app.root_path, "stackptr.conf"))
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

class TrackPerson(db.Model):
	username = db.Column(db.String(80), db.ForeignKey('user.username'))
	device = db.Column(db.String(128), primary_key=True)
	lat = db.Column(db.Float(Precision=64))
	lon = db.Column(db.Float(Precision=64))
	alt = db.Column(db.Float())
	hdg = db.Column(db.Float())
	spd = db.Column(db.Float())
	extra = db.Column(db.String(512))
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

class ApiKey(db.Model):
	key = db.Column(db.String(32), primary_key=True)
	user = db.Column(db.String(80), db.ForeignKey('user.username'))
	created = db.Column(db.DateTime)
	name = db.Column(db.String(128))	


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

login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(id):
	csrf_protect()
	return User.query.get(int(id))

@login_manager.request_loader
def load_user_from_request(request):
	apikey = None
	if request.method == "POST":
		apikey = request.form.get('apikey')
	else:
		apikey = request.args.get('apikey')
	if apikey:
		key = ApiKey.query.filter_by(key=apikey).first()
		return User.query.filter_by(username=key.user).first()
	return None

#from opsmodels import *

@app.before_request
def before_request():
	g.user = current_user

## index

@app.route('/')
@login_required
def index():
	return render_template("map.html", current_user=g.user.username)

## login

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
			login_user(registered_user, remember=True)
			return redirect("/")
		else:
			return "incorrect password"

@app.route('/logout')
@login_required
def logout():
	logout_user()
	return redirect("/")

## API keys

@app.route('/api/')
@login_required
def api_info():
	keys = ApiKey.query.filter_by(user = g.user.username).order_by(ApiKey.created).all()
	return render_template("api.html", keys=keys)

@app.route('/api/new', methods=['POST'])
@login_required
def api_create():
	key = ApiKey()
	key.key = "".join([random.choice(string.ascii_letters + string.digits) for n in xrange(32)])
	key.user = g.user.username
	key.created = datetime.datetime.now()
	key.name = request.form['description']
	db.session.add(key)
	db.session.commit()
	if 'return' in request.form:
		return key.key
	return redirect(url_for('api_info'))

@app.route('/api/remove', methods=['POST'])
@login_required
def api_remove():
	key = ApiKey.query.filter_by(key = request.form['key_id'], user=g.user.username).first()
	db.session.delete(key)
	db.session.commit()
	return redirect(url_for('api_info'))

## test
@app.route('/test')
@login_required
def test():
	return str(g.user.username)

## data

@app.route('/users')
@cross_origin()
@login_required
def userjson():
	now = datetime.datetime.utcnow()
	tu = TrackPerson.query.filter_by(username = g.user.username).first()
	me = {'loc': [tu.lat, tu.lon],
	'user': tu.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=64&d=retro',
	'lastupd': -1 if (tu.lastupd == None) else tu.lastupd.strftime("%s") }
	
	others = [ {'loc': [tu.lat, tu.lon],
	'user': tu.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=64&d=retro',
	'lastupd': -1 if (tu.lastupd == None) else tu.lastupd.strftime("%s") }
	for tu in TrackPerson.query.filter(TrackPerson.username != g.user.username)\
							   .filter(TrackPerson.lastupd != None).all() ]
	
	data = {'me': me, 'following': others}
	
	# FIXME: Return last update time as a ISO8601 datetime (UTC), rather than relative time.
	# FIXME: Return "None" instead of -1 for unknown values.
	return json.dumps(data)

@app.route('/update', methods=['POST'])
@login_required
def update():
	lat = request.form.get('lat', None)
	lon = request.form.get('lon', None)
	alt = request.form.get('alt', None)
	hdg = request.form.get('hdg', None)
	spd = request.form.get('spd', None)
	ext = request.form.get('ext', None)
	
	if None in (lat, lon):
		return "No lat/lon specified"
		
	tu = TrackPerson.query.filter_by(username = g.user.username).first()
	tu.lat = lat
	tu.lon = lon
	tu.alt = alt
	tu.hdg = hdg
	tu.spd = spd
	tu.extra = ext
	
	tu.lastupd = datetime.datetime.utcnow()
	db.session.commit()
	
	return "OK"

@app.route('/groupdata', methods=['POST'])
@cross_origin()
@login_required
def groupdata():
	res = {}
	gd = Object.query.filter_by(group = 1).all()
	for item in gd:
		res[item.id] = {'name': item.name, 'owner': item.owner, 'json': json.loads(item.json)}
	
	# FIXME: Other groups?
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
	# FIXME: Return the object ID of the element created.
	# FIXME: Allow passing the name and group ID of the object.
	return "success"

@app.route('/delfeature', methods=['POST'])
@login_required
def delfeature():
	feature = Object.query.filter_by(id = int(request.form['id'])).first()
	db.session.delete(feature)
	db.session.commit()
	# FIXME: Use HTTP status codes to indicate success/failure.
	return "deleting feature " + request.form['id']

@app.route('/renamefeature', methods=['POST'])
@login_required
def renamefeature():
	feature = Object.query.filter_by(id = int(request.form['id'])).first()
	feature.name = request.form['name']
	#feature.description
	db.session.commit()
	# FIXME: Use HTTP status codes to indicate success/failure.
	# FIXME: Modification of an existing feature's geometry??
	return "renaming feature" + request.form['id']

