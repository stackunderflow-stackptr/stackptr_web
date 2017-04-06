import datetime

from sqlalchemy import *
from sqlalchemy.orm import *
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class TrackPerson(Base):
	__tablename__ = "track_person"
	userid = Column(Integer, ForeignKey('users.id'), primary_key=True)
	device = Column(String(128), primary_key=True)
	lat = Column(Float(Precision=64))
	lon = Column(Float(Precision=64))
	alt = Column(Float())
	hdg = Column(Float())
	spd = Column(Float())
	extra = Column(String(512))
	lastupd = Column(DateTime())
	
	user = relationship('Users', foreign_keys=userid, lazy='joined',
							primaryjoin="TrackPerson.userid==Users.id")
	
	def __init__(self, userid, device, lat, lon):
		self.userid = userid
		self.device = device
		self.lat = lat
		self.lon = lon
		self.lastupd = 0

class TrackHistory(Base):
	__tablename__ = "track_history"
	id = Column(Integer, primary_key=True)
	userid = Column(Integer, ForeignKey('users.id'))
	lat = Column(Float(Precision=64))
	lon = Column(Float(Precision=64))
	extra = Column(String(512))
	time = Column(DateTime())
	
	def __init__(self, userid, lat, lon, extra):
		self.userid = userid
		self.lat = lat
		self.lon = lon
		self.extra = extra
		self.time = datetime.datetime.utcnow()

class Users(Base):
	__tablename__ = "users"
	id = Column(Integer, primary_key=True)
	username = Column(String(80), unique=True)
	email = Column(String(128), unique=True)
	password = Column(String(128))
	

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

class ApiKey(Base):
	__tablename__ = "api_key"
	key = Column(String(32), primary_key=True)
	userid = Column(Integer, ForeignKey('users.id'))
	created = Column(DateTime)
	name = Column(String(128))	


class Follower(Base):
	__tablename__ = "follower"
	follower = Column(Integer, ForeignKey('users.id'), primary_key=True)
	following = Column(Integer, ForeignKey('users.id'), primary_key=True)
	confirmed = Column(Integer)
	
	def __init__(self, follower, following):
		self.follower = follower
		self.following = following
		confirmed = 0
	
	follower_user = relationship('Users', foreign_keys=follower, lazy='joined',
					primaryjoin="Follower.follower==Users.id")
	following_user = relationship('Users', foreign_keys=following, lazy='joined',
					primaryjoin="Follower.following==Users.id")
	PrimaryKeyConstraint('follower', 'following', name='follow_pk')

class Object(Base):
	__tablename__ = "object"
	id = Column(Integer, primary_key=True)
	name = Column(String(128))
	group = Column(Integer, ForeignKey('group.id'))
	ownerid = Column(Integer, ForeignKey('users.id'))
	json = Column(Text)
	description = Column(Text)
	
	owner = relationship('Users', foreign_keys=ownerid, lazy='joined',
					primaryjoin="Object.ownerid==Users.id")

class Group(Base):
	__tablename__ = "group"
	id = Column(Integer, primary_key=True)
	name = Column(String(128))
	description = Column(Text)
	status = Column(Integer)
	
	members = relationship('GroupMember', primaryjoin="Group.id==GroupMember.groupid")

class GroupMember(Base):
	__tablename__ = "group_member"
	groupid = Column(Integer, ForeignKey('group.id'), primary_key=True)
	userid = Column(Integer, ForeignKey('users.id'), primary_key=True)
	role = Column(Integer)
	
	user = relationship('Users', foreign_keys=userid, lazy='joined',
					primaryjoin="GroupMember.userid==Users.id")
	group = relationship('Group', foreign_keys=groupid, lazy='joined',
					primaryjoin="GroupMember.groupid==Group.id")
	
	def __init__(self):
		pass

class GroupLocShare(Base):
	__tablename__ = "group_loc_share"
	groupid = Column(Integer, ForeignKey('group.id'), primary_key=True)
	userid = Column(Integer, ForeignKey('users.id'), primary_key=True)
	time = Column(DateTime())
	
	
	user = relationship('Users', foreign_keys=userid, lazy='joined',
					primaryjoin="GroupLocShare.userid==Users.id")
	group = relationship('Group', foreign_keys=groupid, lazy='joined',
					primaryjoin="GroupLocShare.groupid==Group.id")

	def __init__(self, gid, uid):
		self.groupid = gid
		self.userid = uid
		self.time = datetime.datetime.utcnow()

class AuthTicket(Base):
	__tablename__ = "auth_ticket"
	key = Column(String(30), primary_key=True)
	userid = Column(Integer, ForeignKey('users.id'))
	created = Column(DateTime)

class WAMPSession(Base):
	__tablename__ = "wamp_session"
	sessionid = Column(BigInteger, primary_key=True)
	user = Column(Integer, ForeignKey('users.id'))

class GeocodeCache(Base):
	__tablename__ = "geocode_cache"
	geohash = Column(String(8), primary_key=True)
	geocode = Column(String(64))

	def __init__(self, geohash, geocode):
		self.geohash = geohash
		self.geocode = geocode

