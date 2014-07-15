// GPS functions

/*
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
*/

// update following users

/*function downloadFollowingAPI(apikey) {
	$.getJSON
}*/

function downloadFollowingAndUpdate() {
	$.getJSON('users', function(data) {
		updatePlacemarks(data,placemarks);
		updateSideList(data);
	});
}

function updatePlacemarks(data,pl) {
	var myData = data['me'];
	webLocation = new L.LatLng(myData['loc'][0], myData['loc'][1]);
	var followingData = data['following'];
	updatePlacemark(myData,pl);
	followingData.forEach(function(obj) {
		updatePlacemark(obj,pl);
	});
}

function updatePlacemark(data,pl) {
	var uLoc = new L.LatLng(data['loc'][0], data['loc'][1]);
	if (data['user'] in pl) {
		pl[data['user']].setLatLng(uLoc);
		pl[data['user']].setOpacity(opacityValue(data['lastupd']));
	
	} else {		
		pl[data['user']] = new L.marker(uLoc,
		{
			icon: new L.icon({
				iconUrl: data['icon'],
			}),
			opacity: opacityValue(data['lastupd']),
		});
		pl[data['user']].addTo(map);
	};
}

function updateFollowing() {
		downloadFollowingAndUpdate();
};

function userClick(user) {
	map.panTo(placemarks[user].getLatLng());
	map.setZoom(16);
};

function updateSideList(data) {
	$('#userlist').html('');
	data['following'].forEach(function(user) {
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
		var time = user['lastupd'];
		extra = ' ' + distanceFormat(distance) + ' ' + headingFormat(heading) + ' ' + timeFormat(time);
		
		var imgel = $('<img width="24" height="24">');
		imgel.attr('src', user['icon']);
		
		$("#userlist").append(
			$("<a href='' class='list-group-item list-item-person'>")
				.text(' '+ user['user'] + extra)
				.click(function(e) {e.preventDefault(); userClick(user['user'])})
				.prepend(imgel)
		);
		
	});
}

function updateTimer() {
	refreshTime--;
	if (refreshTime <= 0) {
		$("#refresh").text("Updating...");
		updateFollowing();
		refreshTime = 5;
	}
	$("#refresh").text("Updating in " + refreshTime + " seconds");
}

function setupAutoRefresh() {
	downloadInterval = window.setInterval(updateTimer, 1000);
	refreshTime = 6;
}

/*
function toggleAutoRefresh() {
	if (!autoRefresh) {
		autoRefresh = true;
		$('#autorefresh_loc').text("Stop Live");
		downloadInterval = window.setInterval(updateFollowing, 10000);
		updateFollowing();
	} else {
		autoRefresh = false;
		window.clearInterval(uploadInterval);
		window.clearInterval(downloadInterval);
		$('#autorefresh_loc').text("Start Live");
	}
}*/

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
					var item = $("<a href='#' class='list-group-item list-item-draw'>")
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



function togglePane(pane) {
	$(pane).toggle();
}