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
import stackptr_core

import traceback

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
				print traceback.format_exc()
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
			#requser = uri.split(".")[3]
			
			if (action == 'subscribe' and uri == 'com.stackptr.user'):
				return true
			elif (action == 'subscribe' and uri == 'com.stackptr.alert'):
				return true
				#res = db.session.query(Follower).filter_by(follower=user,following=requser,confirmed=1).first()
				#if res:
				#	#print "accepted sub request: %s %s %s" % (session, uri, action)
				#	return True
				#else:
				#	print "rejected sub request: %s %s %s" % (session, uri, action)
				#	return False
			elif (action == 'call' and reqpath == "com.stackptr.api"):
				#print "grant api"
				return True
			else:
				print "rejected invalid action: %s %s %s" % (session, uri, action)
				return False
			
			return False
		except Exception as e:
			print traceback.format_exc()
			raise e


class StackPtrAPI(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details):
		def userList(details):
			try:
				guser = db.session.query(WAMPSession,Users)\
					.join(Users, Users.id == WAMPSession.user)\
					.filter(WAMPSession.sessionid == details.caller).first()[1]
				return stackptr_core.userList(guser, db=db)
			except Exception as e:
				print traceback.format_exc()
				raise e
		
		def groupList(details):
			return stackptr_core.groupList(db=db)

		def groupData(group,details):
			return stackptr_core.groupData(db=db,group=group)

		def addFeature(name, group, gjson, details):
			try:
				guser = db.session.query(WAMPSession,Users)\
					.join(Users, Users.id == WAMPSession.user)\
					.filter(WAMPSession.sessionid == details.caller).first()[1]
				return stackptr_core.addFeature(db=db, guser=guser, name=name, group=group, gjson=gjson)
			except Exception as e:
				db.session.rollback()
				print traceback.format_exc()
				raise e

		def renameFeature(id, name, details):
			try:
				guser = db.session.query(WAMPSession,Users)\
					.join(Users, Users.id == WAMPSession.user)\
					.filter(WAMPSession.sessionid == details.caller).first()[1]
				return stackptr_core.renameFeature(db=db, guser=guser, id=id, name=name)
			except Exception as e:
				db.session.rollback()
				print traceback.format_exc()
				raise e

		def deleteFeature(id, details):
			try:
				guser = db.session.query(WAMPSession,Users)\
					.join(Users, Users.id == WAMPSession.user)\
					.filter(WAMPSession.sessionid == details.caller).first()[1]
				return stackptr_core.deleteFeature(db=db, guser=guser, id=id)
			except Exception as e:
				db.session.rollback()
				print traceback.format_exc()
				raise e

		def locHist(target,details):
			try:
				guser = db.session.query(WAMPSession,Users)\
					.join(Users, Users.id == WAMPSession.user)\
					.filter(WAMPSession.sessionid == details.caller).first()[1]
				return stackptr_core.locHist(target=target, guser=guser, db=db)
			except Exception as e:
				print traceback.format_exc()
				raise e
		
		try:
			yield self.register(userList, 'com.stackptr.api.userList', options=RegisterOptions(details_arg='details'))
			yield self.register(groupList, 'com.stackptr.api.groupList', options=RegisterOptions(details_arg='details'))
			yield self.register(groupData, 'com.stackptr.api.groupData', options=RegisterOptions(details_arg='details'))
			yield self.register(addFeature, 'com.stackptr.api.addFeature', options=RegisterOptions(details_arg='details'))
			yield self.register(renameFeature, 'com.stackptr.api.renameFeature', options=RegisterOptions(details_arg='details'))
			yield self.register(deleteFeature, 'com.stackptr.api.deleteFeature', options=RegisterOptions(details_arg='details'))
			yield self.register(locHist, 'com.stackptr.api.lochist', options=RegisterOptions(details_arg='details'))
		except Exception as e:
			print "could not register api calls: %s" % e

class StackPtrSessionMonitor(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details):
		def on_session_join(details):
			try:
				session = WAMPSession()
				session.user = int(details['authid'])
				session.sessionid = int(details['session'])
				db.session.add(session)
				db.session.commit()
				print "session added: %i" % session.sessionid
			except Exception as e:
				print traceback.format_exc()
				raise e
		
		def on_session_leave(sessionid):
			try:
				session = db.session.query(WAMPSession).filter(WAMPSession.sessionid==sessionid).first()
				db.session.delete(session)
				db.session.commit()
				print "session removed: %i" % sessionid
			except Exception as e:
				print traceback.format_exc()
				raise e
		
		try:
			print "removed %i old sessions" % db.session.query(WAMPSession).delete()
			db.session.commit()
			yield self.subscribe(on_session_join, 'wamp.session.on_join')
			yield self.subscribe(on_session_leave, 'wamp.session.on_leave')
			print "sessionmonitor registered"
		except Exception as e:
			print "could not register sessionmonitor: %s" % e
