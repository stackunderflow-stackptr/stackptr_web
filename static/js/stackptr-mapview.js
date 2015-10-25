// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps

var app = angular.module("StackPtr", ['leaflet-directive', 'angularMoment', 'ngAnimate', 'ngSanitize', 'mgcrea.ngStrap', 'vxWamp', 'ngCookies']).config(function($interpolateProvider){
	$interpolateProvider.startSymbol('[[').endSymbol(']]');
});

app.config(function ($wampProvider) {
     $wampProvider.init({
        url: (window.location.protocol == 'https:' ? 'wss://' : 'ws://' ) + window.location.host + '/ws',
        realm: 'stackptr',
        authmethods: ["ticket"],
     });
 });

app.run(function($http) {
	$http.defaults.headers.post['X-CSRFToken'] = $('meta[name=csrf-token]').attr('content');
	$http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
});

app.controller("StackPtrMap", [ '$scope', '$cookies', '$http', '$interval', 'leafletData', '$wamp', function($scope, $cookies, $http, $interval, leafletData, $wamp) {
	
	$scope.tiles = {
		name: ""
	}
	
	$scope.tileservers = {
		stackptr: {
			name: 'StackPtr Default Style',
			url: 'https://tile{s}.stackcdn.com/' + (L.Browser.retina ? 'osm_tiles_2x' : 'osm_tiles') +'/{z}/{x}/{y}.png',
			options: {
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 18,
				subdomains: '123456',
			}
		},
		stackptr_cyber: {
			name: 'StackPtr Cyber Style',
			url: 'https://tile{s}.stackcdn.com/' + (L.Browser.retina ? 'osm_tiles_cg_2x' : 'osm_tiles_cg') +'/{z}/{x}/{y}.png',
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
	
	$scope.$on('leafletDirectiveMap.moveend', function(event){
		var i = $scope.center;
		$cookies.put('last_lat', i.lat);
		$cookies.put('last_lng', i.lng);
		$cookies.put('last_zoom', i.zoom);
    });
	
	$cookies.has = function(key) {
		return $cookies.get(key) != undefined;
	}
	
	$scope.getLastPos = function() {
		if ($cookies.has('last_lat') && $cookies.has('last_lng') && $cookies.has('last_zoom')) {
			return {lat: parseFloat($cookies.get('last_lat')), lng: parseFloat($cookies.get('last_lng')), zoom: parseInt($cookies.get('last_zoom'))}
		} else {
			return {lat: -24, lng: 138, zoom: 5}
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
		controls: {
			draw: {
				edit: {featureGroup: L.featureGroup()}
			}
		},
		layers: {
			baselayers: {}
		},
		events: {
			map: {
				enable: ['moveend'],
				logic: 'emit'
			}
		}
	});
	
	
	$scope.markers = {};
	$scope.userList = {};
	$scope.userPending = {};
	$scope.userReqs = {};
	$scope.grouplist = {};
	$scope.groupdata = {};
	$scope.userListEmpty = false;
	$scope.pendingListEmpty = false;
	$scope.reqsListEmpty = false;
	$scope.paths = {};
	
	$scope.processItem = function(item) {
			if (item.type == 'user') {
				item.data.forEach(function(v) {
					$scope.userList[v.id] = v;
					$scope.updateMarker(v);
				});
				$scope.userListEmpty = ($scope.userList.length) == 0;
			} else if (item.type == 'user-me') {
				$scope.userMe = item.data;
				$scope.updateMarker(item.data);
			} else if (item.type == 'user-pending') {
				item.data.forEach(function(v) {
					$scope.userPending[v.id] = v;
				});
				$scope.pendingListEmpty = ($scope.userPending.length) == 0;
			} else if (item.type == 'user-request') {
				item.data.forEach(function(v) {
					$scope.userReqs[v.id] = v;
				});
				$scope.reqsListEmpty = ($scope.userReqs.length) == 0;
			} else if (item.type == 'grouplist') {
				item.data.forEach(function(v) {
					$scope.grouplist[v.id] = v;
				});
			} else if (item.type == 'groupdata') {
				console.log(item);
				item.data.forEach(function(v) {
					$scope.groupdata[v.id] = v;
				});
			} else if (item.type == 'lochist') {
				item.data.forEach(function(v) {
					$scope.paths[v.id].latlngs = v.lochist;
				});
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
	}
	
	$scope.updateMarker = function(userObj) {		
		if ($scope.markers[userObj.id] == null) {
			$scope.markers[userObj.id] = {
				icon: {
					iconUrl: userObj.icon,
					iconSize: [32,32],
					iconAnchor: [16,16],
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
			img.onload = function () {
				var colourThief = new ColorThief();
				var colour = colourThief.getColor(img);
				$scope.paths[userObj.id].color = rgb2hash(colour[0], colour[1], colour[2]);
			};
			img.crossOrigin = 'Anonymous';
			img.src = userObj.icon;
			$wamp.call('com.stackptr.api.lochist', [userObj.id]).then($scope.processData);
		}
		$scope.markers[userObj.id].lat = userObj.loc[0];
		$scope.markers[userObj.id].lng = userObj.loc[1];
		$scope.paths[userObj.id].latlngs.push({ lat: userObj.loc[0], lng: userObj.loc[1] })

		//$scope.markers[userObj.id].myUserObj = userObj;
		//$scope.markers[userObj.id].message = '[[userObj.loc]]' + Math.random();
	}
	
	$scope.layers = {}
	$scope.$watchCollection('groupdata', function(added, removed) {
		$scope.features = [];

		for (itemid in added) {
			var item = $scope.groupdata[itemid];
			item.json.id = item.id;
			$scope.features.push(item.json);
		}
		
		angular.extend($scope, {
			geojson: {data: {"type":"FeatureCollection","features":$scope.features}},
		});
	});
	
	$scope.$on("leafletDirectiveGeoJson.click", function(ev, leafletPayload) {
		alert(leafletPayload.leafletObject.feature.id);
	});

	leafletData.getMap().then(function(map) {
		leafletData.getLayers().then(function(baselayers) {
			//var drawnItems = $scope.controls.draw.edit.featureGroup;
			map.on('draw:created', function (e) {
				var layer = e.layer;
				//drawnItems.addLayer(layer);
				console.log(JSON.stringify(layer.toGeoJSON()));
				$wamp.call('com.stackptr.api.addFeature',['Untitled',1,JSON.stringify(layer.toGeoJSON())]).then($scope.processData);
			});
		});
	});

	$scope.addUser = function($event) {
		var formdata = $($event.target.form).serialize();
		var resp = $http.post('/adduser', formdata);
		resp.success($scope.processData);
	};
	
	$scope.delUser = function(uid) {
			var resp = $http.post('/deluser', $.param({uid: uid}));
			resp.success($scope.processData);
			
			return 1;
	}

	$scope.acceptUser = function(uid) {
			var resp = $http.post('/acceptuser', $.param({uid: uid}));
			resp.success($scope.processData);
			
			return 1;
	}
	

	$scope.renameGroupItem = function($event) {
		var formdata = $($event.target.form).serialize();
		var resp = $http.post('/renamefeature', formdata);
		resp.success($scope.processData);
	};
	
	$scope.gotoItem = function(item) {
		var items = $scope.geojson.data.features;
		items.forEach(function(v) {
			if (v.id == item) {
				var bounds = L.bounds(v.geometry.coordinates);
			}
		});
		
	}
	
	var resp = $http.post('/ws_uid', "");
	resp.success(function(rdata, status, headers, config) {
		console.log(rdata);
		$wamp.connection._options.authid = rdata;
		$wamp.open();
	});

	$scope.$on("$wamp.onchallenge", function (event, data) {
		console.log(data);
		if (data.method === "ticket"){
			var csrf = $http.get('/csrf',"");
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
	
	$scope.$on("$wamp.open", function (event, session) {
        $scope.status = "Connected";
    	
    	$wamp.subscribe('com.stackptr.user', $scope.processWS);

        $wamp.call('com.stackptr.api.userList').then($scope.processData);
        $wamp.call('com.stackptr.api.groupList').then($scope.processData);
        $wamp.call('com.stackptr.api.groupData',[1]).then($scope.processData);
    	
    });

    $scope.$on("$wamp.close", function (event, data) {
    	$scope.status = "Disconnected: " + data.reason;
        $scope.reason = data.reason;
        $scope.details = data.details;
    });
    
    $scope.processWS = function(type, data) {
		$scope.processItem({type: type[0], data: data.msg});
   	};

}]);

app.filter('updateRange', function () {
	return function (items, agemin, agemax) {
		var curTime = Math.round(new Date().getTime()/1000);
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

$(document).ready(function() {
	$("#gpsmenu").draggable();
	$("#usermenu").draggable();
	$("#groupmenu").draggable();
});


togglePane  = function (pane) {
	$(pane).toggle();
}

function delUserClick(item,uid) {
	var $scope = angular.element($('body')).scope();
	$scope.delUser(uid);
}

function acceptUserClick(item,uid) {
	var $scope = angular.element($('body')).scope();
	$scope.acceptUser(uid);
}

