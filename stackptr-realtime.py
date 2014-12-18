from twisted.internet.defer import inlineCallbacks

from autobahn.twisted.wamp import ApplicationSession
from autobahn.wamp.exception import ApplicationError

from models import *
from sqlalchemy import *
from sqlalchemy.orm import sessionmaker

import ConfigParser
config = ConfigParser.ConfigParser()
config.read("../stackptr.conf")


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
		print "rejected invalid action: %s %s %s" % (session, uri, action)
		return False
