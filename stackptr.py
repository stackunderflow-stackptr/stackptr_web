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
import pytz

import ConfigParser
config = ConfigParser.ConfigParser()
config.read(os.path.join(app.root_path, "stackptr.conf"))
app.secret_key = config.get("app","secret_key")
app.invite_code = config.get("app","invite_code")
app.CSRF_ENABLED = True

import logging, sys
logging.basicConfig(stream=sys.stderr)

#import MySQLdb, MySQLdb.cursors

from werkzeug.security import *
from flask.ext.login import login_user, logout_user, login_required, current_user, LoginManager
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.script import Manager
from flask.ext.migrate import Migrate, MigrateCommand

app.config['SQLALCHEMY_DATABASE_URI'] = config.get("database","uri")
db = SQLAlchemy(app)
migrate = Migrate(app, db)

manager = Manager(app)
manager.add_command('db', MigrateCommand)


class TrackPerson(db.Model):
	userid = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
	device = db.Column(db.String(128), primary_key=True)
	lat = db.Column(db.Float(Precision=64))
	lon = db.Column(db.Float(Precision=64))
	alt = db.Column(db.Float())
	hdg = db.Column(db.Float())
	spd = db.Column(db.Float())
	extra = db.Column(db.String(512))
	lastupd = db.Column(db.DateTime())
	
	user = db.relationship('Users', foreign_keys=userid, lazy='joined',
							primaryjoin="TrackPerson.userid==Users.id")
	
	def __init__(self, userid, device):
		self.userid = userid
		self.device = device

class TrackHistory(db.Model):
	id = db.Column(db.Integer, primary_key=True)
	userid = db.Column(db.Integer, db.ForeignKey('users.id'))
	lat = db.Column(db.Float(Precision=64))
	lon = db.Column(db.Float(Precision=64))
	extra = db.Column(db.String(512))
	time = db.Column(db.DateTime())
	
	def __init__(self, userid, lat, lon, extra):
		self.userid = userid
		self.lat = lat
		self.lon = lon
		self.extra = extra
		self.time = datetime.datetime.now()

class Users(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True)
    email = db.Column(db.String(128), unique=True)
    password = db.Column(db.String(128))
    

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
	userid = db.Column(db.Integer, db.ForeignKey('users.id'))
	created = db.Column(db.DateTime)
	name = db.Column(db.String(128))	


class Follower(db.Model):
	follower = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
	following = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
	confirmed = db.Column(db.Integer)
	
	def __init__(self, follower, following):
		self.follower = follower
		self.following = following
		confirmed = 0
	
	follower_user = db.relationship('Users', foreign_keys=follower, lazy='joined',
					primaryjoin="Follower.follower==Users.id")
	following_user = db.relationship('Users', foreign_keys=following, lazy='joined',
					primaryjoin="Follower.following==Users.id")

class Object(db.Model):
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(128))
	group = db.Column(db.Integer, db.ForeignKey('group.id'))
	ownerid = db.Column(db.Integer, db.ForeignKey('users.id'))
	json = db.Column(db.Text)
	
	owner = db.relationship('Users', foreign_keys=ownerid, lazy='joined',
					primaryjoin="Object.ownerid==Users.id")

class Group(db.Model):
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(128), unique=True)
	description = db.Column(db.Text)
	status = db.Column(db.Integer)
	
	members = db.relationship('GroupMember', primaryjoin="Group.id==GroupMember.groupid")

class GroupMember(db.Model):
	groupid = db.Column(db.Integer, db.ForeignKey('group.id'), primary_key=True)
	userid = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
	role = db.Column(db.Integer)
	
	def __init__(self):
		pass

#db.create_all()

login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(id):
	csrf_protect()
	return Users.query.get(int(id))

@login_manager.request_loader
def load_user_from_request(request):
	apikey = None
	if request.method == "POST":
		apikey = request.form.get('apikey')
	else:
		apikey = request.args.get('apikey')
	if apikey:
		key = ApiKey.query.filter_by(key=apikey).first()
		if key == None:
			return None
		return Users.query.filter_by(id=key.userid).first()
	return None

@app.before_request
def before_request():
	g.user = current_user

## index

@app.route('/')
@login_required
def index():
	return render_template("map.html", current_user=g.user.username)

# registration

@app.route('/registration', methods=['GET','POST'])
def registration():
	if request.method == "GET":
		return render_template("registration.html")
	else:
		username = request.form['username']
		email = request.form['email']
		password = request.form['password']
		invite_code = request.form['invite']
		#todo check these are valid email and password values
		if invite_code != app.invite_code:
			return "invalid invite code"
		registered_email = Users.query.filter_by(email=email).first() #check if email already in DB
		if registered_email:
			return "email address already registered %s" % email
		registered_user = Users.query.filter_by(username=username).first() # check user name is registered in DB
		if registered_user:
			return "username already registered %s" % username
		else:
			user = Users(username, email)
			user.password = generate_password_hash(password)
			db.session.add(user)
			db.session.commit()
			login_user(user,remember=True)
			return redirect("/")

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
		registered_user = Users.query.filter_by(email=email).first()
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
	keys = ApiKey.query.filter_by(userid = g.user.id).order_by(ApiKey.created).all()
	return render_template("api.html", keys=keys)

@app.route('/api/new', methods=['POST'])
@login_required
def api_create():
	key = ApiKey()
	key.key = "".join([random.choice(string.ascii_letters + string.digits) for n in xrange(32)])
	key.userid = g.user.id
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
	key = ApiKey.query.filter_by(key = request.form['key_id'], userid=g.user.id).first()
	db.session.delete(key)
	db.session.commit()
	return redirect(url_for('api_info'))

## test
@app.route('/test')
@login_required
def test():
	return str(g.user.username)

## data

def process_extra(extra):
	try:
		return json.loads(str(extra))
	except ValueError:
		return {}

def utc_seconds(time):
	epoch = datetime.datetime(1970, 1, 1)
	diff = (time - epoch).total_seconds()
	return int(diff)

@app.route('/users')
@cross_origin()
@login_required
def userjson():
	now = datetime.datetime.utcnow()
	tu = TrackPerson.query.filter_by(userid = g.user.id).first()
	
	me = {'loc': [tu.lat, tu.lon] if tu.lat else [0.0,0.0],
	'alt': tu.alt, 'hdg': tu.hdg, 'spd': tu.spd,
	'user': tu.userid,
	'username': tu.user.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=64&d=retro',
	'lastupd': -1 if (tu.lastupd == None) else utc_seconds(tu.lastupd),
	'extra': process_extra(tu.extra),
	} if tu else None
	
	
	others = {tu.userid: {'loc': [tu.lat, tu.lon],
	'alt': tu.alt, 'hdg': tu.hdg, 'spd': tu.spd,
	'username': tu.user.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=64&d=retro',
	'lastupd': utc_seconds(tu.lastupd),
	'extra': process_extra(tu.extra),
	}
	for f,tu in db.session.query(Follower,TrackPerson)
							.join(TrackPerson, Follower.following == TrackPerson.userid)\
							.filter(Follower.follower == g.user.id, Follower.confirmed == 1)\
							.filter(TrackPerson.lastupd != None)
							.order_by(TrackPerson.userid)
							.all() }
		
	pending = [ {'user' : r.following }
	for r in Follower.query.filter(Follower.follower == g.user.id, Follower.confirmed == 0)
						   .order_by(Follower.following).all()]
	
	reqs = [ {'user' : r.follower }
	for r in Follower.query.filter(Follower.following == g.user.id, Follower.confirmed == 0)
						   .order_by(Follower.follower).all()]
	
	data = {'me': me, 'following': others, 'pending': pending, 'reqs': reqs}
	
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
		
	tu = TrackPerson.query.filter_by(userid = g.user.id).first()
	if not tu:
		tu = TrackPerson(g.user.id, g.user.username)
		db.session.add(tu)
		db.session.commit()
	tu.lat = lat
	tu.lon = lon
	tu.alt = alt
	tu.hdg = hdg
	tu.spd = spd
	tu.extra = ext
	tu.lastupd = datetime.datetime.utcnow()
	
	th = TrackHistory(g.user.id, lat, lon, ext)
	db.session.add(th)
	db.session.commit()
	
	return "OK"

@app.route('/lochist', methods=['POST', 'GET'])
@login_required
def lochist():
	usr = request.form.get('uid', g.user.id)
	lh = TrackHistory.query.filter(TrackHistory.userid==usr).order_by(TrackHistory.time).all()
	
	lhtrack = {'type': 'Feature', 'properties': {}, 'geometry': 
		{'type': 'LineString', 'coordinates': [[l.lon, l.lat] for l in lh]}}
	
	return json.dumps(lhtrack)

@app.route('/acceptuser', methods=['POST'])
@login_required
def acceptuser():
	user = request.form['uid']
	fobj = Follower.query.filter(Follower.follower==user, Follower.following==g.user.id).first()
	if not fobj:
		return "no user request"
	fobj.confirmed = 1
	db.session.add(fobj)
	db.session.commit()
	return "OK"

@app.route('/rejectuser', methods=['POST'])
@login_required
def rejectuser():
	user = request.form['uid']
	fobj = Follower.query.filter(Follower.follower==user, Follower.following==g.user.id).first()
	if not fobj:
		return "no user request"
	fobj.confirmed = -1
	db.session.add(fobj)
	db.session.commit()
	return "OK"

@app.route('/adduser', methods=['POST'])
@login_required
def adduser():
	user = request.form['uid']
	# first pre-accept them being able to see me
	fobj = Follower.query.filter(Follower.follower==user, Follower.following==g.user.id).first()
	if not fobj:
		fobj = Follower(user, g.user.id)
	fobj.confirmed = 1
	db.session.merge(fobj)
	db.session.commit()
	
	# now add the request from me to them
	fobj2 = Follower.query.filter(Follower.follower==g.user.id, Follower.follower==user).first()
	if not fobj2:
		fobj2 = Follower(g.user.id, user)
		fobj2.confirmed = 0
	else:
		if fobj2.confirmed != 1: # if request was ignored, but don't un-add the user if already accepted
			fobj2.confirmed = 0
	db.session.merge(fobj2)
	db.session.commit()
	return "OK"

@app.route('/deluser', methods=['POST'])
@login_required
def deluser():
	user = request.form['uid']
	fobj = Follower.query.filter(Follower.follower==user, Follower.following==g.user.id).first()
	if fobj:
		db.session.delete(fobj)
	fobj = Follower.query.filter(Follower.follower==g.user.id, Follower.following==user).first()
	if fobj:
		db.session.delete(fobj)
	db.session.commit()
	return "OK"

###########

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
@cross_origin()
@login_required
def addfeature():
	feature = Object()
	feature.name = "Untitled"
	feature.group = 1
	feature.owner = g.user.id
	feature.json = request.form['geojson']
	db.session.add(feature)
	db.session.commit()
	# FIXME: Return the object ID of the element created.
	# FIXME: Allow passing the name and group ID of the object.
	return "success"

@app.route('/delfeature', methods=['POST'])
@cross_origin()
@login_required
def delfeature():
	feature = Object.query.filter_by(id = int(request.form['id'])).first()
	db.session.delete(feature)
	db.session.commit()
	# FIXME: Use HTTP status codes to indicate success/failure.
	return "deleting feature " + request.form['id']

@app.route('/renamefeature', methods=['POST'])
@cross_origin()
@login_required
def renamefeature():
	feature = Object.query.filter_by(id = int(request.form['id'])).first()
	feature.name = request.form['name']
	#feature.description
	db.session.commit()
	# FIXME: Use HTTP status codes to indicate success/failure.
	# FIXME: Modification of an existing feature's geometry??
	return "renaming feature" + request.form['id']

if __name__ == '__main__':
	manager.run()