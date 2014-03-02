function distanceFormat(distance) {
	if (distance > 1000) {
		return (distance/1000).toFixed(2) + ' km';
	} else {
		return distance.toFixed(0) + ' m'
	}
}
function compassBox(heading) {
	if (heading < 22.5) {
		return "N";
	} else if (heading < 67.5) {
		return "NE";
	} else if (heading < 112.5) {
		return "E";
	} else if (heading < 157.5) {
		return "SE";
	} else if (heading < 202.5) {
		return "S";
	} else if (heading < 247.5) {
		return "SW";
	} else if (heading < 292.5) {
		return "W";
	} else if (heading < 337.5) {
		return "NW";
	} else {
		return "N";
	}
}
function headingFormat(heading) {
	if (heading < 0) {
		heading = 360 + heading;
	}
	return heading.toFixed(0) + ' ' + compassBox(heading);
}

///////////////////////////////////////////////////////////////////////////

var map; 				// leaflet map
var placemarks = {};	// map of placemarks
var gpsLocation;		// my current location as a L.LatLng()
var watchID;			// id of geolocation watcher

var myData;				// data for logged in user
var followingData;		// data for following users

var autoRefresh = false; // do we auto-update?

var uploadInterval;
var downloadInterval;
///////////////////////////////////////////////////////////////////////////

// GPS functions
function updateGPS(position) {
	$("#loc").html("Lat: " + position.coords.latitude +
				"<br>Lon: " + position.coords.longitude);
	
	gpsLocation = new L.LatLng(position.coords.latitude, position.coords.longitude);
	placemarks[myData['user']].setLatLng(gpsLocation);
	updateSideList();		
};

function errorGPS(err) {
	$('#loc').html("GPS Error: " + err.message + " (" + err.code + ")");
};

function startGPS() {
	watchID = navigator.geolocation.watchPosition(updateGPS, errorGPS, { enableHighAccuracy: true });
};

function uploadLocation() {
	$.post('/update', {lat: gpsLocation.lat, lon: gpsLocation.lng},
				function(data) {
					$("#loc").html("Server returned: " + data);
				});
	return true;
};

function gotoMyLocation() {
	event.preventDefault();
	map.panTo(gpsLocation);
	map.setZoom(16);
};

// update following users
function updateFollowing() {
	$("#loc").html("Fetching locations...");
	$.getJSON('user.json', function(data) {
		$("#loc").html("Locations fetched, parsing...");
		myData = data['me'];
		followingData = data['following'];
		
		// create placemark for me, no position set
		if (myData['user'] in placemarks) {
		} else {
			$("#loc").html("Creating placemark for self");
			placemarks[myData['user']] = new L.marker(new L.LatLng(-34.9,138.5),
			{
				icon: new L.icon({
					iconUrl: myData['icon'],
				}),
			});
			placemarks[myData['user']].addTo(map);
		};
		
		// create placemarks for followed people
		
		$("#loc").html("Creating placemarks for followed");
		followingData.forEach(function(user) {
			if (user['user'] in placemarks) {
				// if it does exist, move the placemark to it's current location
				var loc = new L.LatLng(user['loc'][1], user['loc'][0]);
				placemarks[user['user']].setLatLng(loc);
			} else {
				// create a placemark otherwise
				placemarks[user['user']] = new L.marker(new L.LatLng(user['loc'][1], user['loc'][0]), {
					icon: new L.icon({
						iconUrl: user['icon'],
					}),
				});
				placemarks[user['user']].addTo(map);
			};
		});
		$("#loc").html("Locations updated");
		updateSideList();
		startGPS();
	});
	return true;
};

function userClick(user) {
	map.panTo(placemarks[user].getLatLng());
	map.setZoom(16);
};

function updateSideList() {
	$('#userlist').html('');
	followingData.forEach(function(user) {
		var user_loc = placemarks[user['user']].getLatLng();
		
		var extra = "";
		if (gpsLocation) {
			var distance = gpsLocation.distanceTo(user_loc);
			var heading = Math.atan2(user_loc.lng - gpsLocation.lng, user_loc.lat - gpsLocation.lat) * 180 / Math.PI;
			extra = ' ' + distanceFormat(distance) + ' ' + headingFormat(heading);
		}
		
		var imgel = $('<img width="24" height="24">');
		imgel.attr('src', user['icon']);
		
		$("#userlist").append(
			$("<a href='' class='list-group-item'>")
				.text(' '+ user['user'] + extra)
				.click(function(e) {e.preventDefault(); userClick(user['user'])})
				.prepend(imgel)
		);
		
	});
}

function toggleAutoRefresh() {
	if (!autoRefresh) {
		autoRefresh = true;
		$('#autorefresh_loc').text("Stop Live");
		uploadInterval = window.setInterval(uploadLocation, 10000);
		downloadInterval = window.setInterval(updateFollowing, 10000);
		uploadLocation();
		updateFollowing();
	} else {
		autoRefresh = false;
		window.clearInterval(uploadInterval);
		window.clearInterval(downloadInterval);
		$('#autorefresh_loc').text("Start Live");
	}
}

function fixheight() {
	var winheight = $(window).height();
	var usertop = parseInt($('#usermenu').css('top'), 10);
	var totalheight = usertop + parseInt($('#usermenu').css('height'), 10);
	
	if (totalheight > winheight) {
		var userheight = winheight - usertop;
		$("#usermenu").css('height',userheight);
	} else {
		$("#usermenu").css('height','auto');
	}
};

$(window).resize(fixheight);
   
$(document).ready(function() {
	fixheight();
	$("#gpsmenu").draggable();
	$("#usermenu").draggable();
	$("#upload_loc").click(uploadLocation);
	$("#goto_loc").click(gotoMyLocation);
	$("#autorefresh_loc").click(toggleAutoRefresh);
	
	
	map = L.map('map-canvas').setView([-34.929, 138.601], 13);
	
	L.tileLayer('http://otile1.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	
	
	$("#refresh_loc").click(updateFollowing);
	updateFollowing();
	
	$("#adduser").click(function(e) {
		e.preventDefault();
		$.post('/adduser/', $('#adduserform').serialize(),
			function(data) {
				$("#addstatus").html("Server returned: " + data);
				refreshLocation();
		});
	});
});

function togglePane(pane) {
	$(pane).toggle();
}