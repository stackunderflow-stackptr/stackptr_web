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
				uid = None
				if len(ticket) == 30: # is generated from /ws_token
					res = db.session.query(AuthTicket).filter_by(key=ticket).first()
					if res:
						db.session.delete(res)
						db.session.commit()
						#fixme: check date
						print "authenticated by ticket"
						uid = res.userid
					else:
						raise ApplicationError("invalid-ticket", "invalid ticket %s" % ticket)
				elif len(ticket) == 32: # is an API key
					res = db.session.query(ApiKey).filter_by(key=ticket).first()
					if res:
						print "authenticated by apikey"
						uid = res.userid
					else:
						raise ApplicationError("invalid-ticket", "invalid api key %s" % ticket)
				else:
					raise ApplicationError("invalid-ticket", "unrecognised login %s" % ticket)
				# we didn't bail out before now, so the session is valid, so save it
				session = WAMPSession()
				session.user = uid
				session.sessionid = int(details['session'])
				db.session.add(session)
				db.session.commit()
				print "session added: %i" % session.sessionid
				return u"user"
			except Exception as e:
				db.session.rollback()
				print traceback.format_exc()
				raise e
		
		try:
			yield self.register(authenticate, u'com.stackptr.authenticate')
			print("authenticator registered")
		except Exception as e:
			print("could not register authenticator")
			print traceback.format_exc()

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
			yield self.register(locHist, u'com.stackptr.api.lochist', options=ro)
			yield self.register(userList, u'com.stackptr.api.userList', options=ro)
			yield self.register(addUser, u'com.stackptr.api.addUser', options=ro)
			yield self.register(acceptUser, u'com.stackptr.api.acceptUser', options=ro)
			yield self.register(delUser, u'com.stackptr.api.delUser', options=ro)

			yield self.register(groupList, u'com.stackptr.api.groupList', options=ro)
			yield self.register(groupDiscover, u'com.stackptr.api.groupDiscover', options=ro)
			yield self.register(createGroup, u'com.stackptr.api.createGroup', options=ro)
			yield self.register(joinGroup, u'com.stackptr.api.joinGroup', options=ro)
			yield self.register(groupUserMod, u'com.stackptr.api.groupUserMod', options=ro)
			yield self.register(leaveGroup, u'com.stackptr.api.leaveGroup', options=ro)
			yield self.register(deleteGroup, u'com.stackptr.api.deleteGroup', options=ro)
			yield self.register(updateGroup, u'com.stackptr.api.updateGroup', options=ro)

			yield self.register(getSharedToGroups, u'com.stackptr.api.getSharedToGroups', options=ro)
			yield self.register(setShareToGroup, u'com.stackptr.api.setShareToGroup', options=ro)
			yield self.register(sharedGroupLocs, u'com.stackptr.api.sharedGroupLocs', options=ro)
			#yield self.register(sharedGroupLocHistory, 'com.stackptr.api.sharedGroupLocHistory', options=ro)

			yield self.register(groupData, u'com.stackptr.api.groupData', options=ro)
			yield self.register(addFeature, u'com.stackptr.api.addFeature', options=ro)
			yield self.register(editFeature, u'com.stackptr.api.editFeature', options=ro)
			yield self.register(deleteFeature, u'com.stackptr.api.deleteFeature', options=ro)
		except Exception as e:
			print("could not register api calls")
			print traceback.format_exc()

class StackPtrSessionMonitor(ApplicationSession):
	@inlineCallbacks
	def onJoin(self, details=None):
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
				print("could not remove sessions")
				print traceback.format_exc()
		
		try:
			print "removed %i old sessions" % db.session.query(WAMPSession).delete()
			db.session.commit()
			yield self.subscribe(on_session_leave, u'wamp.session.on_leave')
			print "sessionmonitor registered"
		except Exception as e:
			print("could not register session monitor")
			print traceback.format_exc()
