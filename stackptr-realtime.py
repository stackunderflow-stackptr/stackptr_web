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
		def authenticate(realm, authid, details):
			try:
				ticket = details['ticket']
				if len(ticket) == 30:
					res = db.session.query(AuthTicket).filter_by(key=ticket, userid=authid).first()
					if res:
						db.session.delete(res)
						db.session.commit()
						#fixme: check date
						print "authenticated by ticket"
						return u"user"
				elif len(ticket) == 32:
					res = db.session.query(ApiKey).filter_by(key=ticket, userid=authid).first()
					if res:
						print "authenticated by apikey"
						return u"user"
				else:
					raise ApplicationError("invalid-ticket", "invalid ticket %s" % ticket)
			except Exception as e:
				db.session.rollback()
				print traceback.format_exc()
				raise e
		
		try:
			yield self.register(authenticate, 'com.stackptr.authenticate')
			print("authenticator registered")
		except Exception as e:
			print("could not register authenticator: %s" % e)

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
					printargs = filter(lambda a: a != 'details', kwargs)
					printlist = map(lambda b: "%s=%s" % (b, kwargs[b]), printargs)
					print "%s -> %s(%s)" % (guser.username, func.__name__, ", ".join(printlist))
					return func(guser=guser, **kwargs)
				except Exception as e:
					db.session.rollback()
					print traceback.format_exc()
			return func_wrapper

		def publish_message(dest, topic, msg=None, eligible=[]):
			if eligible != []:
				self.publish(dest, topic, msg=msg, options=PublishOptions(eligible=eligible))

		###########################

		@api_function
		def userList(guser=None, details=None):
			return stackptr_core.userList(guser=guser, db=db)

		@api_function
		def locHist(guser=None, details=None, target=None):
			return stackptr_core.locHist(target=target, guser=guser, db=db)

		@api_function
		def addUser(guser=None, details=None, user=None):
			return stackptr_core.addUser(user=user, pm=publish_message, guser=guser, db=db)

		@api_function
		def acceptUser(guser=None, details=None, uid=None):
			return stackptr_core.acceptUser(uid=uid, pm=publish_message, guser=guser, db=db)

		@api_function
		def delUser(guser=None, details=None, uid=None):
			return stackptr_core.delUser(uid=uid, pm=publish_message, guser=guser, db=db)

		###############################
		
		@api_function
		def groupList(guser=None, details=None):
			return stackptr_core.groupList(guser=guser,db=db)

		@api_function
		def groupDiscover(guser=None, details=None):
			return stackptr_core.groupDiscover(guser=guser,db=db)

		@api_function
		def createGroup(guser=None, details=None, name=None, description=None, status=None):
			return stackptr_core.createGroup(name=name, description=description, status=status, guser=guser, db=db)

		@api_function
		def joinGroup(guser=None, details=None, gid=None):
			return stackptr_core.joinGroup(gid=gid, pm=publish_message, guser=guser, db=db)

		@api_function
		def groupUserMod(gid=None, uid=None, user=None, role=None, pm=None, guser=None, details=None):
			return stackptr_core.groupUserMod(gid=gid, uid=uid, user=user, role=role, pm=publish_message, guser=guser, db=db)
		
		@api_function
		def leaveGroup(guser=None, details=None, gid=None):
			return stackptr_core.leaveGroup(gid=gid, pm=publish_message, guser=guser, db=db)
		
		@api_function
		def deleteGroup(guser=None, details=None, gid=None):
			return stackptr_core.deleteGroup(gid=gid, pm=publish_message, guser=guser, db=db)

		@api_function
		def updateGroup(guser=None, details=None, gid=None, name=None, description=None, status=None):
			return stackptr_core.updateGroup(gid=gid, pm=publish_message, name=name, description=description, status=status, guser=guser, db=db)

		###############################

		@api_function
		def groupData(guser=None, details=None, gid=None):
			return stackptr_core.groupData(db=db, guser=guser, gid=gid)

		@api_function
		def addFeature(guser=None, details=None, name=None, group=None, gjson=None, description=None):
			return stackptr_core.addFeature(db=db, pm=publish_message, guser=guser, name=name, description=description, group=group, gjson=gjson)

		@api_function
		def editFeature(guser=None, details=None, fid=None, gjson=None, name=None, description=None):
			return stackptr_core.editFeature(db=db, pm=publish_message, guser=guser, fid=fid, gjson=gjson, name=name, description=description)

		@api_function
		def deleteFeature(guser=None, details=None, fid=None):
			return stackptr_core.deleteFeature(db=db, pm=publish_message, guser=guser, fid=fid)

		###############################

		@api_function
		def getSharedToGroups(guser=None, details=None):
			return stackptr_core.getSharedToGroups(db=db, guser=guser)

		@api_function
		def setShareToGroup(gid=None, share=None, guser=None, details=None):
			return stackptr_core.setShareToGroup(gid=gid, db=db, guser=guser, share=share, pm=publish_message)

		@api_function
		def sharedGroupLocs(gid=None, guser=None, details=None):
			return stackptr_core.sharedGroupLocs(gid=gid, db=db, guser=guser)

		#@api_function
		#def sharedGroupLocHistory(gid=None, guser=None, details=None, db=None):
		#	return stackptr_core.sharedGroupLocHistory(gid=gid, db=db, )

		################################

		ro = RegisterOptions(details_arg='details')
		
		try:
			yield self.register(locHist, 'com.stackptr.api.lochist', options=ro)
			yield self.register(userList, 'com.stackptr.api.userList', options=ro)
			yield self.register(addUser, 'com.stackptr.api.addUser', options=ro)
			yield self.register(acceptUser, 'com.stackptr.api.acceptUser', options=ro)
			yield self.register(delUser, 'com.stackptr.api.delUser', options=ro)

			yield self.register(groupList, 'com.stackptr.api.groupList', options=ro)
			yield self.register(groupDiscover, 'com.stackptr.api.groupDiscover', options=ro)
			yield self.register(createGroup, 'com.stackptr.api.createGroup', options=ro)
			yield self.register(joinGroup, 'com.stackptr.api.joinGroup', options=ro)
			yield self.register(groupUserMod, 'com.stackptr.api.groupUserMod', options=ro)
			yield self.register(leaveGroup, 'com.stackptr.api.leaveGroup', options=ro)
			yield self.register(deleteGroup, 'com.stackptr.api.deleteGroup', options=ro)
			yield self.register(updateGroup, 'com.stackptr.api.updateGroup', options=ro)

			yield self.register(getSharedToGroups, 'com.stackptr.api.getSharedToGroups', options=ro)
			yield self.register(setShareToGroup, 'com.stackptr.api.setShareToGroup', options=ro)
			yield self.register(sharedGroupLocs, 'com.stackptr.api.sharedGroupLocs', options=ro)
			#yield self.register(sharedGroupLocHistory, 'com.stackptr.api.sharedGroupLocHistory', options=ro)

			yield self.register(groupData, 'com.stackptr.api.groupData', options=ro)
			yield self.register(addFeature, 'com.stackptr.api.addFeature', options=ro)
			yield self.register(editFeature, 'com.stackptr.api.editFeature', options=ro)
			yield self.register(deleteFeature, 'com.stackptr.api.deleteFeature', options=ro)
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
				if session:
					db.session.delete(session)
					db.session.commit()
					print "session removed: %i" % sessionid
				else:
					print "removed nonexistant session"
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
