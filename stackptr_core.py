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

def user_object(user):
	return {'loc': [user.lat if user.lat else -1, user.lon if user.lon else -1],
			'alt': user.alt, 'hdg': user.hdg, 'spd': user.spd,
			'id': user.userid,
			'username': user.user.username,
			'icon': gravatar(user.user.email),
			'lastupd': -1 if (user.lastupd == None) else utc_seconds(user.lastupd),
			'extra': process_extra(user.extra)}

def limited_user_object(follower):
	return {'username': follower.following_user.username,
			'icon': gravatar(follower.following_user.email),
			'id': follower.following}

####

def update(lat, lon, alt, hdg, spd, extra, publish_message=None, guser=None, db=None):
	if None in (lat, lon):
		return "No lat/lon specified"
	
	#update TrackPerson
	tu = db.session.query(TrackPerson).filter_by(userid = guser.id).first()
	if not tu:
		tu = TrackPerson(guser.id, guser.username)
		db.session.add(tu)
		db.session.commit()
	tu.lat = lat
	tu.lon = lon
	tu.alt = alt
	tu.hdg = hdg
	tu.spd = spd
	tu.extra = extra
	tu.lastupd = datetime.datetime.utcnow()
	
	#add to TrackHistory
	
	th = TrackHistory(guser.id, lat, lon, extra)
	db.session.add(th)
	db.session.commit()
	
	#push message to realtime
	
	msg = user_object(tu)
	
	
	#lookup list of followers
	allowed_ids = db.session.query(Follower,WAMPSession)\
					.join(WAMPSession, Follower.follower == WAMPSession.user)\
					.filter(Follower.confirmed == 1, Follower.following == guser.id)\
					.filter(Follower.follower != guser.id)\
					.all()
		
	allowed_list = [a[1].sessionid for a in allowed_ids]
	
	# Crossbar bug: if allowed_list is present but empty, message is sent to everyone (!)
	if allowed_list != []:
		publish_message("com.stackptr.user", "user", msg=[msg], eligible=allowed_list)
			
	
	#also send to the user themself
	
	user_ids = db.session.query(WAMPSession)\
			   .filter(WAMPSession.user == guser.id)\
			   .all()
	
	allowed_list = [a.sessionid for a in user_ids]
		
	if allowed_list != []:
		publish_message("com.stackptr.user", "user-me", msg=msg, eligible=allowed_list)
	
	return "OK"

####

def userList(guser, db=None):

	now = datetime.datetime.utcnow()
	tu = db.session.query(TrackPerson).filter_by(userid = guser.id).first()
	
	me = {'type': 'user-me', 'data': user_object(tu)}
	
	others_list = [user_object(tu) for f,tu in db.session.query(Follower,TrackPerson)
							.join(TrackPerson, Follower.following == TrackPerson.userid)\
							.filter(Follower.follower == guser.id, Follower.confirmed == 1)\
							#.filter(TrackPerson.lastupd != None)
							.order_by(TrackPerson.userid)
							.all() ]
	
	others = {'type': 'user', 'data': others_list}
	
	pending_list = [ {	'username': p.following_user.username,
						'icon': gravatar(p.following_user.email),
						'id': p.following}
					for p in db.session.query(Follower)\
					.filter(Follower.follower == guser.id, Follower.confirmed == 0)\
			   		.order_by(Follower.following).all()]
	
	pending = {'type': 'user-pending', 'data': pending_list}
	
	reqs_list = [ {	'username': r.follower_user.username,
					'icon': gravatar(r.follower_user.email),
					'id': r.follower }
				for r in db.session.query(Follower)\
				.filter(Follower.following == guser.id, Follower.confirmed == 0)
		   		.order_by(Follower.follower).all()]
	
	reqs = {'type': 'user-request', 'data': reqs_list}
	
	return [me, others, pending, reqs]

###########

def locHist(target=None, guser=None, db=None):
	permission = db.session.query(Follower).filter(Follower.follower == guser.id,
	 											   Follower.following == target,
	 											   Follower.confirmed == 1 ).first()
	if permission or guser.id == target:
		dayago = datetime.datetime.utcnow() - datetime.timedelta(days=1)
		lh = db.session.query(TrackHistory)\
					   .filter(TrackHistory.userid == target,
					   		   TrackHistory.time > dayago )\
					   .order_by(TrackHistory.time).all()
		lhdata = [{ 'lat': l.lat, 'lng': l.lon } for l in lh]
		lhmsg = {'type': 'lochist', 'data': [{'id': target, 'lochist': lhdata}]}
		return [lhmsg]
	return "Permission denied"


###########

def groupList(db=None):
	gl = db.session.query(Group).all()
	res = [{'name': item.name, 'id': item.id} for item in gl]
	return [{'type': 'grouplist', 'data': res}]
	#todo: only return groups to which the user is a member

def groupData(db=None,group=None):
	gd = db.session.query(Object).filter_by(group = 1).all()
	res = [{'name': item.name, 'owner': item.owner.username, 'id': item.id, 'json': json.loads(item.json)} for item in gd]
	# FIXME: Other groups?
	return [{'type': 'groupdata', 'data': res}]

def addFeature(db=None, name=None, group=None, guser=None, gjson=None):
	feature = Object()
	feature.name = name
	feature.group = int(group)
	feature.ownerid = guser.id
	feature.json = gjson
	db.session.add(feature)
	db.session.commit()
	
	js = json.loads(feature.json)
	res = [{'name': feature.name, 'owner': feature.owner.username, 'id': feature.id , 'json': js}]
		
	return [{'type': 'groupdata', 'data': res}]

def renameFeature(db=None, id=None, name=None, guser=None):
	feature = db.session.query(Object).filter_by(id = int(id)).first()
	feature.name = name
	db.session.commit()
	# FIXME: Use HTTP status codes to indicate success/failure.
	# FIXME: Modification of an existing feature's geometry??
	js = json.loads(feature.json)
	res = [{'name': feature.name, 'owner': feature.owner.username, 'id': feature.id, 'json': js}]
	return [{'type': 'groupdata', 'data': res}]

def deleteFeature(db=None, id=None, guser=None):
	feature = db.session.query(Object).filter_by(id = id).first()
	if feature:
		#FIXME: check permissions
		db.session.delete(feature)
		db.session.commit()
		# FIXME: Use HTTP status codes to indicate success/failure.
		return [{'type': 'groupdata-del', 'data': [{'id': id}]}]
	return "failed"


############
def acceptUser(user, guser=None, db=None):
	fobj = db.session.query(Follower).filter(Follower.follower==user, Follower.following==guser.id).first()
	if not fobj:
		return "no user request"
	fobj.confirmed = 1
	db.session.add(fobj)
	db.session.commit()
	return []
	#todo: send user update to accepted user
	#send delete pending user

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
		pending = {puser.id: limited_user_object(puser)}
		pending_msg = [{'type': 'user-pending', 'data': pending}]
		return pending_msg
	
	
	# send a user and request object to com.stackptr.user targeted at the user just added
	#todo
	return []

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
	retmsg = [{'type': 'user-deleted', 'data': [user]}]
	return retmsg
	
	#send a message to that user
	#todo

