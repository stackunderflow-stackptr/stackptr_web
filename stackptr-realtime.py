from twisted.internet.defer import inlineCallbacks

from autobahn.twisted.wamp import ApplicationSession
from autobahn.wamp.exception import ApplicationError

#from models import *
from sqlalchemy import *
from sqlalchemy.orm import sessionmaker

import ConfigParser
config = ConfigParser.ConfigParser()
config.read("/stackptr/stackptr.conf") # FIXME

db = create_engine(config.get("database", "uri"))
#db.echo = True
md = MetaData(db)
AuthTicket = Table('auth_ticket', md, autoload=True)

class StackPtrAuthenticator(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details):
		def authenticate(realm, authid, ticket):
			try:
				conn = db.connect()
				res = conn.execute(text("select * from auth_ticket where key = :key and userid = :authid"), key=ticket, authid=authid).fetchone()
				if res:
					conn.execute(text("delete from auth_ticket where key = :key"), key=ticket)
					#fixme: check date
					return 'user'
				else:
					raise ApplicationError("invalid-ticket", "invalid ticket %s" % ticket)
			except Exception as e:
				print e
		
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
		user = session['authid']
		reqpath = ".".join(uri.split(".")[:3])
		requser = uri.split(".")[3]
		
		if (action == 'subscribe' and reqpath == 'com.stackptr.user'):		
			conn = db.connect()
			res = conn.execute(text("select * from follower where follower = :user and following = :requser and confirmed = 1"), user=user, requser=requser).fetchone()
			if res:
				#print "accepted sub request: %s %s %s" % (session, uri, action)
				return True
			else:
				print "rejected sub request: %s %s %s" % (session, uri, action)
				return False
		print "rejected invalid action: %s %s %s" % (session, uri, action)
		return False
