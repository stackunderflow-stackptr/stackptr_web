if (typeof stackptr_server_base_host === 'undefined') {
	stackptr_server_base_host = window.location.host
}

if (typeof stackptr_server_base_protocol === 'undefined') {
	stackptr_server_base_protocol = window.location.protocol
}

if (typeof stackptr_apikey == 'undefined') {
	stackptr_apikey = location.search.split("=")[1];
}

stackptr_server_base_addr = stackptr_server_base_protocol + "//" + stackptr_server_base_host;

var wsurl = (stackptr_server_base_protocol == 'https:' ? 'wss://' : 'ws://') + stackptr_server_base_host + '/ws';

function getCSRFTokenThen(f) {
	if (stackptr_apikey == undefined) {
		var csrf = $.get(stackptr_server_base_addr + '/csrf', "");
		csrf.success(function(cdata, status, headers, config) {
			$.ajaxSetup({headers: { 'X-CSRFToken': cdata }});
			f();
		});
	} else {
		f();
	}
};

function getWSToken(promise) {
	$.post(stackptr_server_base_addr + '/ws_token').then(
		function success(response) {
			promise.resolve(response);
		},
		function failure(response) {
			if (!(typeof stackptr_connection_failed === 'undefined')) {
				stackptr_connection_failed("ws_token fetch failed", "");
			}
			promise.reject();
		}
	);
}

var connection = new autobahn.Connection({
		url: wsurl,
		realm: 'stackptr',
		authid: '-1',
		authmethods: ["ticket"],
		max_retries: -1,
		max_retry_delay: 60,
		onchallenge: function(session,method,extra) {
			if (method === "ticket") {
				if (stackptr_apikey != undefined) {
					return stackptr_apikey;
				} else {
					var deferred = Q.defer();
					getCSRFTokenThen(function() {
						getWSToken(deferred);
					});
					return deferred.promise;
				}
			} else {
				alert("Could not auth to server - ticket auth not offered!");
			}
		}
});

data = {
	'userList': {},
	'userMe': null,
	'userPending': {},
	'userReqs': {},
	'grouplist': {},
	'group': null,




}


function processItem(item) {
	if (item.type == 'user') {
		item.data.forEach(function(v) {
			data.userList[v.id] = v;
			//$scope.updateMarker(v);
		});
	} else if (item.type == 'user-del') {
		item.data.forEach(function(v) {
			delete data.userList[v.id];
			//delete $scope.markers[v.id];
		});
	} else if (item.type == 'user-me') {
		data['userMe'] = item.data;
		//$scope.updateMarker(item.data);
	} else if (item.type == 'user-pending') {
		item.data.forEach(function(v) {
			data.userPending[v.id] = v;
		});
		//$scope.pendingListEmpty = ($scope.userPending.length) == 0;
	} else if (item.type == 'user-pending-del') {
		item.data.forEach(function(v) {
			delete data.userPending[v.id];
		});
	} else if (item.type == 'user-request') {
		item.data.forEach(function(v) {
			data.userReqs[v.id] = v;
		});
		//$scope.reqsListEmpty = ($scope.userReqs.length) == 0;
	} else if (item.type == 'user-request-del') {
		item.data.forEach(function(v) {
			delete data.userReqs[v.id];
		});
	} else if (item.type == 'grouplist') {
		item.data.forEach(function(v) {
			v.members.forEach(function(vm) {
				if (vm.id == data.userMe.id) {
					this.role = vm.role;
				}
			}, v);
			data.grouplist[v.id] = v;
		});
	} else if (item.type == 'grouplist-del') {
		item.data.forEach(function(v) {
			delete data.grouplist[v.id];
			if (data.group == v.id) {
				//$scope.resetGroup();
			}
		});
	} else if (item.type == 'groupdata') {
		item.data.forEach(function(v) {
			if (v.groupid == data.group) {
				data.groupdata[v.id] = v;
				//$scope.updateGroupData(v.id);
			}
		});
	} else if (item.type == 'groupdata-del') {
		item.data.forEach(function(v) {
			delete data.groupdata[v.id];
			//$scope.updateDelGroupData(v.id);
		});
	} else if (item.type == 'lochist') {
		item.data.forEach(function(v) {
			//$scope.paths[v.id].latlngs = v.lochist;
		});
	} else if (item.type == 'grouplocshare') {
		item.data.forEach(function(v) {
			//$scope.groupsSharedTo[v.gid] = v;
		});
	} else if (item.type == 'grouplocshare-del') {
		item.data.forEach(function(v) {
			//delete $scope.groupsSharedTo[v.gid];
		});
	} else if (item.type == 'grouplocshareuser') {
		item.data.forEach(function(v) {
			if (v.gid == $scope.group) {
				//$scope.groupShareUsers[v.id] = v;
				//$scope.updateMarker(v);
			}
		});
		$scope.groupShareUsersEmpty = $.isEmptyObject($scope.groupShareUsers);
	} else if (item.type == 'grouplocshareuser-del') {
		item.data.forEach(function(v) {
			if (v.gid == $scope.group) {
				delete $scope.groupShareUsers[v.id];
				delete $scope.markers[v.gid + ":" + v.id];
			}
		});
		$scope.groupShareUsersEmpty = $.isEmptyObject($scope.groupShareUsers);
	} else if (item.type == 'error') {
		alert(item.data);
	} else {
		console.log(item);
	}
}

function processData(data, status, headers, config) {
	data.forEach(function(item) {
		processItem(item);
	});
};

connection.onopen = function(session) {
	//$scope.status = "Connected";

	//session.subscribe('com.stackptr.user', processWS);
	//session.subscribe('com.stackptr.group', processWS);

	session.call('com.stackptr.api.userList').then(function(data) {
		processData(data);
		//$scope.userListEmpty = $.isEmptyObject($scope.userList);
	});
	
	session.call('com.stackptr.api.groupList').then(function(data) {
		processData(data);
		//if ($scope.group < 0) {
		//	$scope.resetGroup();
		//}
	});
	
	session.call('com.stackptr.api.getSharedToGroups').then(processData);
	/*session.call('com.stackptr.api.groupData', [], {
		gid: $scope.group
	}).then($scope.processData);
	session.call('com.stackptr.api.sharedGroupLocs', [], {
		gid: $scope.group
	}).then($scope.processData);*/
}

function libstackptr_connect() {
	connection.open();
}