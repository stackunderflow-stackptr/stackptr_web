// stackptr-login-view.js
// a mostly dummy controller just for the login page

var app = angular.module("StackPtr", ['ui-leaflet']).config(function($interpolateProvider){
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
	var wh = $(window).width();
	if (wh < 640) {
		$("#loginmenu").css("width",wh);
		$("#loginmenu-place").css("width",wh);
		$("#loginmenu").find("label").remove();
		$("#loginmenu").find("div .col-sm-10").addClass("col-sm-12").removeClass("col-sm-10");
		$("#loginmenu").find(".col-sm-offset-2").removeClass("col-sm-offset-2");
	}
});


