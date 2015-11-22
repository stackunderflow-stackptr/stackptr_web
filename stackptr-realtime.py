#from __future__ import absolute_import
from autobahn.twisted.wamp import ApplicationSession
from autobahn.wamp.exception import ApplicationError
from autobahn.wamp.types import RegisterOptions, PublishOptions
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
	def onJoin(self, details=None):
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
	def onJoin(self, details=None):
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
			
			print "rejected invalid action: %s %s %s" % (session, uri, action)
			return False
		except Exception as e:
			print traceback.format_exc()
			raise e


class StackPtrAPI(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details=None):
		
		def api_function(func):
			def func_wrapper(*args, **kwargs):
				try:
					details = kwargs['details']
					guser = db.session.query(WAMPSession,Users)\
						.join(Users, Users.id == WAMPSession.user)\
						.filter(WAMPSession.sessionid == details.caller).first()[1]
					print "%s -> %s%s" % (guser.username, func.__name__, args)
					return func(args, guser=guser, details=details)
				except Exception as e:
					db.session.rollback()
					print traceback.format_exc()
					raise e
			return func_wrapper

		def publish_message(dest, topic, msg=None, eligible=[]):
			if eligible != []:
				self.publish(dest, topic, msg=msg, options=PublishOptions(eligible=eligible))

		###########################

		@api_function
		def userList(_,guser=None, details=None):
			return stackptr_core.userList(guser=guser, db=db)

		@api_function
		def locHist((target,), guser=None, details=None):
			return stackptr_core.locHist(target=target, guser=guser, db=db)

		@api_function
		def addUser((user,), guser=None, details=None):
			return stackptr_core.addUser(user=user, pm=publish_message, guser=guser, db=db)

		@api_function
		def acceptUser((user,), guser=None, details=None):
			return stackptr_core.acceptUser(user=user, pm=publish_message, guser=guser, db=db)

		@api_function
		def delUser((user,), guser=None, details=None):
			return stackptr_core.delUser(user=user, pm=publish_message, guser=guser, db=db)

		###############################
		
		@api_function
		def groupList(_,guser=None, details=None):
			return stackptr_core.groupList(guser=guser,db=db)

		@api_function
		def groupDiscover(_,guser=None, details=None):
			return stackptr_core.groupDiscover(guser=guser,db=db)

		@api_function
		def createGroup((name,description,status),guser=None, details=None):
			return stackptr_core.createGroup(name=name, description=description, status=status, guser=guser, db=db)

		@api_function
		def joinGroup((gid,),guser=None, details=None):
			return stackptr_core.joinGroup(gid=gid, guser=guser, db=db)

		###############################

		@api_function
		def groupData((group,), guser=None, details=None):
			return stackptr_core.groupData(db=db,group=group)

		@api_function
		def addFeature((name, group, gjson), guser=None, details=None):
			return stackptr_core.addFeature(db=db, guser=guser, name=name, group=group, gjson=gjson)

		@api_function
		def renameFeature((id, name), guser=None, details=None):
			return stackptr_core.renameFeature(db=db, guser=guser, id=id, name=name)

		@api_function
		def deleteFeature((id,), guser=None, details=None):
			return stackptr_core.deleteFeature(db=db, guser=guser, id=id)

		################################
		
		try:
			yield self.register(locHist, 'com.stackptr.api.lochist', options=RegisterOptions(details_arg='details'))
			yield self.register(userList, 'com.stackptr.api.userList', options=RegisterOptions(details_arg='details'))
			yield self.register(addUser, 'com.stackptr.api.addUser', options=RegisterOptions(details_arg='details'))
			yield self.register(acceptUser, 'com.stackptr.api.acceptUser', options=RegisterOptions(details_arg='details'))
			yield self.register(delUser, 'com.stackptr.api.delUser', options=RegisterOptions(details_arg='details'))

			yield self.register(groupList, 'com.stackptr.api.groupList', options=RegisterOptions(details_arg='details'))
			yield self.register(groupDiscover, 'com.stackptr.api.groupDiscover', options=RegisterOptions(details_arg='details'))
			yield self.register(createGroup, 'com.stackptr.api.createGroup', options=RegisterOptions(details_arg='details'))
			yield self.register(joinGroup, 'com.stackptr.api.joinGroup', options=RegisterOptions(details_arg='details'))

			yield self.register(groupData, 'com.stackptr.api.groupData', options=RegisterOptions(details_arg='details'))
			yield self.register(addFeature, 'com.stackptr.api.addFeature', options=RegisterOptions(details_arg='details'))
			yield self.register(renameFeature, 'com.stackptr.api.renameFeature', options=RegisterOptions(details_arg='details'))
			yield self.register(deleteFeature, 'com.stackptr.api.deleteFeature', options=RegisterOptions(details_arg='details'))			
		except Exception as e:
			print "could not register api calls: %s" % e

class StackPtrSessionMonitor(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details=None):
		def on_session_join(details=None):
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
