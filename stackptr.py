#!/usr/bin/env python

####################
# Imports
####################

from flask import *
from flask_wtf import *
from flask_cors import *

app = application = Flask(__name__)

app.config['WTF_CSRF_CHECK_DEFAULT'] = False
csrf = CsrfProtect()
csrf.init_app(app)

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
	csrf.protect()
	return db.session.query(Users).get(int(id))

@login_manager.request_loader
def load_user_from_request(request):
	apikey = None
	if request.method == "POST":
		apikey = request.form.get('apikey')
	else:
		apikey = request.args.get('apikey')
	if apikey:
		key = db.session.query(ApiKey).filter_by(key=apikey[:32]).first()
		if key == None:
			return None
		uid = apikey[32:]
		if uid and (int(uid,16) != key.userid):
			return None
		return db.session.query(Users).filter_by(id=key.userid).first()
	return None

@login_manager.unauthorized_handler
def unauthorized():
	if request.form.get('apikey') or request.args.get('apikey'):
		return abort(401)
	else:
		return redirect(login_manager.login_view)

@app.before_request
def before_request():
	g.user = current_user

####################
# Index
####################


@app.route('/')
@login_required
def index():
	return send_from_directory("templates","map.html")

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
			return "no such user or incorrect password", 403
		if check_password_hash(registered_user.password, password):
			login_user(registered_user, remember=True)
			return redirect("/")
		return "no such user or incorrect password", 403

@app.route('/logout')
@login_required
def logout():
	logout_user()
	return redirect("/login")

## API keys

@app.route('/api/')
@login_required
def api_info():
	keys = db.session.query(ApiKey).filter_by(userid = g.user.id).order_by(ApiKey.created).all()
	return render_template("api.html", keys=keys, suffix=("%x" % g.user.id))

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
		return "%s%x" % (key.key, g.user.id)
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
@cross_origin()
@login_required
def ws_uid():
	return str(g.user.id)

@app.route('/ws_token', methods=['POST'])
@cross_origin()
@login_required
def ws_token():
	at = AuthTicket()
	at.key = "".join([random.choice(string.ascii_letters + string.digits) for n in xrange(30)])
	at.userid = g.user.id
	at.created = datetime.datetime.now()
	db.session.add(at)
	db.session.commit()
	
	# fixme: remove old tokens
	return str(at.key)

####################
# Data
####################

@app.route('/uid', methods=['POST'])
@cross_origin()
@login_required
def sp_uid():
	return json.dumps({'id': g.user.id,
                       'username': g.user.username,
                       'icon': stackptr_core.gravatar(g.user.email, size=256)})

@app.route('/users')
@cross_origin()
@login_required
def userjson():
	data = stackptr_core.userList(g.user, db=db)
	return Response(json.dumps(data), mimetype="text/json")


def publish_message(dest, topic, msg=None, eligible=[]):
	if eligible != []:
		client = crossbarconnect.Client("http://127.0.0.1:9000/")
		client.publish(dest, topic, msg=msg, options={'eligible': eligible})

@app.route('/update', methods=['POST'])
@cross_origin()
@login_required
def update():
	lat = request.form.get('lat', None)
	lon = request.form.get('lon', None)
	alt = request.form.get('alt', None)
	hdg = request.form.get('hdg', None)
	spd = request.form.get('spd', None)
	ext = request.form.get('ext', None)

	return json.dumps(stackptr_core.update(lat,lon,alt,hdg,spd,ext,pm=publish_message,guser=g.user,db=db))

@app.route('/lochist', methods=['POST', 'GET'])
@cross_origin()
@login_required
def lochist():
	target = request.args.get('uid', g.user.id)
	return json.dumps(stackptr_core.locHist(target=target, guser=g.user, db=db))

@app.route('/acceptuser', methods=['POST'])
@cross_origin()
@login_required
def acceptuser():
	user = request.form['uid']
	return json.dumps(stackptr_core.acceptUser(uid=user, pm=publish_message, guser=g.user, db=db))

@app.route('/adduser', methods=['POST'])
@cross_origin()
@login_required
def adduser():
	user = request.form['user']
	return json.dumps(stackptr_core.addUser(user=user, pm=publish_message, guser=g.user, db=db))

@app.route('/deluser', methods=['POST'])
@cross_origin()
@login_required
def deluser():
	user = request.form['uid']
	return json.dumps(stackptr_core.delUser(uid=user, pm=publish_message, guser=g.user, db=db))

###########

@app.route('/grouplist')
@cross_origin()
@login_required
def grouplist():
	return json.dumps(stackptr_core.groupList(guser=g.user, db=db))

@app.route('/groupdiscover')
@cross_origin()
@login_required
def groupdiscover():
	return json.dumps(stackptr_core.groupDiscover(guser=g.user, db=db))

@app.route('/creategroup', methods=['POST'])
@cross_origin()
@login_required
def creategroup():
	name = request.form.get('name')
	description = request.form.get('description')
	status = int(request.form.get('status'))
	return json.dumps(stackptr_core.createGroup(db=db, guser=g.user, name=name, description=description, status=status))

@app.route('/joingroup', methods=['POST'])
@cross_origin()
@login_required
def joingroup():
	gid = request.form.get('gid')
	return json.dumps(stackptr_core.joinGroup(db=db, pm=publish_message, guser=g.user, gid=gid))

@app.route('/groupusermod', methods=['POST'])
@cross_origin()
@login_required
def groupusermod():
	gid = request.form.get('gid')
	uid = request.form.get('uid')
	user = request.form.get('user')
	role = request.form.get('role')
	return json.dumps(stackptr_core.groupUserMod(gid=gid, uid=uid, user=user, role=role, pm=publish_message, guser=g.user, db=db))

@app.route('/leavegroup', methods=['POST'])
@cross_origin()
@login_required
def leavegroup():
	name = request.form.get('gid')
	return json.dumps(stackptr_core.leaveGroup(db=db, pm=publish_message, guser=g.user, gid=gid))

@app.route('/deletegroup', methods=['POST'])
@cross_origin()
@login_required
def deletegroup():
	name = request.form.get('gid')
	return json.dumps(stackptr_core.deleteGroup(db=db, pm=publish_message, guser=g.user, gid=gid))

@app.route('/updategroup', methods=['POST'])
@cross_origin()
@login_required
def updategroup():
	name = request.form.get('name')
	description = request.form.get('description')
	status = int(request.form.get('status'))
	gid = int(request.form.get('gid'))
	return json.dumps(stackptr_core.updateGroup(db=db, pm=publish_message, guser=g.user, gid=gid, name=name, description=description, status=status))

###########


@app.route('/groupdata', methods=['POST'])
@cross_origin()
@login_required
def groupdata():
	return json.dumps(stackptr_core.groupData(db=db, guser=g.user, gid=request.form.get('gid')))

@app.route('/addfeature', methods=['POST'])
@cross_origin()
@login_required
def addfeature():
	name = request.form.get('name',"Untitled")
	group = int(request.form['group'])
	ownerid = g.user.id
	gjson = request.form['gjson']
	return json.dumps(stackptr_core.addFeature(db=db, pm=publish_message, name=name, group=group, guser=ownerid, gjson=gjson))

@app.route('/delfeature', methods=['POST'])
@cross_origin()
@login_required
def delfeature():
	fid = int(request.form['fid'])
	return json.dumps(stackptr_core.deleteFeature(db=db, pm=publish_message, fid=fid, guser=g.user.id))


@app.route('/editfeature', methods=['POST'])
@cross_origin()
@login_required
def editfeature():
	gjson = request.form.get('gjson', None)
	name = request.form.get('name', None)
	description = request.form.get('description', None)
	fid = int(request.form['fid'])
	return json.dumps(stackptr_core.editFeature(db=db, pm=publish_message, fid=fid, gjson=gjson, name=name, description=description, guser=g.user.id))


if __name__ == '__main__':
	manager.run()