// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps

//window.stackptr.resize(fixheight);

var app = angular.module("StackPtr", ['leaflet-directive', 'angularMoment']).config(function($interpolateProvider){
    $interpolateProvider.startSymbol('[[').endSymbol(']]');
});

app.run(function($http) {
	$http.defaults.headers.post['X-CSRFToken'] = $('meta[name=csrf-token]').attr('content');
});

	//var tp = "osm_tiles";
	//if(L.Browser.retina) {
	//	 tp = "osm_tiles_2x";
	//};

app.controller("StackPtrMap", [ '$scope', '$http', '$interval', function($scope, $http, $interval) {
    angular.extend($scope, {
        defaults: {
    maxZoom: 14,
    minZoom: 1,
    doubleClickZoom: true,
    scrollWheelZoom: true,
    attributionControl: true,
   // tileLayer: 'https://tile{s}.stackcdn.com/'+'osm_tiles'+'/{z}/{x}/{y}.png',
   tileLayer: 'https://otile{s}-s.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png',
    tileLayerOptions: {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
        subdomains: '1234',
    },
    center: {
        //lat: -34.929,
        //lng: 138.601,
        //zoom: 12,
        lat: 37.26,
        lng: 138.86,
        zoom: 4

    },
}
    });
    
    $scope.markers = {};
	$scope.userList = {};
	
	$scope.counter = 0;

	$interval(function() {
		if (--$scope.counter < 0) {
			$scope.counter = 5;
			var resp = $http.get("/users");
			resp.success(function(data, status, headers, config) {
				$scope.userList = data['following'];
			});
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
	resp.success(function(data, status, headers, config) {
		$scope.grouplist = data;
	});
	
	$scope.groupdata = {};
	var resp = $http.post('/groupdata', $.param({group: 1}));
	resp.success(function(data, status, headers, config) {
		$scope.groupdata = data;
	});
	
	$scope.layers = {}
	$scope.$watchCollection('groupdata', function(added, removed) {
		//var layerlist = {};
		//for (itemid in added) {
		//	var item = $scope.groupdata[itemid];
		//	var layer = {
		//		data: item.json,
		//	};
		//	layerlist[itemid] = layer;
		//}
		//console.log(layerlist);
		//angular.extend($scope, {geojson: layerlist});
		angular.extend($scope, {
			geojson: {data: {"type":"FeatureCollection","features":[
{"type":"Feature","id":"JPN","properties":{"name":"Japan"},"geometry":{"type":"MultiPolygon","coordinates":[[[[134.638428,34.149234],[134.766379,33.806335],[134.203416,33.201178],[133.79295,33.521985],[133.280268,33.28957],[133.014858,32.704567],[132.363115,32.989382],[132.371176,33.463642],[132.924373,34.060299],[133.492968,33.944621],[133.904106,34.364931],[134.638428,34.149234]]],[[[140.976388,37.142074],[140.59977,36.343983],[140.774074,35.842877],[140.253279,35.138114],[138.975528,34.6676],[137.217599,34.606286],[135.792983,33.464805],[135.120983,33.849071],[135.079435,34.596545],[133.340316,34.375938],[132.156771,33.904933],[130.986145,33.885761],[132.000036,33.149992],[131.33279,31.450355],[130.686318,31.029579],[130.20242,31.418238],[130.447676,32.319475],[129.814692,32.61031],[129.408463,33.296056],[130.353935,33.604151],[130.878451,34.232743],[131.884229,34.749714],[132.617673,35.433393],[134.608301,35.731618],[135.677538,35.527134],[136.723831,37.304984],[137.390612,36.827391],[138.857602,37.827485],[139.426405,38.215962],[140.05479,39.438807],[139.883379,40.563312],[140.305783,41.195005],[141.368973,41.37856],[141.914263,39.991616],[141.884601,39.180865],[140.959489,38.174001],[140.976388,37.142074]]],[[[143.910162,44.1741],[144.613427,43.960883],[145.320825,44.384733],[145.543137,43.262088],[144.059662,42.988358],[143.18385,41.995215],[141.611491,42.678791],[141.067286,41.584594],[139.955106,41.569556],[139.817544,42.563759],[140.312087,43.333273],[141.380549,43.388825],[141.671952,44.772125],[141.967645,45.551483],[143.14287,44.510358],[143.910162,44.1741]]]]}}
]},
		style: {
        		fillColor: "green",
                 weight: 2,
                 opacity: 1,
                 color: 'white',
                 dashArray: '3',
                 fillOpacity: 0.7,
		},
			}});
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
