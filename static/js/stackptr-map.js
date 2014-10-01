// stackptr-map.js
// This file is for code common between the map on stackptr.com and any other map

//Creates the StackPtr constructor. Everything should sit inside this constructor
StackPtr = function (serverurl, map) {
	this.serverurl = typeof serverurl !== 'undefined' ? serverurl : "/";
	this.map = typeof map !== 'undefined' ? map : map;
	StackPtr.refernce = this; // TODO work out a better way of dealing with "this" and callbacks to ajax requests. For now presuming only one stackptr instance is running
	this.placemarks = {};	// map of placemarks
	this.webLocation;		// last location from website
	this.gpsLocation;		// my current location as a L.LatLng()
 	this.watchID;			// id of geolocation watcher

	this.locData;			// last fetched location data

	this.autoRefresh = false; // do we auto-update?
	this.usesGeoLoc = false;

	this.groupData = {};		// group placemarks
	this.groupInfo = {};
	this.drawnItems;			// FeatureGroup of drawn items

	this.refreshTime;		// seconds left for refresh counter

	this.uploadInterval;
	this.downloadInterval;

	this.expandedUsers = [];

	this.gotoMe = 1;
}
	StackPtr.prototype.updateFollowing  = function () {
	$.getJSON('users', function(data) {
		StackPtr.refernce.updateMapView(data);
		StackPtr.refernce.updatePlacemarks(data,StackPtr.refernce.placemarks,StackPtr.refernce.map);
		StackPtr.refernce.updateSideList(data);
	});
}

StackPtr.prototype.updateMapView  = function (data) {
	if (this.gotoMe == 1 && data['me']) {
		var myData = data['me'];
		this.map.setView(myData['loc'], 13, {'animate': false});
		this.gotoMe = 0;
	}
}

StackPtr.prototype.updatePlacemarks  = function (data,pl,fg) {
	var myData = data['me'];
	if (data['me']){
		this.webLocation = new L.LatLng(myData['loc'][0], myData['loc'][1]);
		this.updatePlacemark(myData,pl,fg);
	}
	var followingData = data['following'];
	
	followingData.forEach(function(obj) {
		StackPtr.refernce.updatePlacemark(obj,pl,fg);
	});
}

StackPtr.prototype.updatePlacemark  = function (data,pl,fg) {
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

StackPtr.prototype.userClick  = function (user) {
	this.map.panTo(this.placemarks[user].getLatLng());
	//placemarks[user].openPopup();
	this.map.setZoom(16);
};

StackPtr.prototype.do_expand  = function (user, item) {
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

StackPtr.prototype.do_unexpand  = function (user, item) {
	$(item).removeClass("glyphicon-minus");
	$(item).addClass("glyphicon-plus");
	$(item.parentNode).find(".extra").remove();
}

StackPtr.prototype.expand_side  = function (user, item) {
	if ($.inArray(user['user'],this.expandedUsers) == -1) {
		this.expandedUsers.push(user['user']);
		this.do_expand(user, item);
	} else {
		this.expandedUsers.splice($.inArray(user['user'], this.expandedUsers),1);
		this.do_unexpand(user,item);
	}
}

StackPtr.prototype.acceptUser  = function (user) {
	$.post('/acceptuser', {'user': user}, 
		function(data) {
			StackPtr.refernce.updateFollowing();
		}	
	);
}

StackPtr.prototype.rejectUser  = function (user) {
	$.post('/rejectuser', {'user': user}, 
		function(data) {
			StackPtr.refernce.updateFollowing();
		}	
	);
}

StackPtr.prototype.addUser  = function (user) {
	$.post('/adduser', {'user': user}, 
		function(data) {
			StackPtr.refernce.updateFollowing();
		}	
	);
}

StackPtr.prototype.delUser  = function (user) {
	$.post('/deluser', {'user': user}, 
		function(data) {
			StackPtr.refernce.updateFollowing();
		}	
	);
}

StackPtr.prototype.updateSideList  = function (data) {
	this.data = data;
	$('#userlist').html('');
	if (data['me']){
		this.updateSideList.updateUser(data['me']);
	}
	data['following'].forEach(StackPtr.refernce.updateSideList.updateUser);
	data['pending'].forEach(StackPtr.refernce.updateSideList.updatePendingUser);
	data['reqs'].forEach(StackPtr.refernce.updateSideList.updateReqsUser);
	fixheight();
}
StackPtr.prototype.updateSideList.updateUser = function(user) {
		var user_loc = StackPtr.refernce.placemarks[user['user']].getLatLng();
		var extra = "";
		
		var my_loc;
		if (this.usesGeoLoc) {
			my_loc = this.gpsLocation;
		} else { 
			my_loc = this.webLocation;
		}
		if (StackPtr.refernce.data['me']){
			var distance = my_loc.distanceTo(user_loc);
			var heading = Math.atan2(user_loc.lng - my_loc.lng, user_loc.lat - my_loc.lat) * 180 / Math.PI;
			var time = user['lastupd'];
			extra = ' ' + distanceFormat(distance) + ' ' + headingFormat(heading) + ' ' + timeFormat(time);
		}
		var imgel = $('<img width="24" height="24">');
		imgel.attr('src', user['icon']);
		
		var plus = $("<span class='glyphicon glyphicon-plus pull-right'></span><br>");
		plus.click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			StackPtr.refernce.expand_side(user, this);
			});
		
		$("#userlist").append(
			$("<a href='' class='list-group-item list-item-person'>")
				.text(' '+ user['user'] + extra)
				.click(function(e) {e.preventDefault(); StackPtr.refernce.userClick(user['user'])})
				.prepend(imgel)
				.append(plus)
		);
		
		if ($.inArray(user['user'],StackPtr.refernce.expandedUsers) != -1) {
			this.do_expand(user, plus[0]);
		};
		
	};
StackPtr.prototype.updateSideList.updatePendingUser = function(user) {
	$("#userlist").append(
		$("<a href='' class='list-group-item list-item-person'>")
			.text(' '+ user['user'] + " (awaiting approval)")
	);
}

StackPtr.prototype.updateSideList.updateReqsUser = function(user) {
	var a = $("<a href='' class='list-group-item list-item-person'>")
			.text(' '+ user['user'] + " wants to follow you.");
	
	var b = $("<div>");
	b.append($("<a>").text("accept").click(function(e) { e.preventDefault(); acceptUser(user['user'])}));
	b.append($("<span>").html("&nbsp;"));
	b.append($("<a>").text("reject").click(function(e) { e.preventDefault(); rejectUser(user['user'])}));
			
	$("#userlist").append(a);
	a.append(b);
}

StackPtr.prototype.updateTimer = function() {
	refreshTime--;
	if (refreshTime <= 0) {
		$(".refreshtimer").each(function(i){
			$(this).text("Updating...");
		});
		StackPtr.refernce.updateFollowing;
		refreshTime = 5;
	}
	$(".refreshtimer").each(function(i){
		$(this).text("Updating in " + refreshTime + " seconds");
	});
}

StackPtr.prototype.setupAutoRefresh =function() {
	downloadInterval = window.setInterval(this.updateTimer, 1000);
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

this.fixheight = function() {
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

StackPtr.prototype.popoutClose  = function (e) {
	e.preventDefault();
	$('.popover').remove();
}

StackPtr.prototype.popoutEdit  = function (featureid, tgt) {
	$('.popover').remove();
	tgt.popover('toggle');
	
	$("#" + featureid + "_textinput").val(this.groupInfo[featureid]['name']); // and 'owner'
	$("#" + featureid + "_description").val("description");
	return false;
}

StackPtr.prototype.changefeature  = function (a,e) {
	$.post('/renamefeature', {'id': a, 'name': $("#" + a + "_textinput").val()},
	function(data) {
	});pda
	e.preventDefault();
	return false;
}

StackPtr.prototype.featureClick  = function (feature) {
	this.map.fitBounds(feature.getBounds());
};

StackPtr.prototype.updateGroupData  = function () {
//grabs the data via post request
var group = $("#selectgroup").val();
$.post('/groupdata', {'group': group}, function(data){StackPtr.refernce.updateDrawnItems(data,StackPtr.refernce.drawnItems,StackPtr.refernce.addItemToGroupsList,StackPtr.refernce.addItemToGroupsList,StackPtr.refernce.addItemToGroupsList)}, 'json');
}


StackPtr.prototype.changegroup = function(){
	//changes currently selected group
	this.updateGroupData();
}

StackPtr.prototype.updateDrawnItems  = function (data, fg, removeitemcallback, additemcallback, updateitemcallback) {
	//remove items not in groupdata
	for(item in this.groupData){
		if (!(item in data)){
			fg.removeLayer(this.groupData[item])
			delete this.groupData[item]
			removeitemcallback(item,data[item]);
		}
	}
	for (item in data){
		feature = data[item]
		this.groupInfo[item] = data[item]
		if (item in this.groupData){
			//TODO check if actually updated or something rather than just deleting and readding all the items
			fg.removeLayer(this.groupData[item])
			var gjlayer = L.geoJson(feature['json']);
			fg.addLayer(gjlayer);
			this.groupData[item] = gjlayer;
			updateitemcallback(item,data[item]);
		} else {

			var gjlayer = L.geoJson(feature['json']);
			fg.addLayer(gjlayer);
			this.groupData[item] = gjlayer;
			additemcallback(item,data[item]);
		}
	}
	
}

StackPtr.prototype.addItemToGroupsList  = function (id,data) {
	feature=data
	console.log(data)
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
		featureClick(this.groupData[id]);
	});
	item.popover({'content': "<form class='form-horizontal'><div class='control-group'><label class='control-label' for='textinput'>Title</label><div class='controls'><input id='" + id +  "_textinput' name='" + id +  "_textinput' type='text' class='input-medium'></div></div><div class='control-group'><label class='control-label' for='description'>Description</label><div class='controls'><textarea id='" + id + "_description' name=" + id + "_description'></textarea></div></div><div class='control-group'><label class='control-label' for='submit'></label><div class='controls'><button id='submit' name='submit' class='btn btn-success' onclick='changefeature(" + id + ",event)'>Submit</button><button id='cancel' name='cancel' class='btn btn-danger' onclick='popoutClose(event)'>Cancel</button></div></div></form>", 'placement': 'left', 'container': 'body', 'html': true, 'trigger': 'manual'});
	
	$("#groupfeaturelist").append(item);
				
}


StackPtr.prototype.setupDraw = function() {
	
	// Initialise the FeatureGroup to store editable layers
	this.drawnItems = new L.FeatureGroup();
	this.map.addLayer(this.drawnItems);
	
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
	        featureGroup: this.drawnItems,
	        remove: {},
	    }
	});
	this.map.addControl(drawControl);
	
	this.map.on('draw:created', function (e) {
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
			}	
		);
		StackPtr.refernce.changegroup();
		//drawnItems.addLayer(layer);
	});
	
	map.on('draw:deleted', function(e) {
		
		e.layers.eachLayer(function(deletedLayer) {
			for (var key in StackPtr.refernce.groupData) {
				StackPtr.refernce.groupData[key].eachLayer(function(layer) {
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
		
		StackPtr.refernce.changegroup();
	});
	StackPtr.refernce.changegroup();
}




