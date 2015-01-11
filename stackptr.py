#!/usr/bin/env python

####################
# Imports
####################

from flask import *
from flask_wtf import *
from flask_cors import *

app = Flask(__name__)

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
app.invite_code = config.get("app","invite_code", None)
app.CSRF_ENABLED = True

import logging, sys
logging.basicConfig(stream=sys.stderr)

import crossbarconnect

from werkzeug.security import *
from flask.ext.login import login_user, logout_user, login_required, current_user, LoginManager
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.script import Manager
from flask.ext.migrate import Migrate, MigrateCommand

import stackptr_core

####################
# Config
####################

app.config['SQLALCHEMY_DATABASE_URI'] = config.get("database","uri")

from models import *
db = SQLAlchemy(app)

migrate = Migrate(app, Base)

manager = Manager(app)
manager.add_command('db', MigrateCommand)

####################
# Login
####################

login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(id):
	csrf_protect()
	return db.session.query(Users).get(int(id))

@login_manager.request_loader
def load_user_from_request(request):
	apikey = None
	if request.method == "POST":
		apikey = request.form.get('apikey')
	else:
		apikey = request.args.get('apikey')
	if apikey:
		key = db.session.query(ApiKey).filter_by(key=apikey).first()
		if key == None:
			return None
		return db.session.query(Users).filter_by(id=key.userid).first()
	return None

@app.before_request
def before_request():
	g.user = current_user

####################
# Index
####################


@app.route('/')
@login_required
def index():
	return render_template("map.html", current_user=g.user.username)

# registration

@app.route('/registration', methods=['GET','POST'])
def registration():
	if app.invite_code is None:
		return "invites disabled"
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
		registered_email = db.session.query(Users).filter_by(email=email).first() #check if email already in DB
		if registered_email:
			return "email address already registered %s" % email
		registered_user = db.session.query(Users).filter_by(username=username).first() # check user name is registered in DB
		if registered_user:
			return "username already registered %s" % username
		else:
			user = Users(username, email)
			user.password = generate_password_hash(password)
			db.session.add(user)
			db.session.commit()
			tp = TrackPerson(user.id,username)
			db.session.add(tp)
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
		registered_user = db.session.query(Users).filter_by(email=email).first()
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
	keys = db.session.query(ApiKey).filter_by(userid = g.user.id).order_by(ApiKey.created).all()
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
	key = db.session.query(ApiKey).filter_by(key = request.form['key_id'], userid=g.user.id).first()
	db.session.delete(key)
	db.session.commit()
	return redirect(url_for('api_info'))

####################
# WebSocket functions
####################

@app.route('/ws_uid', methods=['POST'])
@login_required
def ws_uid():
	return str(g.user.id)

@app.route('/ws_token', methods=['POST'])
@login_required
def ws_token():
	at = AuthTicket()
	at.key = "".join([random.choice(string.ascii_letters + string.digits) for n in xrange(32)])
	at.userid = g.user.id
	at.created = datetime.datetime.now()
	db.session.add(at)
	db.session.commit()
	
	# fixme: remove old tokens
	return str(at.key)

####################
# Data
####################

@app.route('/users')
@cross_origin()
@login_required
def userjson():
	data = stackptr_core.userList(g.user, db=db)
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
	
	#update TrackPerson
	tu = db.session.query(TrackPerson).filter_by(userid = g.user.id).first()
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
	
	#add to TrackHistory
	
	th = TrackHistory(g.user.id, lat, lon, ext)
	db.session.add(th)
	db.session.commit()
	
	#push message to realtime
	
	usrdata = {'loc': [tu.lat, tu.lon],
	'alt': tu.alt, 'hdg': tu.hdg, 'spd': tu.spd,
	'username': tu.user.username,
	'icon': 'https://gravatar.com/avatar/' + md5.md5(tu.user.email).hexdigest() + '?s=64&d=retro',
	'id': tu.userid,
	'lastupd': stackptr_core.utc_seconds(tu.lastupd),
	'extra': stackptr_core.process_extra(tu.extra),
	}
	
	msg = {tu.userid: usrdata}
	
	
	#lookup list of followers
	allowed_ids = db.session.query(Follower,WAMPSession)\
					.join(WAMPSession, Follower.follower == WAMPSession.user)\
					.filter(Follower.confirmed == 1, Follower.following == g.user.id)\
					.filter(Follower.follower != g.user.id)\
					.all()
		
	allowed_list = [a[1].sessionid for a in allowed_ids]
	
	# Crossbar bug: if allowed_list is empty, message is sent to everyone (!)
	if allowed_list != []:
		client = crossbarconnect.Client("http://127.0.0.1:9000/")
		client.publish("com.stackptr.user", "user", msg=msg, options={'eligible': allowed_list})
	
	#also send to the user themself
	
	user_ids = db.session.query(WAMPSession)\
			   .filter(WAMPSession.user == g.user.id)\
			   .all()
	
	allowed_list = [a.sessionid for a in user_ids]
		
	if allowed_list != []:
		client = crossbarconnect.Client("http://127.0.0.1:9000/")
		client.publish("com.stackptr.user", "user-me", msg=usrdata, options={'eligible': allowed_list})
	
	return "OK"

@app.route('/lochist', methods=['POST', 'GET'])
@login_required
def lochist():
	usr = request.form.get('uid', g.user.id)
	lh = db.session.query(TrackHistory).filter(TrackHistory.userid==usr).order_by(TrackHistory.time).all()
	
	lhtrack = {'type': 'Feature', 'properties': {}, 'geometry': 
		{'type': 'LineString', 'coordinates': [[l.lon, l.lat] for l in lh]}}
	
	return json.dumps(lhtrack)

@app.route('/acceptuser', methods=['POST'])
@login_required
def acceptuser():
	user = request.form['uid']
	return stackptr_core.acceptUser(user, guser=g.user, db=db)

@app.route('/adduser', methods=['POST'])
@login_required
def adduser():
	user = request.form['user']
	return json.dumps(stackptr_core.addUser(user, guser=g.user, db=db))

@app.route('/deluser', methods=['POST'])
@login_required
def deluser():
	user = request.form['uid']
	return json.dumps(stackptr_core.delUser(user, guser=g.user, db=db))

###########

@app.route('/grouplist')
@cross_origin()
@login_required
def grouplist():
	return json.dumps(stackptr_core.groupList(db=db))

@app.route('/groupdata', methods=['POST'])
@cross_origin()
@login_required
def groupdata():
	res = {}
	gd = db.session.query(Object).filter_by(group = 1).all()
	for item in gd:
		js = json.loads(item.json)
		js['id'] = item.id
		res[item.id] = {'name': item.name, 'owner': item.owner.username, 'json': js}
	
	# FIXME: Other groups?
	return json.dumps([{'type': 'groupdata', 'data': res}])

@app.route('/addfeature', methods=['POST'])
@cross_origin()
@login_required
def addfeature():
	feature = Object()
	feature.name = request.form.get('name',"Untitled")
	feature.group = int(request.form['group'])
	feature.ownerid = g.user.id
	feature.json = request.form['geojson']
	db.session.add(feature)
	db.session.commit()
	
	js = json.loads(feature.json)
	js['id'] = feature.id
	res = {feature.id : {'name': feature.name, 'owner': feature.owner.username, 'json': js}}
		
	return json.dumps([{'type': 'groupdata', 'data': res}])

@app.route('/delfeature', methods=['POST'])
@cross_origin()
@login_required
def delfeature():
	fid = int(request.form['id'])
	feature = db.session.query(Object).filter_by(id = fid).first()
	if feature:
		#FIXME: check permissions
		db.session.delete(feature)
		db.session.commit()
		# FIXME: Use HTTP status codes to indicate success/failure.
		return json.dumps([{'type': 'groupdata', 'data': {fid: None}}])
	return "failed"

@app.route('/renamefeature', methods=['POST'])
@cross_origin()
@login_required
def renamefeature():
	feature = db.session.query(Object).filter_by(id = int(request.form['id'])).first()
	feature.name = request.form['name']
	#feature.description
	db.session.commit()
	# FIXME: Use HTTP status codes to indicate success/failure.
	# FIXME: Modification of an existing feature's geometry??
	js = json.loads(feature.json)
	js['id'] = feature.id
	res = {feature.id : {'name': feature.name, 'owner': feature.owner.username, 'json': js}}
	return json.dumps([{'type': 'groupdata', 'data': res}])



if __name__ == '__main__':
	manager.run()