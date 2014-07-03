$(window).resize(fixheight);
   
$(document).ready(function() {
	fixheight();
	$("#gpsmenu").draggable();
	$("#usermenu").draggable();
	$("#groupmenu").draggable();
	//$("#upload_loc").click(uploadLocation);
	//$("#goto_loc").click(gotoMyLocation);
	//$("#autorefresh_loc").click(toggleAutoRefresh);
	$("#selectgroup").change(changegroup);
	
	
	map = L.map('map-canvas').setView([-34.929, 138.601], 13);
	
	L.tileLayer('https://otile{s}-s.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: '1234',
	detectRetina: true,
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
	
	setupAutoRefresh();
});
