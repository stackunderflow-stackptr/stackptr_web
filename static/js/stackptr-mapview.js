// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps

//window.stackptr.resize(fixheight);

var app = angular.module("StackPtr", ['leaflet-directive', 'angularMoment']).config(function($interpolateProvider){
    $interpolateProvider.startSymbol('[[').endSymbol(']]');
});

	//var tp = "osm_tiles";
	//if(L.Browser.retina) {
	//	 tp = "osm_tiles_2x";
	//};

app.controller("StackPtrMap", [ '$scope', '$http', function($scope, $http) {
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
        lat: 0,
        lng: 0,
        zoom: 0
    }
}
    });

	$scope.userList = {};
	var resp = $http.get("/users");
	resp.success(function(data, status, headers, config) {
		$scope.userList = data['following'];
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
