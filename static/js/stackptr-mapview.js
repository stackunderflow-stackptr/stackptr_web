// stackptr-mapview.js
// this is for stuff specific to stackptr.com, not external maps

//window.stackptr.resize(fixheight);
   
$(document).ready(function() {
	map = L.map('map-canvas').setView([-34.929, 138.601], 13);
	window.stackptr = new StackPtr("/", undefined, map);
	window.stackptr.bootstrap = true;
	$("#gpsmenu").draggable();
	$("#usermenu").draggable();
	$("#groupmenu").draggable();
	//$("#upload_loc").click(uploadLocation);
	//$("#goto_loc").click(gotoMyLocation);
	//$("#autorefresh_loc").click(toggleAutoRefresh);
	$("#selectgroup").change(stackptr.changegroup);


	//L.tileLayer('https://otile{s}-s.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', {
	//    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
	//    maxZoom: 19,
	//    subdomains: '1234',
	//detectRetina: true,
	//}).addTo(map);
	
	var tp = "tiles";
	if(L.Browser.retina) {
		 tp = "tiles_r";
	};
    L.tileLayer('https://stackptr.com/'+tp+'/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);

	stackptr.setupDraw();


	$("#refresh_loc").click(stackptr.updateFollowing);
	stackptr.updateFollowing();
	
	$("#adduser").click(function(e) {
		e.preventDefault();
		$.post('/adduser', $('#adduserform').serialize(),
			function(data) {
				$("#addstatus").html("Server returned: " + data);
				stackptr.refreshLocation();
		});
	});
	
	stackptr.setupAutoRefresh();
});


togglePane  = function (pane) {
	$(pane).toggle();
}
