// stackptr-login-view.js
// a mostly dummy controller just for the login page

var app = angular.module("StackPtr", ['leaflet-directive']).config(function($interpolateProvider){
	$interpolateProvider.startSymbol('[[').endSymbol(']]');
});


app.controller("StackPtrLogin", [ '$scope', function($scope) {
	angular.extend($scope, {
		defaults: {
			maxZoom: 18,
			minZoom: 1,
			zoomControl: false,
			doubleClickZoom: true,
			scrollWheelZoom: true,
			attributionControl: true,
		},
		tiles: {
			name: 'StackPtr Default Style',
			url: 'https://tile{s}.stackcdn.com/' + (L.Browser.retina ? 'osm_tiles_2x' : 'osm_tiles') +'/{z}/{x}/{y}.png',
			options: {
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				maxZoom: 18,
				subdomains: '123456',
			}
		},
		center: {
			lat: -37.827480,
			lng: 144.969749,
			zoom: 13
    	},
	});	
}]);

$(document).ready(function() {	
	$("#loginmenu").draggable();
});


