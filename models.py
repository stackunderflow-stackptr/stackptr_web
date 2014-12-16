from flask.ext.sqlalchemy import SQLAlchemy
import datetime

db = SQLAlchemy()

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

class AuthTicket(db.Model):
	key = db.Column(db.String(32), primary_key=True)
	userid = db.Column(db.Integer, db.ForeignKey('users.id'))
	created = db.Column(db.DateTime)
