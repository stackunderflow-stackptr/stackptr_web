// stackptr-map.js
// This file is for code common between the map on stackptr.com and any other map


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

function updateFollowing() {
	$.getJSON('users', function(data) {
		updatePlacemarks(data,placemarks,map);
		updateSideList(data);
	});
}

function updatePlacemarks(data,pl,fg) {
	var myData = data['me'];
	webLocation = new L.LatLng(myData['loc'][0], myData['loc'][1]);
	var followingData = data['following'];
	updatePlacemark(myData,pl,fg);
	followingData.forEach(function(obj) {
		updatePlacemark(obj,pl,fg);
	});
}

function updatePlacemark(data,pl,fg) {
	var uLoc = new L.LatLng(data['loc'][0], data['loc'][1]);
	if (data['user'] in pl) {
		pl[data['user']].setLatLng(uLoc);
		pl[data['user']].setOpacity(opacityValue(data['lastupd']));
	
	} else {		
		pl[data['user']] = new L.marker(uLoc,
		{
			icon: new L.icon({
				iconUrl: data['icon'],
				iconRetinaUrl: data['icon'],
				iconSize: [32,32],
			}),
			opacity: opacityValue(data['lastupd']),
		});
		pl[data['user']].addTo(fg);		
		pl[data['user']].bindPopup(formatExtra(data['extra']));
	};
}

function userClick(user) {
	map.panTo(placemarks[user].getLatLng());
	//placemarks[user].openPopup();
	map.setZoom(16);
};

function do_expand(user, item) {
	var extra = $("<span class='extra'></span>");
	
	if (user['extra']['bat']) {
		extra.append($("<b>").text("Battery: "));
		extra.append($("<span>").text(user['extra']['bat'] * 100.0));
		extra.append($("<span>").text("% "));
		extra.append($("<span>").text(user['extra']['bst']));
		extra.append($("<br>"));
	}
	
	if (user['extra']['prov']) {
		extra.append($("<b>").text("Provider: "));
		extra.append($("<span>").text(user['extra']['prov']));
		extra.append($("<br>"));
	}

	if (user['alt']) {
		extra.append($("<b>").text("Altitude: "));
		extra.append($("<span>").text(user['alt']));
		extra.append($("<span>").text(" m"));
		extra.append($("<br>"));
	}

	if (user['hdg']) {
		extra.append($("<b>").text("Heading: "));
		extra.append($("<span>").text(user['hdg']));
		extra.append($("<span>").text(" deg"));
		extra.append($("<br>"));
	}
	
	if (user['spd']) {
		extra.append($("<b>").text("Speed: "));
		extra.append($("<span>").text(user['spd'] * 3.6));
		extra.append($("<span>").text(" km/h"));
		extra.append($("<br>"));
	}
	
	$(item.parentNode).append(extra);
	
	$(item).removeClass("glyphicon-plus");
	$(item).addClass("glyphicon-minus");
}

function do_unexpand(user, item) {
	$(item).removeClass("glyphicon-minus");
	$(item).addClass("glyphicon-plus");
	$(item.parentNode).find(".extra").remove();
}

function expand_side(user, item) {
	if ($.inArray(user['user'],expandedUsers) == -1) {
		expandedUsers.push(user['user']);
		do_expand(user, item);
	} else {
		expandedUsers.splice($.inArray(user['user'], expandedUsers),1);
		do_unexpand(user,item);
	}
}

function updateSideList(data) {
	$('#userlist').html('');
	updateUser(data['me']);
	data['following'].forEach(updateUser);
	
	function updateUser(user) {
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
		
		var plus = $("<span class='glyphicon glyphicon-plus pull-right'></span><br>");
		plus.click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			expand_side(user, this);
			});
		
		$("#userlist").append(
			$("<a href='' class='list-group-item list-item-person'>")
				.text(' '+ user['user'] + extra)
				.click(function(e) {e.preventDefault(); userClick(user['user'])})
				.prepend(imgel)
				.append(plus)
		);
		
		if ($.inArray(user['user'],expandedUsers) != -1) {
			do_expand(user, plus[0]);
		};
		
	};
	fixheight();
}

function updateTimer() {
	refreshTime--;
	if (refreshTime <= 0) {
		$(".refreshtimer").each(function(i){
			$(this).text("Updating...");
		});
		updateFollowing();
		refreshTime = 5;
	}
	$(".refreshtimer").each(function(i){
		$(this).text("Updating in " + refreshTime + " seconds");
	});
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
	var userheight = $('#usermenu').height();
	$('#groupmenu').css('top',userheight+usertop+10);
	var groupheight = parseInt($('#groupmenu').css('top'), 10);
	
	var totalheight = usertop + userheight + 10 + groupheight;
	
	if (totalheight > winheight) {
		var newheight = winheight - (usertop + userheight + 10) - 40;
		$("#groupmenu_content").css('height',newheight);
	} else {
		$("#groupmenu_content").css('height','auto');
	}
};

function popoutClose(e) {
	e.preventDefault();
	$('.popover').remove();
}

function popoutEdit(featureid, tgt) {
	$('.popover').remove();
	tgt.popover('toggle');
	
	$("#" + featureid + "_textinput").val(groupInfo[featureid]['name']); // and 'owner'
	$("#" + featureid + "_description").val("description");
	return false;
}

function changefeature(a,e) {
	$.post('/renamefeature', {'id': a, 'name': $("#" + a + "_textinput").val()},
	function(data) {
		console.log(data)
	});pda
	e.preventDefault();
	return false;
}

function featureClick(feature) {
	map.fitBounds(feature.getBounds());
	
	console.log("panning");
};

function updateGroupData() {
//grabs the data via post request
var group = $("#selectgroup").val();
$.post('/groupdata', {'group': group}, function(data){updateDrawnItems(data,drawnItems,addItemToGroupsList,addItemToGroupsList,addItemToGroupsList)}, 'json');
}


function changegroup(){
	//changes currently selected group
	updateGroupData();
}

function updateDrawnItems(data, fg, removeitemcallback, additemcallback, updateitemcallback){
	//remove items not in groupdata
	for(item in groupData){
		if (!(item in data)){
			fg.removeLayer(groupData[item])
			delete groupData[item]
			removeitemcallback(item,data[item]);
		}
	}
	for (item in data){
		feature = data[item]
		groupInfo[item] = data[item]
		if (item in groupData){
			//TODO check if actually updated or something rather than just deleting and readding all the items
			fg.removeLayer(groupData[item])
			var gjlayer = L.geoJson(feature['json']);
			fg.addLayer(gjlayer);
			groupData[item] = gjlayer;
			updateitemcallback(item,data[item]);
		} else {

			var gjlayer = L.geoJson(feature['json']);
			fg.addLayer(gjlayer);
			groupData[item] = gjlayer;
			additemcallback(item,data[item]);
		}
	}
	
}

function addItemToGroupsList(id,data){
	feature=data
	var editlink = $("<a id='feature-edit"+id+"'' href='#' onclick='' ><span class='glyphicon glyphicon-pencil pull-right'></span></a>");
	var item = $("<a id='feature-"+id+"'' href='#' class='list-group-item list-item-draw'>")
		.text(' '+ feature['name'] + ' ');
	editlink.click(function(e) {
		e.stopImmediatePropagation();
		popoutEdit(id, item);
	});
	item.append(editlink);
	item.click(function(e) {
		e.preventDefault();
		featureClick(groupData[id]);
	});
	item.popover({'content': "<form class='form-horizontal'><div class='control-group'><label class='control-label' for='textinput'>Title</label><div class='controls'><input id='" + id +  "_textinput' name='" + id +  "_textinput' type='text' class='input-medium'></div></div><div class='control-group'><label class='control-label' for='description'>Description</label><div class='controls'><textarea id='" + id + "_description' name=" + id + "_description'></textarea></div></div><div class='control-group'><label class='control-label' for='submit'></label><div class='controls'><button id='submit' name='submit' class='btn btn-success' onclick='changefeature(" + id + ",event)'>Submit</button><button id='cancel' name='cancel' class='btn btn-danger' onclick='popoutClose(event)'>Cancel</button></div></div></form>", 'placement': 'left', 'container': 'body', 'html': true, 'trigger': 'manual'});
	
	$("#groupfeaturelist").append(item);
				
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
				console.log(data);
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