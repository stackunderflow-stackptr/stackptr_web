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

def sessions_for_uid(id, db=None):
	user_ids = db.session.query(WAMPSession)\
			   .filter(WAMPSession.user == id)\
			   .all()
	
	return [a.sessionid for a in user_ids]

####

def update(lat, lon, alt, hdg, spd, extra, pm=None, guser=None, db=None):
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
	
	pm("com.stackptr.user", "user", msg=[msg], eligible=allowed_list)
			
	
	#also send to the user themself
	
	allowed_list = sessions_for_uid(guser.id, db=db)
	
	pm("com.stackptr.user", "user-me", msg=msg, eligible=allowed_list)
	
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

def createGroup(name=None, description=None, status=None, guser=None, db=None):
	group = Group()
	group.name = name
	group.description = description
	group.status = int(status)
	db.session.add(group)
	db.session.commit()

	print "testing %i" % group.id
	gm = GroupMember()
	gm.groupid = group.id
	gm.userid = guser.id
	gm.role = 2
	db.session.add(gm)
	db.session.commit()
		
	res = [{'name': group.name, 'id': group.id, 'description': group.description, 'status': group.status}]
	return [{'type': 'grouplist', 'data': res}]

def groupList(guser=None, db=None):
	gl = db.session.query(GroupMember, Group)\
				   .join(Group, GroupMember.groupid == Group.id)\
				   .filter(GroupMember.userid == guser.id)\
				   .filter(GroupMember.role > 0)\
				   .all()

	res = [{'name': item.Group.name, 'id': item.Group.id, 'description': item.Group.description, 'status': item.Group.status} for item in gl]
	return [{'type': 'grouplist', 'data': res}]

def groupDiscover(guser=None, db=None):
	userGroups = db.session.query(GroupMember.groupid).filter(GroupMember.userid == guser.id)

	gl = db.session.query(Group)\
				   .filter(~Group.id.in_(userGroups))\
				   .filter(Group.status == 0)\
				   .all()

	res = [{'name': item.name, 'id': item.id, 'description': item.description, 'status': item.status} for item in gl]
	return [{'type': 'groupDiscoverList', 'data': res}]



##########

def groupData(db=None,group=None):
	gd = db.session.query(Object).filter_by(group = group).all()
	res = [{'name': item.name, 'owner': item.owner.username, 'id': item.id, 'groupid': item.group,'json': json.loads(item.json)} for item in gd]
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
def addUser(user, pm=None, guser=None, db=None):
	#lookup userid for name
	
	userObj = db.session.query(Users).filter(Users.username==user).first()
	if not userObj:
		userObj = db.session.query(Users).filter(Users.email==user).first()
	if not userObj:
		return "user unknown"
	
	# first allow that user to see my position
	fobj = db.session.query(Follower).filter(Follower.follower_user==userObj, Follower.following==guser.id).first()
	if not fobj:
		fobj = Follower(userObj.id, guser.id)
	fobj.confirmed = 1
	db.session.merge(fobj)
	db.session.commit()
	
	# now add the request from me to see theirs
	fobj2 = db.session.query(Follower).filter(Follower.follower==guser.id, Follower.follower_user==userObj).first()
	if not fobj2:
		fobj2 = Follower(guser.id, userObj.id)
		fobj2.confirmed = 0
	else:
		if fobj2.confirmed != 1: # request again, but don't un-confirm the user if they already accepted
			fobj2.confirmed = 0
	db.session.merge(fobj2)
	db.session.commit()
	
	# if we just actually added them (i.e. didn't already have them)
	if fobj2.confirmed == 0: # unconfirmed request just made
		puser = db.session.query(Users).filter(Users.id==fobj2.following).first()
		# yes, that should just be the following_user object on fobj2
		# but the object is newly created so that hasn't been looked up yet?
		print "puser %s" % puser

		pending = [{ 'username': puser.username,
					 'icon': gravatar(puser.email),
					 'id': puser.id }]

		# send pending user info to requester
		allowed_list = sessions_for_uid(guser.id, db=db)
		pm("com.stackptr.user", "user-pending", msg=pending, eligible=allowed_list)

		# also send pending user the request
		allowed_list = sessions_for_uid(puser.id, db=db)
		request = [{ 'username': guser.username,
					 'icon': gravatar(guser.email),
					 'id': guser.id }]
		pm("com.stackptr.user", "user-request", msg=request, eligible=allowed_list)

		# and an update
		tu = db.session.query(TrackPerson).filter_by(userid = guser.id).first()
		user_upd = [user_object(tu)]
		pm("com.stackptr.user", "user", msg=user_upd, eligible=allowed_list)

		return []#[{'type': 'user-pending', 'data': [pending]}]
	
	
	# send a user and request object to com.stackptr.user targeted at the user just added
	#todo
	return []

def acceptUser(user, pm=None, guser=None, db=None):
	fobj = db.session.query(Follower).filter(Follower.follower==user, Follower.following==guser.id).first()
	if not fobj:
		return "no user request"
	fobj.confirmed = 1
	db.session.add(fobj)
	db.session.commit()

	# send delete user pending to them
	pending_del = [{'id': guser.id}]
	allowed_list = sessions_for_uid(fobj.follower,db=db)
	pm("com.stackptr.user", "user-pending-del", msg=pending_del, eligible=allowed_list)

	# send user update to them
	tu = db.session.query(TrackPerson).filter_by(userid = fobj.following).first()
	user_upd = [user_object(tu)]
	pm("com.stackptr.user", "user", msg=user_upd, eligible=allowed_list)

	# send delete user request to me

	request_del = [{'id': fobj.follower}]
	allowed_list = sessions_for_uid(guser.id, db=db)
	pm("com.stackptr.user", "user-request-del", msg=request_del, eligible=allowed_list)

	return []

def delUser(user, pm=None, guser=None, db=None):
	fobj = db.session.query(Follower).filter(Follower.follower==user, Follower.following==guser.id).first()
	if fobj:
		allowed_list = sessions_for_uid(user,db=db)
		delu = [{'id': guser.id}]
		pm("com.stackptr.user", "user-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-request-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-pending-del", msg=delu, eligible=allowed_list)
		db.session.delete(fobj)
		print "delete 1"
	fobj2 = db.session.query(Follower).filter(Follower.follower==guser.id, Follower.following==user).first()
	if fobj2:
		allowed_list = sessions_for_uid(guser.id,db=db)
		delu = [{'id': user}]
		pm("com.stackptr.user", "user-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-request-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-pending-del", msg=delu, eligible=allowed_list)
		db.session.delete(fobj2)
		print "delete 2"
	db.session.commit()
	
	# remove from users, pending users, and request users
	retmsg = [{'type': 'user-deleted', 'data': [user]}]
	return retmsg
	
	#send a message to that user
	#todo

