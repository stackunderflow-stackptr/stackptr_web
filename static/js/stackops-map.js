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
var webLocation;		// last location from website
var gpsLocation;		// my current location as a L.LatLng()
var watchID;			// id of geolocation watcher

var myData;				// data for logged in user
var followingData;		// data for following users

var autoRefresh = false; // do we auto-update?
var usesGeoLoc = false;

var groupData = {};		// group placemarks
var groupInfo = {};
var drawnItems;			// FeatureGroup of drawn items


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
		webLocation = new L.LatLng(myData['loc'][0], myData['loc'][1]);
		if (myData['user'] in placemarks) {
			placemarks[myData['user']].setLatLng(webLocation);
		} else {
			$("#loc").html("Creating placemark for self");
			
			placemarks[myData['user']] = new L.marker(webLocation,
			{
				icon: new L.icon({
					iconUrl: myData['icon'],
				}),
			});
			placemarks[myData['user']].addTo(map);
			//placemarks[myData['user']].bindPopup("test");
		};
		
		// create placemarks for followed people
		
		$("#loc").html("Creating placemarks for followed");
		followingData.forEach(function(user) {
			if (user['user'] in placemarks) {
				// if it does exist, move the placemark to it's current location
				placemarks[user['user']].setLatLng(new L.LatLng(user['loc'][0], user['loc'][1]));
			} else {
				// create a placemark otherwise
				placemarks[user['user']] = new L.marker(new L.LatLng(user['loc'][0], user['loc'][1]), {
					icon: new L.icon({
						iconUrl: user['icon'],
					}),
				});
				placemarks[user['user']].addTo(map);
			};
		});
		$("#loc").html("Locations updated");
		updateSideList();
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
		
		var my_loc;
		if (usesGeoLoc) {
			my_loc = gpsLocation;
		} else { 
			my_loc = webLocation;
		}
		
		var distance = my_loc.distanceTo(user_loc);
		var heading = Math.atan2(user_loc.lng - my_loc.lng, user_loc.lat - my_loc.lat) * 180 / Math.PI;
		extra = ' ' + distanceFormat(distance) + ' ' + headingFormat(heading);
		
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
		//uploadInterval = window.setInterval(uploadLocation, 10000);
		downloadInterval = window.setInterval(updateFollowing, 10000);
		//uploadLocation();
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

function popoutEdit(featureid, tgt) {
	console.log("test");
	tgt.popover('toggle');
	
	$("#" + featureid + "_textinput").val(groupInfo[featureid]['name']); // and 'owner'
	$("#" + featureid + "_description").val("description");
	return false;
}

function changefeature(a,e) {
	$.post('/renamefeature', {'id': a, 'name': $("#" + a + "_textinput").val()},
	function(data) {
		alert(data);
	});
	e.preventDefault();
	return false;
}

function featureClick(feature) {
	map.fitBounds(feature.getBounds());
	
	console.log("panning");
};

function changegroup() {
	var group = $("#selectgroup").val();
	$.post('/groupdata', {'group': group}, 
		function(data) {
			data.forEach(function(feature) {
				if (feature['id'] in groupData) {
					// update it
				} else {
					var editlink = $("<a href='#' onclick='' >edit</a>");
					var item = $("<a href='#' class='list-group-item'>")
						.text(' '+ feature['name'] + ' ');
					editlink.click(function(e) {
						e.stopImmediatePropagation();
						popoutEdit(feature['id'], item);
					});
					item.append(editlink);
					item.click(function(e) {
						e.preventDefault();
						featureClick(groupData[feature['id']]);
					});
					item.popover({'content': "<form class='form-horizontal'><div class='control-group'><label class='control-label' for='textinput'>Title</label><div class='controls'><input id='" + feature['id'] +  "_textinput' name='" + feature['id'] +  "_textinput' type='text' class='input-medium'></div></div><div class='control-group'><label class='control-label' for='description'>Description</label><div class='controls'><textarea id='" + feature['id'] + "_description' name=" + feature['id'] + "_description'></textarea></div></div><div class='control-group'><label class='control-label' for='submit'></label><div class='controls'><button id='submit' name='submit' class='btn btn-success' onclick='changefeature(" + feature['id'] + ",event)'>Submit</button><button id='cancel' name='cancel' class='btn btn-danger'>Cancel</button></div></div></form>", 'placement': 'left', 'container': 'body', 'html': true, 'trigger': 'manual'});
					
					$("#groupfeaturelist").append(item);
					var gjlayer = L.geoJson(feature['json']);
					drawnItems.addLayer(gjlayer);
					groupData[feature['id']] = gjlayer;
					groupInfo[feature['id']] = feature;
				}
				
			});
		}	
	,'json');
}

function setupDraw() {
	
	// Initialise the FeatureGroup to store editable layers
	drawnItems = new L.FeatureGroup();
	map.addLayer(drawnItems);
	
	var defaultShape = {
		color: '#000',
	}
	// Initialise the draw control and pass it the FeatureGroup of editable layers
	var drawControl = new L.Control.Draw({
		draw: {
			polyline: {
				shapeOptions: defaultShape,
			},
			polygon: {
				shapeOptions: defaultShape,
			},
			rectangle: {
				shapeOptions: defaultShape,
			},
			circle: false,
		},
	    edit: {
	        featureGroup: drawnItems,
	        remove: {},
	    }
	});
	map.addControl(drawControl);
	
	map.on('draw:created', function (e) {
		var type = e.layerType,
		layer = e.layer;
		
		/*if (type === 'marker') {
			layer.bindPopup('A popup!');
		}*/
		
		//alert(layer.toGeoJSON());
		
		$.post('/addfeature', 
			{'layer': '',
			 'geojson': JSON.stringify(layer.toGeoJSON())
			}, 
			function(data) {
				alert(data);
			}	
		);
		changegroup();
		//drawnItems.addLayer(layer);
	});
	
	map.on('draw:deleted', function(e) {
		console.log("draw:deleted");
		
		e.layers.eachLayer(function(deletedLayer) {
			for (var key in groupData) {
				groupData[key].eachLayer(function(layer) {
					if (deletedLayer == layer) {
						$.post('/delfeature', 
							{'id': key,}, 
							function(data) {
								alert(data);
							}	
						);
					}
				});
			}
		});
		
		changegroup();
	});
	changegroup();
}

$(window).resize(fixheight);
   
$(document).ready(function() {
	fixheight();
	$("#gpsmenu").draggable();
	$("#usermenu").draggable();
	$("#groupmenu").draggable();
	$("#upload_loc").click(uploadLocation);
	$("#goto_loc").click(gotoMyLocation);
	$("#autorefresh_loc").click(toggleAutoRefresh);
	$("#selectgroup").change(changegroup);
	
	
	map = L.map('map-canvas').setView([-34.929, 138.601], 13);
	
	L.tileLayer('https://otile{s}-s.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: '1234'
	}).addTo(map);
	
	setupDraw();


	$("#refresh_loc").click(updateFollowing);
	updateFollowing();
	
	$("#adduser").click(function(e) {
		e.preventDefault();
		$.post('/adduser', $('#adduserform').serialize(),
			function(data) {
				$("#addstatus").html("Server returned: " + data);
				refreshLocation();
		});
	});
});

function togglePane(pane) {
	$(pane).toggle();
}