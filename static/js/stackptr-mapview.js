// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps

//window.stackptr.resize(fixheight);

var app = angular.module("StackPtr", ['leaflet-directive', 'angularMoment', 'ngAnimate', 'ngSanitize', 'mgcrea.ngStrap', 'vxWamp']).config(function($interpolateProvider){
	$interpolateProvider.startSymbol('[[').endSymbol(']]');
});

app.config(function ($wampProvider) {
     $wampProvider.init({
        url: 'ws://127.0.0.1:8080/ws',
        realm: 'realm1'
        //Any other AutobahnJS options
     });
 });

app.run(function($http,$wamp) {
	$http.defaults.headers.post['X-CSRFToken'] = $('meta[name=csrf-token]').attr('content');
	$http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
	$wamp.open();
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
	$scope.grouplist = {};
	$scope.groupdata = {};
	$scope.userListEmpty = false;
	
	$scope.processItem = function(item) {
		console.log(item);
		if (item.type == 'user') {
				$scope.userListEmpty = true;
				for (user in item.data) {
					$scope.userList[user] = item.data[user];
					$scope.userListEmpty = false;
				}
			} else if (item.type == 'user-me') {
				$scope.userMe = item.data;
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
		for (msg in data) {
			var item = data[msg];
			$scope.processItem(item);
		}
	};

	
	$scope.counter = 0;
	
	$scope.update = function() {
		if (--$scope.counter < 0) {
			$scope.counter = 5;
			
			var resp = $http.get("/users");
			resp.success($scope.processData);
			
			var resp = $http.get("/grouplist");
			resp.success($scope.processData);
			
			var resp = $http.post('/groupdata', $.param({group: 1}));
			resp.success($scope.processData);
			
		};
	};
	
	$scope.update();
	//$interval($scope.update, 1000);
	
	$scope.$watchCollection('userList', function(added,removed) {
		var markerList = {};
		for (user in added) {
			var userObj = $scope.userList[user];
			var marker = {
				lat: userObj.loc[0],
				lng: userObj.loc[1],
				icon: {
					iconUrl: userObj.icon,
					iconSize: [32,32],
					iconAnchor: [16,16],
				},
			};
			markerList[$scope.userList[user].username] = marker;
		}
		angular.extend($scope, {markers: markerList});
	});
	
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
           

	$scope.tooltip = {title: 'Hello Tooltip This is a multiline message!', checked: false};
	
	$scope.activePanel = -1;
	
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
	
	$scope.$on("$wamp.open", function (event, session) {
        console.log('We are connected to the WAMP Router!'); 
    });

    $scope.$on("$wamp.close", function (event, data) {
        $scope.reason = data.reason;
        $scope.details = data.details;
    });
    
    
   $wamp.subscribe('com.example.on_visit', function(type, data) {
   		console.log(type);
   		console.log(data);
		$scope.processItem({type: type[0], data: data.msg});
		$scope.processItem({type: type[0], data: data.msg});
   });


}]);

app.filter('updateRange', function () {
  return function (items, agemin, agemax) {
  	var curTime = Math.round(new Date().getTime()/1000);
    var filtered = [];
    for (id in items) {
    	var item = items[id]
		var updateTime = curTime - item.lastupd;
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
