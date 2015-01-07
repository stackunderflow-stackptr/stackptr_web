// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps

//window.stackptr.resize(fixheight);

var app = angular.module("StackPtr", ['leaflet-directive', 'angularMoment', 'ngAnimate', 'ngSanitize', 'mgcrea.ngStrap', 'vxWamp']).config(function($interpolateProvider){
	$interpolateProvider.startSymbol('[[').endSymbol(']]');
});

app.config(function ($wampProvider) {
     $wampProvider.init({
        url: 'wss://stackptr.com/ws',
        realm: 'stackptr',
        authmethods: ["ticket"],
        //Any other AutobahnJS options
     });
 });

app.run(function($http) {
	$http.defaults.headers.post['X-CSRFToken'] = $('meta[name=csrf-token]').attr('content');
	$http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';

});

app.controller("StackPtrMap", [ '$scope', '$http', '$interval', 'leafletData', '$wamp', function($scope, $http, $interval, leafletData, $wamp ) {
	angular.extend($scope, {
		defaults: {
			maxZoom: 18,
			minZoom: 1,
			doubleClickZoom: true,
			scrollWheelZoom: true,
			attributionControl: true,
			tileLayer: 'https://tile{s}.stackcdn.com/' + (L.Browser.retina ? 'osm_tiles_2x' : 'osm_tiles') +'/{z}/{x}/{y}.png',
			//tileLayer: 'https://otile{s}-s.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png',
			tileLayerOptions: {
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 18,
				subdomains: '123456',
			},
		},
		center: {
			lat: -24,
			lng: 138,
			zoom: 5,
		},
		controls: {
			draw: {},
			edit: {featureGroup: L.featureGroup()},
		},
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
	
	$scope.processItem = function(item) {
		console.log(item);
			if (item.type == 'user') {
				for (user in item.data) {
					if (item.data[user] == null) {
						delete $scope.userList[user];
						delete $scope.markers[user];
					} else {
						$scope.userList[user] = item.data[user];
						$scope.updateMarker(item.data[user]);
					}
				}
				$scope.userListEmpty = (Object.keys($scope.userList).length) == 0;
			} else if (item.type == 'user-me') {
				$scope.userMe = item.data;
				$scope.updateMarker(item.data);
			} else if (item.type == 'user-pending') {
				for (user in item.data) {
					if (item.data[user] == null) {
						delete $scope.userPending[user];
					} else {
						$scope.userPending[user] = item.data[user];
					}
				}
				$scope.pendingListEmpty = (Object.keys($scope.userPending).length) == 0;
			} else if (item.type == 'user-request') {
				for (user in item.data) {
					if (item.data[user] == null) {
						delete $scope.userReqs[user];
					} else {
						$scope.userReqs[user] = item.data[user];
					}
				}
				$scope.reqsListEmpty = (Object.keys($scope.userReqs).length) == 0;
			} else if (item.type == 'grouplist') {
				for (group in item.data) {
					$scope.grouplist[group] = item.data[group];
				}
			} else if (item.type == 'groupdata') {
				for (groupitem in item.data) {
					$scope.groupdata[groupitem] = item.data[groupitem];
				}
			} else {
				console.log(item);
			}
	}
	
	$scope.processData = function(data, status, headers, config) {
		console.log(data);
		for (msg in data) {
			var item = data[msg];
			$scope.processItem(item);
		}
	};

	
	$scope.counter = 0;
	$scope.status = "Connecting to server...";
	
	//$scope.update = function() {
	//	if (--$scope.counter < 0) {
	//		$scope.counter = 5;
	//		
	//		var resp = $http.get("/users");
	//		resp.success($scope.processData);
	//		
	//		var resp = $http.get("/grouplist");
	//		resp.success($scope.processData);
	//		
	//		var resp = $http.post('/groupdata', $.param({group: 1}));
	//		resp.success($scope.processData);
	//		
	//	};
	//};
	
	//$scope.update();
	//$interval($scope.update, 1000);
	
	$scope.clickMarker = function(user) {
		$scope.center.lat = user.loc[0];
		$scope.center.lng = user.loc[1];
		$scope.center.zoom = 16;
		$scope.markers[user.id].focus = true;
	}
	
	$scope.updateMarker = function(userObj) {
		//var userObj = $scope.userList[user];
		
		if ($scope.markers[userObj.id] == null) {
			$scope.markers[userObj.id] = {
				icon: {
					iconUrl: userObj.icon,
					iconSize: [32,32],
					iconAnchor: [16,16],
				},
				message: "<a onClick='delUserClick(this," + userObj.id + ")'>Delete user</a>",
				focus: false,
			};
		}
		$scope.markers[userObj.id].lat = userObj.loc[0];
		$scope.markers[userObj.id].lng = userObj.loc[1];
	}
	
	//$scope.$watchCollection('userList', function(added,removed) {
	//	var markerList = {};
	//	for (user in added) {
	//		console.log("added: " + user)
	//		var userObj = $scope.userList[user];
	//		var marker = {
	//			lat: userObj.loc[0],
	//			lng: userObj.loc[1],
	//			icon: {
	//				iconUrl: userObj.icon,
	//				iconSize: [32,32],
	//				iconAnchor: [16,16],
	//			},
	//		};
	//		markerList[$scope.userList[user].username] = marker;
	//	}
	//	angular.extend($scope, {markers: markerList});
	//});
	
	$scope.layers = {}
	$scope.$watchCollection('groupdata', function(added, removed) {
		$scope.features = [];
		for (itemid in added) {
			var item = $scope.groupdata[itemid];
			$scope.features.push(item.json);
		}
		//console.log($scope.features);
		
		angular.extend($scope, {
			geojson: {data: {"type":"FeatureCollection","features":$scope.features}},
		});
	});
	
	$scope.$on("leafletDirectiveMap.geojsonClick", function(ev, featureSelected, leafletEvent) {
		alert(featureSelected.id);
	});
	
	
	
	leafletData.getMap().then(function(map) {
              var drawnItems = $scope.controls.edit.featureGroup;
              map.addLayer(drawnItems);
              map.on('draw:created', function (e) {
                var layer = e.layer;
                //drawnItems.addLayer(layer);
                //console.log(JSON.stringify(layer.toGeoJSON()));
				var resp = $http.post('/addfeature', $.param({
					group: '1',
					geojson: JSON.stringify(layer.toGeoJSON()),
				}));
				resp.success($scope.processData);
				//resp.success(function(d,s,h,c) {console.log(d)});
              });
           });
           
	
	$scope.activePanel = -1;

	$scope.addUser = function($event) {
		var formdata = $($event.target.form).serialize();
		var resp = $http.post('/adduser', formdata);
		//alert(resp);
		resp.success($scope.processData);
	};
	
	$scope.delUser = function(uid) {
			//var resp = $http.get("/deluser");
			//resp.success($scope.processData);
			
			var resp = $http.post('/deluser', $.param({uid: uid}));
			resp.success($scope.processData);
			
			return 1;
	}

	$scope.acceptUser = function(uid) {
			//var resp = $http.get("/deluser");
			//resp.success($scope.processData);
			
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
		for (i in items) {
			if (items[i].id == item) {
				var bounds = L.bounds(items[i].geometry.coordinates);
			}
		}
		
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
        var resp = $http.post('/ws_token', "");
		resp.success(function(rdata, status, headers, config) {
			console.log(rdata);
			return data.promise.resolve(rdata);
		});
        
     } 
     
		
	});
	
	$scope.$on("$wamp.open", function (event, session) {
        $scope.status = "Connected";
        
        //$wamp.call('com.stackptr.api.idlist').then(function(res) {
    	//	console.log(res);
    	//	for (i in res) {
		//		$wamp.subscribe('com.stackptr.user.' + res[i], $scope.processWS);
		//	}
    	//});
    	
    	$wamp.subscribe('com.stackptr.user', $scope.processWS);

        $wamp.call('com.stackptr.api.userList').then($scope.processData);
        $wamp.call('com.stackptr.api.groupList').then($scope.processData);
    	
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
    for (id in items) {
    	var item = items[id]
		var updateTime = curTime - item.lastupd;
		// fixme: client/server time mismatch
		if (updateTime < 0) {
			updateTime = 0;
		}
      if ((updateTime >= agemin) && ((updateTime < agemax) || (agemax == -1))) {
        filtered.push(item);
      }
    }
    return filtered;
  };
});

$(document).ready(function() {
	//map = L.map('map-canvas').setView([-34.929, 138.601], 13);
	//window.stackptr = new StackPtr("/", undefined, undefined);
	//stackptr.updateFollowing();
	
	//window.stackptr.bootstrap = true;
	$("#gpsmenu").draggable();
	$("#usermenu").draggable();
	$("#groupmenu").draggable();
	
	//$("#upload_loc").click(uploadLocation);
	//$("#goto_loc").click(gotoMyLocation);
	//$("#autorefresh_loc").click(toggleAutoRefresh);
	
	// //$("#selectgroup").change(stackptr.changegroup);
	
	
	//stackptr.setupDraw();
	
	
	//$("#refresh_loc").click(stackptr.updateFollowing);
	
	
	//$("#adduser").click(function(e) {
	//	e.preventDefault();
	//	$.post('/adduser', $('#adduserform').serialize(),
	//		function(data) {
	//			$("#addstatus").html("Server returned: " + data);
	//			stackptr.refreshLocation();
	//	});
	//});
	
	//stackptr.setupAutoRefresh();
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