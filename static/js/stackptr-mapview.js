var isMobileUi = L.Browser.mobile;

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

var app = angular.module("StackPtr", ['ui-leaflet', 'angularMoment', 'ngAnimate', 'ngSanitize', 'mgcrea.ngStrap', 'vxWamp', 'ngCookies', 'xeditable']);

app.config(['$wampProvider', '$modalProvider', '$compileProvider', function($wampProvider, $modalProvider, $compileProvider) {
	var wsurl = (stackptr_server_base_protocol == 'https:' ? 'wss://' : 'ws://') + stackptr_server_base_host + '/ws';
	$wampProvider.init({
		url: wsurl,
		realm: 'stackptr',
		authid: '-1',
		authmethods: ["ticket"],
		max_retries: -1,
		max_retry_delay: 60,
	});
	angular.extend($modalProvider.defaults, {
		html: true
	});
	$compileProvider.debugInfoEnabled(false);
}]);

app.run(['$http', 'editableOptions', function($http,editableOptions) {
	$http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
	editableOptions.theme = 'bs3';
}]);

var StackPtrConnect;
var StackPtrDisconnect;
var StackPtrCloseModal;
var setRoleUserClick;
var delUserClick;

app.controller("StackPtrMap", ['$scope', '$cookies', '$http', '$interval', 'leafletData', 'leafletDrawEvents', 'leafletMapEvents', '$wamp', '$compile', function($scope, $cookies, $http, $interval, leafletData, leafletDrawEvents, leafletMapEvents, $wamp, $compile) {

	stackptr_leafletdata_map = leafletData.getMap;

	$scope.isStackPtrAndroid = !(typeof stackptr_android == 'undefined');

	$scope.tiles = {
		name: ""
	}

	$scope.tileservers = {
		stackptr: {
			name: 'StackPtr Default Style',
			url: 'https://tile{s}.stackcdn.com/' + (L.Browser.retina ? 'osm_tiles_2x' : 'osm_tiles') + '/{z}/{x}/{y}.png',
			options: {
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 18,
				subdomains: '123456',
			}
		},
		stackptr_no_retina: {
			name: 'StackPtr Default No Retina',
			url: 'https://tile{s}.stackcdn.com/osm_tiles/{z}/{x}/{y}.png',
			options: {
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 18,
				subdomains: '123456',
			}
		},
		mqosm: {
			name: 'MapQuest OSM',
			url: 'https://otile{s}-s.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png',
			options: {
				attribution: 'Tiles courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a>, &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				subdomains: '1234',
			}
		}
	}

	$scope.getTileServer = function() {
		var default_tileserver = $scope.tileservers['stackptr']
		var cookie_ts_name = $cookies.get('tileserver')
		if (cookie_ts_name == undefined) return default_tileserver

		var cookie_ts = $scope.tileservers[cookie_ts_name]
		if (cookie_ts == undefined) return default_tileserver
		return cookie_ts
	}

	$scope.setTileServer = function(new_ts_name) {
		$cookies.put('tileserver', new_ts_name);
		angular.extend($scope, {
			tiles: $scope.getTileServer()
		});
	}

	$scope.$on('leafletDirectiveMap.moveend', function(event) {
		var expDate = new Date();
		expDate.setDate(expDate.getDate() + 365);
		var i = $scope.center;
		$cookies.put('last_lat', i.lat, {
			expires: expDate
		});
		$cookies.put('last_lng', i.lng, {
			expires: expDate
		});
		$cookies.put('last_zoom', i.zoom, {
			expires: expDate
		});
	});

	$cookies.has = function(key) {
		return $cookies.get(key) != undefined;
	}

	$scope.getLastPos = function() {
		if ($cookies.has('last_lat') && $cookies.has('last_lng') && $cookies.has('last_zoom')) {
			return {
				lat: parseFloat($cookies.get('last_lat')),
				lng: parseFloat($cookies.get('last_lng')),
				zoom: parseInt($cookies.get('last_zoom'))
			}
		} else {
			return {
				lat: -24,
				lng: 138,
				zoom: 5
			}
		}
	}

	$scope.getLastGroup = function() {
		if ($cookies.has('last_group')) {
			return parseInt($cookies.get('last_group'));
		} else {
			return -1;
		}
	}

	angular.extend($scope, {
		defaults: {
			maxZoom: 18,
			minZoom: 1,
			doubleClickZoom: true,
			scrollWheelZoom: true,
			attributionControl: true,
		},
		tiles: $scope.getTileServer(),
		center: $scope.getLastPos(),
		drawOptions: {
			draw: {
				circle: false
			},
			edit: {
				featureGroup: new L.FeatureGroup(),
				remove: true
			}
		}

	});

	$scope.markers = {};
	$scope.userList = {};
	$scope.userPending = {};
	$scope.userReqs = {};
	$scope.grouplist = {};
	$scope.group = $scope.getLastGroup();
	$scope.groupdata = {};
	$scope.userListEmpty = false;
	$scope.pendingListEmpty = false;
	$scope.reqsListEmpty = false;
	$scope.paths = {};
	$scope.discoverGroupList = {};
	$scope.groupsSharedTo = {};
	$scope.groupShareUsers = {};
	$scope.groupShareUsersEmpty = false;
	$scope.addingUser = null;
	$scope.hasDisconnected = false;

	$scope.processItem = function(item) {
		if (item.type == 'user') {
			item.data.forEach(function(v) {
				$scope.userList[v.id] = v;
				$scope.updateMarker(v);
			});
		} else if (item.type == 'user-del') {
			item.data.forEach(function(v) {
				delete $scope.userList[v.id];
				delete $scope.markers[v.id];
			});
		} else if (item.type == 'user-me') {
			$scope.userMe = item.data;
			$scope.updateMarker(item.data);
		} else if (item.type == 'user-pending') {
			item.data.forEach(function(v) {
				$scope.userPending[v.id] = v;
			});
			$scope.pendingListEmpty = ($scope.userPending.length) == 0;
		} else if (item.type == 'user-pending-del') {
			item.data.forEach(function(v) {
				delete $scope.userPending[v.id];
			});
		} else if (item.type == 'user-request') {
			item.data.forEach(function(v) {
				$scope.userReqs[v.id] = v;
			});
			$scope.reqsListEmpty = ($scope.userReqs.length) == 0;
		} else if (item.type == 'user-request-del') {
			item.data.forEach(function(v) {
				delete $scope.userReqs[v.id];
			});
		} else if (item.type == 'grouplist') {
			item.data.forEach(function(v) {
				v.members.forEach(function(vm) {
					if (vm.id == $scope.userMe.id) {
						this.role = vm.role;
					}
				}, v);
				$scope.grouplist[v.id] = v;
			});
		} else if (item.type == 'grouplist-del') {
			item.data.forEach(function(v) {
				delete $scope.grouplist[v.id];
				if ($scope.group == v.id) {
					$scope.resetGroup();
				}
			});
		} else if (item.type == 'groupdata') {
			item.data.forEach(function(v) {
				if (v.groupid == $scope.group) {
					$scope.groupdata[v.id] = v;

					$scope.updateGroupData(v.id);
				}
			});
		} else if (item.type == 'groupdata-del') {
			item.data.forEach(function(v) {
				delete $scope.groupdata[v.id];
				$scope.updateDelGroupData(v.id);
			});
		} else if (item.type == 'lochist') {
			item.data.forEach(function(v) {
				$scope.paths[v.id].latlngs = v.lochist;
			});
		} else if (item.type == 'grouplocshare') {
			item.data.forEach(function(v) {
				$scope.groupsSharedTo[v.gid] = v;
			});
		} else if (item.type == 'grouplocshare-del') {
			item.data.forEach(function(v) {
				delete $scope.groupsSharedTo[v.gid];
			});
		} else if (item.type == 'grouplocshareuser') {
			item.data.forEach(function(v) {
				if (v.gid == $scope.group) {
					$scope.groupShareUsers[v.id] = v;
					$scope.updateMarker(v);
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

	$scope.processData = function(data, status, headers, config) {
		data.forEach(function(item) {
			$scope.processItem(item);
		});
	};


	$scope.counter = 0;
	$scope.status = "Connecting to server...";

	$scope.clickMarker = function(user) {
		var isGroupShare = !(user.gid == undefined);
		var markerId = isGroupShare ? (user.gid + ":" + user.id) : user.id;

		$scope.center.lat = user.loc[0];
		$scope.center.lng = user.loc[1];
		$scope.center.zoom = 16;
		$scope.markers[markerId].focus = true;
		if (isMobileUi) {
			if (isGroupShare) {
				$scope.toggleGroupMenu();
			} else {
				$scope.toggleUserMenu();
			}
		}
	}

	$scope.updateMarker = function(userObj) {
		var isGroupShare = !(userObj.gid == undefined);
		var isMe = (userObj.id == $scope.userMe.id);
		var markerId = isGroupShare ? (userObj.gid + ":" + userObj.id) : userObj.id;

		if (isGroupShare && isMe) return;
		if (isGroupShare && ($scope.userList[userObj.id] != undefined)) return;

		if ($scope.markers[markerId] == null) {
			$scope.markers[markerId] = {
				icon: {
					iconUrl: userObj.icon,
					iconSize: [32, 32],
					iconAnchor: [16, 16],
				},
				message: '<div ng-include="\'static/template/user.html\'"></div>',
				getMessageScope: function() {
					var sc = $scope.$new(false);
					sc.userId = userObj.id;
					sc.isGroup = isGroupShare;
					sc.isMe = isMe;
					return sc;
				},
				focus: false,
			};
			$scope.paths[markerId] = {
				color: 'black',
				opacity: 0.8,
				weight: 3,
				latlngs: []
			};

			var img = new Image();
			img.onload = function() {
				var colourThief = new ColorThief();
				var colour = colourThief.getColor(img);
				$scope.paths[markerId].color = rgb2hash(colour[0], colour[1], colour[2]);
			};
			img.crossOrigin = 'Anonymous';
			img.src = userObj.icon;
			if (userObj.gid == undefined) {
				$wamp.call('com.stackptr.api.lochist', [], {
					target: userObj.id
				}).then($scope.processData);
			}
		}
		$scope.markers[markerId].lat = userObj.loc[0];
		$scope.markers[markerId].lng = userObj.loc[1];
		$scope.paths[markerId].latlngs.push({
			lat: userObj.loc[0],
			lng: userObj.loc[1]
		})

	}

	/////

	$scope.closeGroupOnMobileUI = function() {
		if (isMobileUi) {
			$scope.toggleGroupMenu();
		}
	}

	/////

	$scope.createNewGroup = function(hide, $event) {
		var etf = $event.target.form;
		$wamp.call('com.stackptr.api.createGroup', [], {
			name: etf.groupname.value,
			description: etf.groupdesc.value,
			status: etf.mode.checked ? "1" : "0"
		}).then($scope.postGroupCreated);
		hide();
	};

	$scope.postGroupCreated = function(data) {
		$scope.processData(data);
		var groupId = parseInt(data[0].data[0].id);
		$scope.group = groupId;
		$scope.selectGroup();
	}

	$scope.groupDiscover = function() {
		$scope.discoverGroupList = [];
		$wamp.call('com.stackptr.api.groupDiscover').then($scope.groupDiscovered);
		$scope.closeGroupOnMobileUI();
	}

	$scope.groupDiscovered = function(data) {
		$scope.discoverGroupList = data[0].data;
	}

	$scope.groupAdd = function() {
		$scope.closeGroupOnMobileUI();
	}

	$scope.groupInfo = function() {
		$scope.closeGroupOnMobileUI();
	}

	$scope.joinGroup = function(group, hide, $event) {
		$wamp.call('com.stackptr.api.joinGroup', [], {
			gid: group.id
		}).then($scope.postGroupJoined);
		hide();
	}

	$scope.postGroupJoined = function(data) {
		$scope.processData(data);
		var groupId = parseInt(data[0].data[0].id);
		$scope.group = groupId;
		$scope.selectGroup();
	}

	$scope.leaveGroup = function(group, hide, $event) {
		$wamp.call('com.stackptr.api.leaveGroup', [], {
			gid: $scope.group
		}).then($scope.postGroupLeft);
		hide();
	}

	$scope.deleteGroup = function(group, hide, $event) {
		$wamp.call('com.stackptr.api.deleteGroup', [], {
			gid: $scope.group
		}).then($scope.processData);
		hide();
	}

	$scope.resetGroup = function() {
		var key = null;
		for (key in $scope.grouplist) break;
		$scope.group = parseInt(key);
		$scope.selectGroup();
	}

	$scope.postGroupLeft = function(data) {
		$scope.processData(data);
		if (data[0].type != "error") {
			$scope.resetGroup();
		}	
	}

	$scope.updateGroupName = function(gname, group) {
		$wamp.call('com.stackptr.api.updateGroup', [], {
			gid: group,
			name: gname,
		}).then($scope.processData);
		return false;
	}

	$scope.updateGroupDescription = function(gdesc, group) {
		$wamp.call('com.stackptr.api.updateGroup', [], {
			gid: group,
			description: gdesc,
		}).then($scope.processData);
		return false;
	}

	$scope.updateGroupVisibility = function(vis, group) {
		$wamp.call('com.stackptr.api.updateGroup', [], {
			gid: group,
			status: vis ? "0" : "1",
		}).then($scope.processData);
		return false;
	}

	$scope.addUserPopup = function(user) {
		$scope.addingUser = user;
	}

	$scope.groupAddUser = function($event, role) {
		var etf = $event.target.form || $event.target;
		$wamp.call('com.stackptr.api.groupUserMod', [], {
			gid: $scope.group,
			user: etf.user.value,
			role: role
		}).then($scope.processData);
	};

	$scope.setRoleUser = setRoleUserClick = function(uid, role) {
		$wamp.call('com.stackptr.api.groupUserMod', [], {
			gid: $scope.group,
			uid: uid,
			role: role
		}).then($scope.processData);
	};

	/////

	$scope.updateGroupData = function(cid) {
		var gd = $scope.groupdata;
		var di = $scope.drawOptions.edit.featureGroup;

		var item = gd[cid];
		item.json.id = item.id;
		var layer = L.geoJson(item.json);

		var remove = [];
		di.eachLayer(function(layer) {
			if (layer.id == cid) {
				di.removeLayer(layer);
			}
		});

		var geom0 = layer.getLayers()[0];
		geom0.id = item.id;

		geom0.bindPopup('<div ng-include="\'static/template/feature.html\'"></div>',{
			closeButton: true,
			minWidth: 320,
			getScope: function() {
				var sc = $scope.$new(false);
				sc.item = item;
				return sc;
			}
		});

		di.addLayer(geom0);
	}

	$scope.$on('leafletDirectiveMap.popupopen', function(event, leafletEvent) {
		var popup = leafletEvent.leafletEvent.popup;
		var getScope = popup.options.getScope;
		var content = popup._contentNode;

		if (getScope != undefined) {
			popup.options.scope = getScope();
			$compile(content)(popup.options.scope);
		}
	});

	$scope.$on('leafletDirectiveMap.popupclose', function(event, leafletEvent) {
		leafletEvent.leafletEvent.popup.options.scope.$destroy();
	});

	$scope.updateDelGroupData = function(cid) {
		var di = $scope.drawOptions.edit.featureGroup;

		var remove = [];
		di.eachLayer(function(layer) {
			if (layer.id == cid) {
				di.removeLayer(layer);
			}
		});
	}

	$scope.selectGroup = function() {
		var expDate = new Date();
		expDate.setDate(expDate.getDate() + 365);
		var i = $scope.center;
		$cookies.put('last_group', parseInt($scope.group), {
			expires: expDate
		});

		var di = $scope.drawOptions.edit.featureGroup;
		$scope.groupdata = {};
		$scope.groupShareUsers = {};
		$.each($scope.markers, function(v) {
			if (v.indexOf(":") > 0) {
				delete $scope.markers[v];
			}
		});
		$.each($scope.paths, function(v) {
			if (v.indexOf(":") > 0) {
				delete $scope.paths[v];
			}
		});
		di.clearLayers();

		$wamp.call('com.stackptr.api.groupData', [], {
			gid: $scope.group
		}).then($scope.processData);
		$wamp.call('com.stackptr.api.sharedGroupLocs', [], {
			gid: $scope.group
		}).then($scope.processData);
	}

	$scope.postNewItem = function(data) {
		$scope.processData(data);
		var featureId = parseInt(data[0].data[0].id);

		$("#groupmenu").on("DOMSubtreeModified", function() {
			var fbox = $("#feature-" + featureId);
			if (fbox.length) {
				$("#groupfeaturelist").find(".panel-collapse").collapse("hide");
				fbox.children(".panel-collapse").collapse("show");
				$("#groupmenu").off("DOMSubtreeModified");
			}
		});
	}

	$scope.$on('leafletDirectiveDraw.draw:created', function(e, payload) {
		var layer = payload.leafletEvent.layer;
		$wamp.call('com.stackptr.api.addFeature', [], {
			name: 'Untitled',
			group: $scope.group,
			gjson: JSON.stringify(layer.toGeoJSON())
		}).then($scope.postNewItem);
	});

	$scope.$on('leafletDirectiveDraw.draw:edited', function(e, payload) {
		payload.leafletEvent.layers.eachLayer(function(layer) {
			$wamp.call('com.stackptr.api.editFeature', [], {
				fid: layer.id,
				gjson: JSON.stringify(layer.toGeoJSON())
			}).then($scope.processData);
		});
	});

	$scope.$on('leafletDirectiveDraw.draw:deleted', function(e, payload) {
		payload.leafletEvent.layers.eachLayer(function(layer) {
			$wamp.call('com.stackptr.api.deleteFeature', [], {
				fid: layer.id
			}).then($scope.processData);
		});
	});

	$scope.renameGroupItem = function(newname,item) {
		$wamp.call('com.stackptr.api.editFeature', [], {
			fid: item.id,
			name: newname
		}).then($scope.processData);
		return false;
	};

	$scope.redescriptionGroupItem = function(newdesc,item) {
		$wamp.call('com.stackptr.api.editFeature', [], {
			fid: item.id,
			description: newdesc
		}).then($scope.processData);
		return false;
	};

	$scope.removeGroupItem = function($event) {
		var etf = $event.target.form;
		$wamp.call('com.stackptr.api.deleteFeature', [], {
			fid: etf.id.value
		}).then($scope.processData);
	};

	$scope.gotoItem = function(item) {
		var items = $scope.drawOptions.edit.featureGroup;
		items.eachLayer(function(v) {
			if (v.id == item) {
				if (v.getBounds) {
					var bounds = v.getBounds();
					$scope.center.lat = (bounds._northEast.lat + bounds._southWest.lat) / 2;
					$scope.center.lng = (bounds._northEast.lng + bounds._southWest.lng) / 2;
				} else {
					var loc = v.getLatLng();
					$scope.center.lat = loc.lat;
					$scope.center.lng = loc.lng;
				}
				v.openPopup();
			}
		});
		$scope.closeGroupOnMobileUI();
	}

	///////////

	$scope.setShareToGroup = function(group, share, hide, $event) {
		$wamp.call('com.stackptr.api.setShareToGroup', [], {
			gid: group,
			share: share
		}).then($scope.processData);
		if (hide) hide();
	}

	///////////


	$scope.addUser = function($event) {
		var etf = $event.target.form || $event.target;
		$wamp.call('com.stackptr.api.addUser', [], {
			user: etf.user.value
		}).then($scope.processData);
	};

	$scope.delUser = delUserClick = function(uid) {
		$wamp.call('com.stackptr.api.delUser', [], {
			uid: uid
		}).then($scope.processData);
	}

	$scope.acceptUser = function(uid) {
		$wamp.call('com.stackptr.api.acceptUser', [], {
			uid: uid
		}).then($scope.processData);
	}


	///////////

	$scope.getCSRFTokenThen = function(f) {
		if (stackptr_apikey == undefined) {
			var csrf = $http.get(stackptr_server_base_addr + '/csrf', "");
			csrf.success(function(cdata, status, headers, config) {
				$http.defaults.headers.post['X-CSRFToken'] = cdata;
				f();
			});
		} else {
			f();
		}
	};

	$scope.doConnect = StackPtrConnect = function() {
		console.log("Connecting");
		$scope.hasDisconnected = false;
		$wamp.open();
	}

	$scope.doConnect();

	$scope.doDisconnect = StackPtrDisconnect = function() {
		console.log("Disconnecting");
		$scope.hasDisconnected = true;
		$wamp.close();
	}

	$scope.$on("$wamp.onchallenge", function(event, data) {
		console.log(data);
		if (data.method === "ticket") {
			if (stackptr_apikey != undefined) {
				data.promise.resolve(stackptr_apikey);
			} else {
				$scope.getCSRFTokenThen(function() {
					$scope.getWSToken(data);
				});
			}
		} else {
			alert("Could not auth to server - ticket auth not offered!");
		}
	});

	$scope.getWSToken = function(data) {
		$http.post(stackptr_server_base_addr + '/ws_token').then(
			function success(response) {
				data.promise.resolve(response.data);
			},
			function failure(response) {
				if (!(typeof stackptr_connection_failed === 'undefined')) {
					stackptr_connection_failed("ws_token fetch failed", "");
				}
			}
		);
	}

	$scope.$on("$wamp.open", function(event, session) {
		$scope.status = "Connected";

		$wamp.subscribe('com.stackptr.user', $scope.processWS);
		$wamp.subscribe('com.stackptr.group', $scope.processWS);

		$wamp.call('com.stackptr.api.userList').then($scope.postUserList);
		$wamp.call('com.stackptr.api.groupList').then($scope.postGroupList);
		$wamp.call('com.stackptr.api.getSharedToGroups').then($scope.processData);
		$wamp.call('com.stackptr.api.groupData', [], {
			gid: $scope.group
		}).then($scope.processData);
		$wamp.call('com.stackptr.api.sharedGroupLocs', [], {
			gid: $scope.group
		}).then($scope.processData);
	});

	$scope.postGroupList = function(data) {
		$scope.processData(data);
		if ($scope.group < 0) {
			$scope.resetGroup();
		}
	}

	$scope.postUserList = function(data) {
		$scope.processData(data);
		$scope.userListEmpty = $.isEmptyObject($scope.userList);
	}

	$scope.$on("$wamp.close", function(event, data) {
		$scope.status = "Disconnected: " + data.reason;
		$scope.reason = data.reason;
		$scope.details = data.details;
		if (!$scope.hasDisconnected && 
			!(typeof stackptr_connection_failed === 'undefined')) {
				stackptr_connection_failed(data.reason, data.details);
		}
		
	});

	$scope.processWS = function(type, data) {
		$scope.processItem({
			type: type[0],
			data: data.msg
		});
	};


	$scope.toggleUserMenu = function() {
		if (isMobileUi) {
			var um = $("#usermenu");
			var w = $(window);

			um.css("height", w.height());
			um.css("width", w.width());
			um.css("top", 0);
			um.css("z-index", 9001);
			um.toggle();
			if (um.is(':visible')) {
				$scope.closeModal = $scope.toggleUserMenu;
			} else {
				$scope.closeModal = null;
			}
		} else {
			$("#usermenu").toggle();
		}
	}

	$scope.toggleGroupMenu = function() {
		if (isMobileUi) {
			var gm = $("#groupmenu");
			var w = $(window);

			gm.css("height", w.height());
			gm.css("width", w.width());
			gm.css("top", 0);
			gm.css("z-index", 9001);
			gm.toggle();
			if (gm.is(':visible')) {
				$scope.closeModal = $scope.toggleGroupMenu;
			} else {
				$scope.closeModal = null;
			}
		} else {
			$("#groupmenu").toggle();
		}
	}

	$scope.share_user = function(obj) {
	if (!(typeof stackptr_share_user === 'undefined')) {
			stackptr_share_user(obj);
	  }
  }

  	////////////
  	// mobile clients
  	////////////

  	$scope.closeModal = null;

	$scope.$on('modal.hide', function() {
		$scope.closeModal = null;
	});
	
	$scope.$on('modal.show', function(modal) {
		$scope.closeModal = function() {
			angular.element('.modal').trigger('click');
		};
	});

  	$scope.doCloseModal = StackPtrCloseModal = function() {
  		if ($scope.closeModal == null) {
  			return false;
  		} else {
  			$scope.closeModal();
  			$scope.closeModal = null;
  			return true;
  		}
  	}

	////////////
	// android client
	////////////

	$scope.serviceRunning = $scope.isStackPtrAndroid && (StackPtrAndroidShim.serviceRunning() == "true");

	$scope.stopAndroidService = function() {
		console.log("stopping service")
		StackPtrAndroidShim.serviceStop();
		$scope.serviceRunning = false;
	}
	$scope.startAndroidService = function() {
		console.log("starting service")
		StackPtrAndroidShim.serviceStart();
		$scope.serviceRunning = true;
	}

}]);

app.filter('updateRange', function() {
	return function(items, agemin, agemax) {
		var curTime = Math.round(new Date().getTime() / 1000);
		var filtered = [];
		//items.forEach(function(item) {
		for (id in items) {
			var item = items[id];
			var updateTime = curTime - item.lastupd;
			// fixme: client/server time mismatch
			if (updateTime < 0) {
				updateTime = 0;
			}
			if ((updateTime >= agemin) && ((updateTime < agemax) || (agemax == -1))) {
				filtered.push(item);
			}
			//});
		}
		return filtered;
	};

});

function shiftGroupMenu() {
	var um = $("#usermenu");
	var gm = $("#groupmenu");

	var ump = um.position();
	var umb = ump.top + um.height();
	gm.css("top", umb + 8);
	var umr = $(window).width() - (ump.left + um.width() + 2);
	gm.css("right", umr);

	var wh = $(window).height();
	gm.css("height", wh - umb - 16);
}

$(document).ready(function() {
	if (isMobileUi) {
		$("#usermenu").hide();
		$("#groupmenu").hide();
	} else {
		$("#usermenu").draggable();
		$("#groupmenu").draggable().resizable({
			minHeight: 96,
			minWidth: 192
		});

		$("#groupmenu").on("dragstart", function(e, u) {
			$("#usermenu").off("DOMSubtreeModified");
		});

		shiftGroupMenu();

		$("#usermenu").on("DOMSubtreeModified", shiftGroupMenu);
	}
});