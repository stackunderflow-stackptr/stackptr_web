import datetime
from models import *
import md5
import json

####

def process_extra(extra):
	try:
		return json.loads(str(extra))
	except ValueError:
		return {}

def utc_seconds(time):
	if time == None:
		return 0
	epoch = datetime.datetime(1970, 1, 1)
	diff = (time - epoch).total_seconds()
	return int(diff)

def gravatar(email):
	return 'https://gravatar.com/avatar/' + md5.md5(email).hexdigest() + '?s=64&d=retro'

####

def userList(guser, db=None):

	now = datetime.datetime.utcnow()
	tu = db.session.query(TrackPerson).filter_by(userid = guser.id).first()
	
	me = {'type': 'user-me', 'data': {'loc': [tu.lat, tu.lon] if tu.lat else [0.0,0.0],
	'alt': tu.alt, 'hdg': tu.hdg, 'spd': tu.spd,
	'id': tu.userid,
	'username': tu.user.username,
	'icon': gravatar(tu.user.email),
	'lastupd': -1 if (tu.lastupd == None) else utc_seconds(tu.lastupd),
	'extra': process_extra(tu.extra),
	}}
	
	others_list = {tu.userid: {'loc': [tu.lat if tu.lat else -1, tu.lon if tu.lon else -1],
	'alt': tu.alt, 'hdg': tu.hdg, 'spd': tu.spd,
	'username': tu.user.username,
	'icon': gravatar(tu.user.email),
	'id': tu.userid,
	'lastupd': utc_seconds(tu.lastupd),
	'extra': process_extra(tu.extra),
	}
	for f,tu in db.session.query(Follower,TrackPerson)
							.join(TrackPerson, Follower.following == TrackPerson.userid)\
							.filter(Follower.follower == guser.id, Follower.confirmed == 1)\
							#.filter(TrackPerson.lastupd != None)
							.order_by(TrackPerson.userid)
							.all() }
	
	
	others = {'type': 'user', 'data': others_list}
	
	pending_list = {p.following: {'username': p.following_user.username,
								'icon': gravatar(p.following_user.email),
								'id': p.following} 
								for p in db.session.query(Follower)\
								.filter(Follower.follower == guser.id, Follower.confirmed == 0)\
						   		.order_by(Follower.following).all()}
	
	pending = {'type': 'user-pending', 'data': pending_list}
	
	reqs_list = {r.following: {'username': r.follower_user.username,
								'icon': gravatar(r.follower_user.email),
								'id': r.follower} 
								for r in db.session.query(Follower)\
								.filter(Follower.following == guser.id, Follower.confirmed == 0)
						   		.order_by(Follower.follower).all()}
	
	reqs = {'type': 'user-request', 'data': reqs_list}
	
	return [me, others, pending, reqs]
	
	#data = {'me': me, 'following': others, 'pending': pending, 'reqs': reqs}
	# FIXME: Return "None" instead of -1 for unknown values.
	#return data

###########

def groupList(db=None):
	gl = db.session.query(Group).all()
	res = {item.id: item.name for item in gl}
	return [{'type': 'grouplist', 'data': res}]
	#todo: only return groups to which the user is a member



############
def acceptUser(user, guser=None, db=None):
	fobj = db.session.query(Follower).filter(Follower.follower==user, Follower.following==guser.id).first()
	if not fobj:
		return "no user request"
	fobj.confirmed = 1
	db.session.add(fobj)
	db.session.commit()
	return "OK"
	#todo: send user update to accepted user

def addUser(user, guser=None, db=None):
	#lookup userid for name
	
	userObj = db.session.query(Users).filter(Users.username==user).first()
	if not userObj:
		userObj = db.session.query(Users).filter(Users.email==user).first()
	if not userObj:
		return "user unknown"
	
	# first pre-accept them being able to see me
	fobj = db.session.query(Follower).filter(Follower.follower_user==userObj, Follower.following==guser.id).first()
	if not fobj:
		fobj = Follower(userObj.id, guser.id)
	fobj.confirmed = 1
	db.session.merge(fobj)
	db.session.commit()
	
	# now add the request from me to them
	fobj2 = db.session.query(Follower).filter(Follower.follower==guser.id, Follower.follower_user==userObj).first()
	if not fobj2:
		fobj2 = Follower(guser.id, userObj.id)
		fobj2.confirmed = 0
	else:
		if fobj2.confirmed != 1: # if request was ignored, but don't un-add the user if already accepted
			fobj2.confirmed = 0
	db.session.merge(fobj2)
	db.session.commit()
	
	# return the pending user to the requesting client if we just confirmed it
	if fobj2.confirmed == 0: # unconfirmed request just made
		puser = db.session.query(Users).filter(Users.id==fobj2.following).first()
		# yes, that should just be the following_user object on fobj2...
		print "puser %s" % puser
		pending = {puser.id: {'username': puser.username,
								'icon': gravatar(puser.email),
								'id': puser.id}}
		pending_msg = [{'type': 'user-pending', 'data': pending}]
		return pending_msg
	
	
	# send a user and request object to com.stackptr.user targeted at the user just added
	#todo
	return "OK"

def delUser(user, guser=None, db=None):
	fobj = db.session.query(Follower).filter(Follower.follower==user, Follower.following==guser.id).first()
	if fobj:
		db.session.delete(fobj)
		print "delete 1"
	fobj2 = db.session.query(Follower).filter(Follower.follower==guser.id, Follower.following==user).first()
	if fobj:
		db.session.delete(fobj2)
		print "delete 2"
	db.session.commit()
	
	# remove from users, pending users, and request users
	msg = {user: None}
	retmsg = [{'type': 'user', 'data': msg},
			  {'type': 'user-pending', 'data': msg},
			  {'type': 'user-request', 'data': msg}]
	return retmsg
	
	#send a message to that user
	#todo

