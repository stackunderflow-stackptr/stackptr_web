// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps

//window.stackptr.resize(fixheight);

var app = angular.module("StackPtr", ['leaflet-directive', 'angularMoment']).config(function($interpolateProvider){
	$interpolateProvider.startSymbol('[[').endSymbol(']]');
});

app.run(function($http) {
	$http.defaults.headers.post['X-CSRFToken'] = $('meta[name=csrf-token]').attr('content');
});


app.controller("StackPtrMap", [ '$scope', '$http', '$interval', 'leafletData', function($scope, $http, $interval, leafletData) {
	angular.extend($scope, {
		defaults: {
			maxZoom: 14,
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
			center: {
				lat: -24,
				lng: 138,
				zoom: 5,
				//lat: 37.26,
				//lng: 138.86,
				//zoom: 4
			},
		},
		controls: {
			draw: {},
			edit: {featureGroup: L.featureGroup()},
		},
	});
	
	
	$scope.processData = function(data, status, headers, config) {
		for (msg in data) {
			var item = data[msg];
			if (item.type == 'user') {
				for (user in item.data) {
					$scope.userList[user] = item.data[user];
				}
			} else if (item.type == 'user-me') {
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
	};
	
	
	$scope.markers = {};
	$scope.userList = {};
	
	$scope.counter = 0;
	
	$interval(function() {
		if (--$scope.counter < 0) {
			$scope.counter = 5;
			var resp = $http.get("/users");
			resp.success($scope.processData);
		};
	}, 1000);
	
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
	
	
	$scope.grouplist = {};
	var resp = $http.get("/grouplist");
	resp.success($scope.processData);
	
	$scope.groupdata = {};
	var resp = $http.post('/groupdata', $.param({group: 1}));
	resp.success($scope.processData);
	
	$scope.layers = {}
	$scope.$watchCollection('groupdata', function(added, removed) {
		$scope.features = [];
		for (itemid in added) {
			var item = $scope.groupdata[itemid];
			$scope.features.push(item.json);
		}
		console.log($scope.features);
		
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
                drawnItems.addLayer(layer);
                console.log(JSON.stringify(layer.toGeoJSON()));
                
              });
           });
           

}]);


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
