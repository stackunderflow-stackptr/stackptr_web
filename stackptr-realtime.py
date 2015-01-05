#from __future__ import absolute_import
from autobahn.twisted.wamp import ApplicationSession
from autobahn.wamp.exception import ApplicationError
from autobahn.wamp.types import RegisterOptions
from ConfigParser import ConfigParser
from models import *
from os import chdir
from os.path import abspath, dirname
from sqlalchemy import *
from sqlalchemy.orm import sessionmaker
from twisted.internet.defer import inlineCallbacks

# Bootstrap the correct directory
chdir(dirname(abspath(dirname(__name__))))

config = ConfigParser()
config.read('./stackptr.conf')


db = create_engine(config.get("database", "uri"))
db.session = sessionmaker(bind=db)()


#md = MetaData(db)
#AuthTicket = Table('auth_ticket', md, autoload=True)

class StackPtrAuthenticator(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details):
		def authenticate(realm, authid, ticket):
			try:
				res = db.session.query(AuthTicket).filter_by(key=ticket, userid=authid).first()
				if res:
					db.session.delete(res)
					db.session.commit()
					#fixme: check date
					print "authenticated"
					return 'user'
				else:
					raise ApplicationError("invalid-ticket", "invalid ticket %s" % ticket)
			except Exception as e:
				print e
				raise e
		
		try:
			yield self.register(authenticate, 'com.stackptr.authenticate')
			print("authenticator registered")
		except Exception as e:
			print("could not register authenticator: %s" % e)



class StackPtrAuthorizer(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details):
		try:
			yield self.register(self.authorize, 'com.stackptr.authorizer')
			print("authorizer registered")
		except Exception as e:
			print("could not register authenticator: %s" % e)
	
	def authorize(self, session, uri, action):
		try:
			user = session['authid']
			reqpath = ".".join(uri.split(".")[:3])
			requser = uri.split(".")[3]
			
			if (action == 'subscribe' and reqpath == 'com.stackptr.user'):		
				res = db.session.query(Follower).filter_by(follower=user,following=requser,confirmed=1).first()
				if res:
					#print "accepted sub request: %s %s %s" % (session, uri, action)
					return True
				else:
					print "rejected sub request: %s %s %s" % (session, uri, action)
					return False
			elif (action == 'call' and reqpath == "com.stackptr.api"):
				print "grant api"
				return True
			else:
				print "rejected invalid action: %s %s %s" % (session, uri, action)
				return False
			
			return False
		except Exception as e:
			print e
			raise e


class StackPtrAPI(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details):
		def userList(details):
			#print details
			try:
				users = [tu.userid
				for f,tu in db.session.query(Follower,TrackPerson)
										.join(TrackPerson, Follower.following == TrackPerson.userid)\
										.filter(Follower.follower == details.authid, Follower.confirmed == 1)\
										.filter(TrackPerson.lastupd != None)
										.order_by(TrackPerson.userid)
										.all() ]
				return users
			except Exception as e:
				print e
				raise e
		
		try:
			yield self.register(userList, 'com.stackptr.api.userlist', options=RegisterOptions(details_arg='details', discloseCaller=True))
			print "userlist registered"
		except Exception as e:
			print "could not register userlist: %s" % e

class StackPtrSessionMonitor(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details):
		def on_session_join(details):
			session = WAMPSession()
			session.user = int(details['authid'])
			session.sessionid = int(details['session'])
			db.session.add(session)
			db.session.commit()
			print "session added: %i" % session.sessionid
		
		def on_session_leave(details):
			try:
				sessionid = int(details['session'])
				session = db.session.query(WAMPSession).filter(WAMPSession.sessionid==sessionid).first()
				db.session.delete(session)
				db.session.commit()
				print "session removed: %i" % sessionid
			except Exception as e:
				print e
				raise e
		
		try:
			print "removed %i old sessions" % db.session.query(WAMPSession).delete()
			db.session.commit()
			yield self.subscribe(on_session_join, 'wamp.metaevent.session.on_join')
			yield self.subscribe(on_session_leave, 'wamp.metaevent.session.on_leave')
			print "sessionmonitor registered"
		except Exception as e:
			print "could not register sessionmonitor: %s" % e
