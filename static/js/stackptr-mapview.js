// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps
var isMobileUi = L.Browser.mobile;

var app = angular.module("StackPtr", ['ui-leaflet', 'angularMoment', 'ngAnimate', 'ngSanitize', 'mgcrea.ngStrap', 'vxWamp', 'ngCookies']).config(function($interpolateProvider) {
	$interpolateProvider.startSymbol('[[').endSymbol(']]');
});

app.config(function($wampProvider, $modalProvider) {
	$wampProvider.init({
		url: (window.location.protocol == 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws',
		realm: 'stackptr',
		authmethods: ["ticket"],
		max_retries: -1,
		max_retry_delay: 60,
	});
	angular.extend($modalProvider.defaults, {
		html: true
	});
});

app.run(function($http) {
	$http.defaults.headers.post['X-CSRFToken'] = $('meta[name=csrf-token]').attr('content');
	$http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
});

app.controller("StackPtrMap", ['$scope', '$cookies', '$http', '$interval', 'leafletData', 'leafletDrawEvents', 'leafletMapEvents', '$wamp', function($scope, $cookies, $http, $interval, leafletData, leafletDrawEvents, leafletMapEvents, $wamp) {

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
		stackptr_cyber: {
			name: 'StackPtr Cyber Style',
			url: 'https://tile{s}.stackcdn.com/' + (L.Browser.retina ? 'osm_tiles_cg_2x' : 'osm_tiles_cg') + '/{z}/{x}/{y}.png',
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
		stackptr_cyber_no_retina: {
			name: 'StackPtr Cyber No Retina',
			url: 'https://tile{s}.stackcdn.com/osm_tiles_cg/{z}/{x}/{y}.png',
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

	$scope.setTileServer = function(ev) {
		var new_ts_name = ev[0][0];
		$cookies.put('tileserver', new_ts_name);
		angular.extend($scope, {
			tiles: $scope.getTileServer()
		})
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

	$scope.myid = null;
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
					if (vm.id == $scope.myid) {
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
			console.log(item);
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
		$scope.center.lat = user.loc[0];
		$scope.center.lng = user.loc[1];
		$scope.center.zoom = 16;
		$scope.markers[user.id].focus = true;
		if (isMobileUi) {
			$scope.toggleUserMenu();
		}
	}

	$scope.updateMarker = function(userObj) {
		if ($scope.markers[userObj.id] == null) {
			$scope.markers[userObj.id] = {
				icon: {
					iconUrl: userObj.icon,
					iconSize: [32, 32],
					iconAnchor: [16, 16],
				},
				message: '<div ng-include="\'/static/template/user.html\'"></div>',
				myId: userObj.id,
				isMe: userObj.id == $scope.userMe.id,
				getMessageScope: function() {
					var sc = $scope.$new(false);
					sc.myId = this.myId;
					sc.isMe = this.isMe;
					return sc;
				},
				focus: false,
			};
			$scope.paths[userObj.id] = {
				color: 'black',
				opacity: 0.8,
				weight: 3,
				latlngs: []
			};

			var img = new Image();
			img.onload = function() {
				var colourThief = new ColorThief();
				var colour = colourThief.getColor(img);
				$scope.paths[userObj.id].color = rgb2hash(colour[0], colour[1], colour[2]);
			};
			img.crossOrigin = 'Anonymous';
			img.src = userObj.icon;
			$wamp.call('com.stackptr.api.lochist', [], {
				target: userObj.id
			}).then($scope.processData);
		}
		$scope.markers[userObj.id].lat = userObj.loc[0];
		$scope.markers[userObj.id].lng = userObj.loc[1];
		$scope.paths[userObj.id].latlngs.push({
			lat: userObj.loc[0],
			lng: userObj.loc[1]
		})

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
	}

	$scope.groupDiscovered = function(data) {
		$scope.discoverGroupList = data[0].data;
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
		$scope.resetGroup();
	}

	$scope.updateGroup = function(group, hide, $event) {
		var etf = $event.target.form;
		$wamp.call('com.stackptr.api.updateGroup', [], {
			gid: $scope.group,
			name: etf.groupname.value,
			description: etf.groupdesc.value,
			status: etf.mode.checked ? "1" : "0"
		}).then($scope.processData);
		hide();
	}

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

		geom0.on("click", function() {
			$("#groupfeaturelist").find(".panel-collapse").collapse("hide");
			var featureId = item.id;
			$("#feature-" + featureId).children(".panel-collapse").collapse("show");
		});

		di.addLayer(geom0);
	}

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
		di.clearLayers();

		$wamp.call('com.stackptr.api.groupData', [], {
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

	$scope.renameGroupItem = function($event) {
		var etf = $event.target.form || $event.target;
		$wamp.call('com.stackptr.api.renameFeature', [], {
			fid: etf.id.value,
			name: etf.name.value
		}).then($scope.processData);
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
			}
		});
		if (isMobileUi) {
			$scope.toggleGroupMenu();
		}
	}

	///////////


	$scope.addUser = function($event) {
		var etf = $event.target.form || $event.target;
		$wamp.call('com.stackptr.api.addUser', [], {
			user: etf.user.value
		}).then($scope.processData);
	};

	$scope.delUser = function(uid) {
		$wamp.call('com.stackptr.api.delUser', [], {
			user: uid
		}).then($scope.processData);
	}

	$scope.acceptUser = function(uid) {
		$wamp.call('com.stackptr.api.acceptUser', [], {
			user: uid
		}).then($scope.processData);
	}


	///////////



	var resp = $http.post('/ws_uid', "");
	resp.success(function(rdata, status, headers, config) {
		console.log(rdata);
		$scope.myid = rdata;
		$wamp.connection._options.authid = rdata;
		$wamp.open();
	});

	$scope.$on("$wamp.onchallenge", function(event, data) {
		console.log(data);
		if (data.method === "ticket") {
			var csrf = $http.get('/csrf', "");
			csrf.success(function(cdata, status, headers, config) {
				$http.defaults.headers.post['X-CSRFToken'] = cdata;
				var resp = $http.post('/ws_token', "");
				resp.success(function(rdata, status, headers, config) {
					console.log(rdata);
					data.promise.resolve(rdata);
				});
			});
		}
	});

	$scope.$on("$wamp.open", function(event, session) {
		$scope.status = "Connected";

		$wamp.subscribe('com.stackptr.user', $scope.processWS);
		$wamp.subscribe('com.stackptr.group', $scope.processWS);

		$wamp.call('com.stackptr.api.userList').then($scope.postUserList);
		$wamp.call('com.stackptr.api.groupList').then($scope.postGroupList);
		$wamp.call('com.stackptr.api.groupData', [], {
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
		} else {
			$("#groupmenu").toggle();
		}
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

function delUserClick(item, uid) {
	var $scope = angular.element($('body')).scope();
	$scope.delUser(uid);
}

function acceptUserClick(item, uid) {
	var $scope = angular.element($('body')).scope();
	$scope.acceptUser(uid);
}