import datetime
from models import *
import md5
import json
import Geohash as geohash
import sqlalchemy

####

import reverse_geocoder
reverse_geocoder.search((0.0,0.0)) # warm up geocoder

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

def gravatar(email, size=64):
	return 'https://gravatar.com/avatar/' + md5.md5(email).hexdigest() + ('?s=%i&d=retro' % size)

def user_object(user, db):
	return {'loc': [user.lat if user.lat else -1, user.lon if user.lon else -1],
			'alt': user.alt, 'hdg': user.hdg, 'spd': user.spd,
			'id': user.userid,
			'username': user.user.username,
			'icon': gravatar(user.user.email),
			'lastupd': -1 if (user.lastupd == None) else utc_seconds(user.lastupd),
			'extra': process_extra(user.extra),
			'geocode': rev_geocode(user.lat, user.lon, db) if (user.lat and user.lon) else None }

def user_object_with_gid(tp,gid,db):
	uo = user_object(tp,db)
	uo.update({'gid': gid})
	return uo

def group_user_object(gm):
	return {'username': gm.user.username,
			'icon': gravatar(gm.user.email),
			'id': gm.user.id,
			'role': gm.role}

def sessions_for_uid(id, db=None):
	user_ids = db.session.query(WAMPSession)\
			   .filter(WAMPSession.user == id)\
			   .all()
	
	return [a.sessionid for a in user_ids]

def sessions_for_group(gid, db=None):
	group_ids = db.session.query(GroupMember,WAMPSession)\
						  .join(WAMPSession, GroupMember.userid == WAMPSession.user)\
						  .filter(GroupMember.role >= 1, GroupMember.groupid == int(gid))\
						  .all()
	
	return [ a.WAMPSession.sessionid for a in group_ids]

def roleInGroup(db=None, guser=None, group=None, roleMin=1):
	gl = db.session.query(GroupMember)\
			   .filter(GroupMember.groupid == int(group))\
			   .filter(GroupMember.userid == guser.id)\
			   .first()
	if not gl: return False
	if not gl.role >= roleMin: return False
	return True

def error(msg):
	return [{'type': 'error', 'data': msg}]

cache_hit = 0
cache_miss = 0

def rev_geocode(lat,lon,db):
	global cache_hit
	global cache_miss

	def cachestat():
		print "geocode cache hit %i of %i (%.1f%%)" % (cache_hit, cache_hit+cache_miss,
		  float(cache_hit)/float(cache_hit+cache_miss)*100.0)

	gh = geohash.encode(lat,lon, precision=7)

	gh_cache = db.session.query(GeocodeCache).filter_by(geohash=gh).first()

	if gh_cache:
		cache_hit += 1
		cachestat()
		return gh_cache.geocode
	else:
		cache_miss += 1	
		gc = reverse_geocoder.search((lat,lon))
		gc_text = ", ".join([gc[0][thing] for thing in ['name', 'admin1', 'cc']])
		db.session.merge(GeocodeCache(geohash=gh, geocode=gc_text))
		db.session.commit()
		cachestat()
		return gc_text

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
	
	msg = user_object(tu, db)
	
	
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


	# lookup list of share groups

	groups = db.session.query(GroupLocShare)\
					   .filter(GroupLocShare.userid == guser.id)\
					   .all()
	for group in groups:
		allowed_list = sessions_for_group(group.groupid, db=db)
		msg.update({'gid': group.groupid})
		pm("com.stackptr.group", "grouplocshareuser", msg=[msg], eligible=allowed_list)

	#fixme: post to group-specific endpoint
	
	return "OK"

####

def userList(guser, db=None):

	now = datetime.datetime.utcnow()
	tu = db.session.query(TrackPerson).filter_by(userid = guser.id).first()
	
	me = {'type': 'user-me', 'data': user_object(tu, db)}
	
	others_list = [user_object(tu, db) for f,tu in db.session.query(Follower,TrackPerson)
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
	return error("Permission denied")


###########

def createGroup(name=None, description=None, status=None, guser=None, db=None):
	group = Group()
	group.name = name
	group.description = description
	group.status = int(status)
	db.session.add(group)
	db.session.commit()

	gm = GroupMember()
	gm.groupid = group.id
	gm.userid = guser.id
	gm.role = 2
	db.session.add(gm)
	db.session.commit()
		
	res = [{'name': group.name, 'id': group.id, 'description': group.description, 'status': group.status, 
			'members': [group_user_object(gm) for gm in group.members]}]
	return [{'type': 'grouplist', 'data': res}]

def groupList(guser=None, db=None):
	gl = db.session.query(GroupMember, Group)\
				   .join(Group, GroupMember.groupid == Group.id)\
				   .filter(GroupMember.userid == guser.id)\
				   .filter(GroupMember.role > 0)\
				   .all()

	res = [{'name': item.Group.name, 'id': item.Group.id, 'description': item.Group.description, 
			'status': item.Group.status, 'members': [group_user_object(gm) for gm in item.Group.members] } for item in gl]
	return [{'type': 'grouplist', 'data': res}]

def groupDiscover(guser=None, db=None):
	userGroups = db.session.query(GroupMember.groupid).filter(GroupMember.userid == guser.id)

	gl = db.session.query(Group)\
				   .filter(~Group.id.in_(userGroups))\
				   .filter(Group.status == 0)\
				   .all()

	res = [{'name': item.name, 'id': item.id, 'description': item.description, 'status': item.status} for item in gl]
	return [{'type': 'groupDiscoverList', 'data': res}]

def joinGroup(gid=None, pm=None, guser=None, db=None):
	group = db.session.query(Group)\
					  .filter(Group.id == gid)\
					  .first()
	if not group: return error("No such group")

	# something different if user invited to group
	if group.status != 0: return error("Not allowed")

	gl = db.session.query(GroupMember, Group)\
				   .join(Group, GroupMember.groupid == Group.id)\
				   .filter(Group.id == gid)\
				   .filter(GroupMember.userid == guser.id)\
				   .first()
	if gl: return error("Already in group")

	gm = GroupMember()
	gm.groupid = int(gid)
	gm.userid = guser.id
	gm.role = 1
	db.session.add(gm)
	db.session.commit()

	res = [{'name': group.name, 'id': group.id, 'description': group.description, 
			'status': group.status, 'members': [group_user_object(gm) for gm in group.members] }]

	allowed_list = sessions_for_group(gid, db=db)
	pm("com.stackptr.group", "grouplist", msg=res, eligible=allowed_list)

	return [{'type': 'grouplist', 'data': res}]

def groupUserMod(gid=None, uid=None, user=None, role=None, pm=None, guser=None, db=None):
	if not roleInGroup(db=db, guser=guser, group=gid, roleMin=2): return error("Not an admin")

	role = 2 if role > 2 else role
	role = 0 if role < 0 else role

	group = db.session.query(Group)\
					  .filter(Group.id == gid)\
					  .first()
	if not group: return error("No such group")

	if not uid and not user: return error("No user")

	if not uid:
		userObj = db.session.query(Users).filter(Users.username==user).first()
		if not userObj:
			userObj = db.session.query(Users).filter(Users.email==user).first()
		if not userObj:
			return error("user unknown")
		uid = userObj.id

	if int(uid) == guser.id:
		admins = db.session.query(GroupMember)\
					   .filter(GroupMember.groupid == int(gid))\
					   .filter(GroupMember.role == 2)\
					   .all()
		print len(admins)

		if len(admins) == 1:
			return error("You are the only admin in this group - you may not demote yourself")

	gl = db.session.query(GroupMember)\
				   .filter(GroupMember.groupid == gid)\
				   .filter(GroupMember.userid == uid)\
				   .first()
	
	if gl and role > 0: # already in group
		print "already in group"
		gl.role = role
		db.session.add(gl)
		db.session.commit()
	elif gl and role == 0:
		db.session.delete(gl)
		db.session.commit()
	elif not gl and role > 0:
		print "adding to group"
		gm = GroupMember()
		gm.groupid = int(gid)
		gm.userid = uid
		gm.role = role
		db.session.add(gm)
		db.session.commit()
	else:
		return error("User not in group")

	res = [{'name': group.name, 'id': group.id, 'description': group.description, 
			'status': group.status, 'members': [group_user_object(gm) for gm in group.members] }]

	allowed_list = sessions_for_group(gid, db=db)
	pm("com.stackptr.group", "grouplist", msg=res, eligible=allowed_list)

	return [{'type': 'grouplist', 'data': res}]




def leaveGroup(gid=None, pm=None, guser=None, db=None):
	admins = db.session.query(GroupMember)\
					   .filter(GroupMember.groupid == int(gid))\
					   .filter(GroupMember.role == 2)\
					   .all()

	if len(admins) == 1 and admins[0].userid == guser.id:
		return error("You are the only admin in this group - you may not leave")

	gl = db.session.query(GroupMember)\
				   .filter(GroupMember.groupid == int(gid))\
				   .filter(GroupMember.userid == guser.id)\
				   .first()
	
	if not gl: return error("Not in group") # user not in group
	db.session.delete(gl)
	db.session.commit()

	group = db.session.query(Group)\
					  .filter(Group.id == int(gid))\
					  .first()

	res = [{'name': group.name, 'id': group.id, 'description': group.description, 
			'status': group.status, 
			'members': [group_user_object(gm) for gm in group.members] }]

	allowed_list = sessions_for_group(gid, db=db)
	pm("com.stackptr.group", "grouplist", msg=res, eligible=allowed_list)

	return [{'type': 'grouplist-del', 'data': [{'id': int(gid)}]}]


def deleteGroup(gid=None, pm=None, guser=None, db=None):
	gl = db.session.query(GroupMember)\
				   .filter(GroupMember.groupid == int(gid))\
				   .filter(GroupMember.userid == guser.id)\
				   .first()
	
	if not gl: return error("Not in group") # user not in group
	if not gl.role == 2: return error("Not an admin") # user not an admin

	allowed_list = sessions_for_group(gid, db=db)

	# delete all the groupMembers
	db.session.query(GroupMember)\
			  .filter(GroupMember.groupid == int(gid))\
			  .delete()

	# delete all the objects
	db.session.query(Object)\
			  .filter(Object.group == int(gid))\
			  .delete()

	# then delete the group
	db.session.query(Group)\
			  .filter(Group.id == int(gid))\
			  .delete()

	res = [{'id': int(gid)}]

	pm("com.stackptr.group", "grouplist-del", msg=res, eligible=allowed_list)
	
	return [{'type': 'grouplist-del', 'data': res}]


def updateGroup(gid=None, pm=None, name=None, description=None, status=None, guser=None, db=None):
	if not roleInGroup(db=db, guser=guser, group=gid, roleMin=2): return error("Not an admin")
	group = db.session.query(Group)\
			  		  .filter(Group.id == int(gid))\
			  		  .first()
	if not group: return error("No such group")
	
	group.name = name if (name != None) else group.name
	group.description = description if (description != None) else group.description
	group.status = int(status) if (status != None) else group.status
	db.session.commit()
	
	res = [{'name': group.name, 'id': group.id, 'description': group.description, 
			'status': group.status, 
			'members': [group_user_object(gm) for gm in group.members] }]

	allowed_list = sessions_for_group(group.id, db=db)
	pm("com.stackptr.group", "grouplist", msg=res, eligible=allowed_list)

	return [{'type': 'grouplist', 'data': res}]

##########

def groupData(db=None, guser=None, gid=None):
	if not gid: return []
	if not roleInGroup(db=db, guser=guser, group=gid): return []

	gd = db.session.query(Object).filter_by(group = gid).all()

	res = [{'name': item.name, 'owner': item.owner.username, 'id': item.id, 'groupid': item.group, 
			'description': item.description, 'json': json.loads(item.json)} for item in gd]
	return [{'type': 'groupdata', 'data': res}]

def addFeature(db=None, pm=None, name=None, group=None, guser=None, description=None, gjson=None):
	if not roleInGroup(db=db, guser=guser, group=group): return error("Not allowed")

	feature = Object()
	feature.name = name
	feature.group = int(group)
	feature.ownerid = guser.id
	feature.json = gjson
	feature.description = description
	db.session.add(feature)
	db.session.commit()
	
	js = json.loads(feature.json)
	res = [{'name': feature.name, 'owner': feature.owner.username, 'id': feature.id, 
			'description': feature.description, 'groupid': feature.group, 'json': js}]

	allowed_list = sessions_for_group(group, db=db)
	pm("com.stackptr.group", "groupdata", msg=res, eligible=allowed_list)
	# currently if the item is not in the user's group, it's rejected clientside
	# fixme: more granularity on group items

	return [{'type': 'groupdata', 'data': res}]

def editFeature(db=None, pm=None, fid=None, gjson=None, name=None, description=None, guser=None):
	feature = db.session.query(Object).filter_by(id = int(fid)).first()
	if not roleInGroup(db=db, guser=guser, group=feature.group): return error("Not allowed")
	
	if name: feature.name = name
	if description: feature.description = description
	if gjson: feature.json = gjson
	
	db.session.commit()
	# FIXME: Use HTTP status codes to indicate success/failure.
	js = json.loads(feature.json)
	res = [{'name': feature.name, 'owner': feature.owner.username, 'id': feature.id,
			'description': feature.description, 'groupid': feature.group, 'json': js}]
	
	allowed_list = sessions_for_group(feature.group, db=db)
	pm("com.stackptr.group", "groupdata", msg=res, eligible=allowed_list)

	return [{'type': 'groupdata', 'data': res}]

def deleteFeature(db=None, pm=None, fid=None, guser=None):
	feature = db.session.query(Object).filter_by(id = fid).first()
	if feature:
		if not roleInGroup(db=db, guser=guser, group=feature.group): return error("Not allowed")
		db.session.delete(feature)
		db.session.commit()

		res = [{'id': fid}]

		allowed_list = sessions_for_group(feature.group, db=db)
		pm("com.stackptr.group", "groupdata-del", msg=res, eligible=allowed_list)

		# FIXME: Use HTTP status codes to indicate success/failure.
		return [{'type': 'groupdata-del', 'data': res}]
	return error("No such feature")

############

def getSharedToGroups(db=None, guser=None):
	gls = db.session.query(GroupLocShare)\
			  		.filter(GroupLocShare.userid == guser.id)\
			  		.all()
	res = [{'gid': share.groupid, 'start': utc_seconds(share.time)} for share in gls]
	return [{'type': 'grouplocshare', 'data': res}]

def setShareToGroup(gid=None, share=None, db=None, guser=None, pm=None):
	if share > 0:
		gl = db.session.query(GroupLocShare)\
					   .filter(GroupLocShare.groupid == gid)\
					   .filter(GroupLocShare.userid == guser.id)\
					   .first()
		if gl:
			return error("Already sharing to that group")
		gls = GroupLocShare(gid,guser.id)
		db.session.add(gls)
		db.session.commit()

		res = [{'gid': gid, 'start': utc_seconds(gls.time)}]

		allowed_list = sessions_for_uid(guser.id, db=db)
		pm("com.stackptr.user", "grouplocshare", msg=res, eligible=allowed_list)

		tp = db.session.query(TrackPerson)\
					   .filter(TrackPerson.userid == guser.id)\
					   .first()
		if not tp: return [{'type': 'grouplocshare', 'data': res}]

		res2 = [user_object_with_gid(tp, gid, db)]
		allowed_list = sessions_for_group(gid, db=db)
		pm("com.stackptr.user", "grouplocshareuser", msg=res2, eligible=allowed_list)

		# send current location to group

		return [{'type': 'grouplocshare', 'data': res}]
	else:
		gl = db.session.query(GroupLocShare)\
					   .filter(GroupLocShare.groupid == gid)\
					   .filter(GroupLocShare.userid == guser.id)\
					   .first()
		if (gl):
			db.session.delete(gl)
			db.session.commit()
			
			res = [{'gid': gid}]
			allowed_list = sessions_for_uid(guser.id, db=db)
			pm("com.stackptr.user", "grouplocshare-del", msg=res, eligible=allowed_list)

			res2 = [{'id': guser.id, 'gid': gid}]
			allowed_list = sessions_for_group(gid, db=db)
			pm("com.stackptr.user", "grouplocshareuser-del", msg=res2, eligible=allowed_list)

			return [{'type': 'grouplocshare-del', 'data': res}]

			# send delete message to group

		else:
			return error("Not sharing to group")

def sharedGroupLocs(gid=None, db=None, guser=None):
	if gid == None: return []
	if not roleInGroup(db=db, guser=guser, group=gid): return []

	ll = db.session.query(GroupLocShare,TrackPerson)\
				   .join(TrackPerson, GroupLocShare.userid == TrackPerson.userid)\
				   .filter(GroupLocShare.groupid == gid)\
				   .all()

	res = [user_object_with_gid(tp,gid,db) for gls,tp in ll]
	return [{'type': 'grouplocshareuser', 'data': res}]

def sharedGroupLocHistory(gid=None, db=None, guser=None):
	return []


############
def addUser(user=None, pm=None, guser=None, db=None):
	#lookup userid for name
	
	userObj = db.session.query(Users).filter(Users.username==user).first()
	if not userObj:
		userObj = db.session.query(Users).filter(Users.email==user).first()
	if not userObj:
		return error("user unknown")

	# check that i don't already have them
	fuser = db.session.query(Follower).filter(Follower.follower==guser.id, Follower.following_user==userObj).first()
	if fuser:
		return error("user already added")
	
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
		user_upd = [user_object(tu, db)]
		pm("com.stackptr.user", "user", msg=user_upd, eligible=allowed_list)
	
	return []

def acceptUser(uid=None, pm=None, guser=None, db=None):
	fobj = db.session.query(Follower).filter(Follower.follower==uid, Follower.following==guser.id).first()
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
	user_upd = [user_object(tu, db)]
	pm("com.stackptr.user", "user", msg=user_upd, eligible=allowed_list)

	# send delete user request to me
	request_del = [{'id': fobj.follower}]
	allowed_list = sessions_for_uid(guser.id, db=db)
	pm("com.stackptr.user", "user-request-del", msg=request_del, eligible=allowed_list)

	return []

def delUser(uid=None, pm=None, guser=None, db=None):
	fobj = db.session.query(Follower).filter(Follower.follower==uid, Follower.following==guser.id).first()
	if fobj:
		allowed_list = sessions_for_uid(uid,db=db)
		delu = [{'id': guser.id}]
		pm("com.stackptr.user", "user-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-request-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-pending-del", msg=delu, eligible=allowed_list)
		db.session.delete(fobj)
		print "delete 1"
	fobj2 = db.session.query(Follower).filter(Follower.follower==guser.id, Follower.following==uid).first()
	if fobj2:
		allowed_list = sessions_for_uid(guser.id,db=db)
		delu = [{'id': uid}]
		pm("com.stackptr.user", "user-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-request-del", msg=delu, eligible=allowed_list)
		pm("com.stackptr.user", "user-pending-del", msg=delu, eligible=allowed_list)
		db.session.delete(fobj2)
		print "delete 2"
	db.session.commit()
	
	# remove from users, pending users, and request users
	return [{'type': 'user-deleted', 'data': [uid]}]

