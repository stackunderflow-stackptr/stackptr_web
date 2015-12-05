// ==UserScript==
// @id             iitc-plugin-stackptr
// @name           IITC plugin: StackPtr
// @category       Layer
// @version        0.0.6
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://stackptr.com/static/stackptr-iitc-plugin.user.js
// @downloadURL    https://stackptr.com/static/stackptr-iitc-plugin.user.js
// @description    Work with StackPtr online service
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==
function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== 'function') window.plugin = function() {};

    // PLUGIN START ////////////////////////////////////////////////////////

    window.plugin.stackptr = function() {};

    window.plugin.stackptr.settings = function() {

        if (window.plugin.stackptr.lib.key == undefined) {
            var html =
                '<b>API Key :</b><input type="text" name="apikey" onchange="window.plugin.stackptr.lib.key=this.value;window.plugin.stackptr.configsave()" value=""></br>';
            html = html +
                "<br>Warning: no API key set. Go to <a href='https://stackptr.com/api/' target='new'>https://stackptr.com/api/</a> to generate an API key";
        } else {
            var html =
                '<b>API Key :</b><input type="text" name="apikey" onchange="window.plugin.stackptr.lib.key=this.value;window.plugin.stackptr.configsave()" value="' +
                window.plugin.stackptr.lib.key + '\"></br>';
        }
        dialog({
            html: html,
            title: 'StackPtr settings',
        });

    }

    window.plugin.stackptr.setup = function() {
        console.log("StackPtr Loading")
        window.plugin.stackptr.lib = {}
        $('#toolbox').append(
            '<a onclick="window.plugin.stackptr.settings();return false;">StackPtr Opts</a>');
        window.plugin.stackptr.configload()
        window.plugin.stackptr.overload()
        console.log("StackPtr Loaded")
    };

    window.plugin.stackptr.configsave = function() {
        localStorage['plugin-stackptr-apikey'] = window.plugin.stackptr.lib.key;
    };

    window.plugin.stackptr.configload = function() {
        window.plugin.stackptr.lib.key = localStorage['plugin-stackptr-apikey'];
        if (window.plugin.stackptr.lib.key == undefined) {
            window.plugin.stackptr.settings();
        }
    };

    window.plugin.stackptr.overload = function() {

        function resetupIITC() {

            stackptr_leafletdata_map().then(function(map2) {
                map3 = map2
                for (var key in map._layers) {
                    console.log(key)
                    map3.addLayer(map._layers[key]);
                }
                map = map3

                map.addControl(window.layerChooser);

                map.attributionControl.setPrefix('');
                // listen for changes and store them in cookies
                map.on('moveend', window.storeMapPosition);

                map.on('moveend', function(e) {
                    // two limits on map position
                    // we wrap longitude (the L.LatLng 'wrap' method) - so we don't find ourselves looking beyond +-180 degrees
                    // then latitude is clamped with the clampLatLng function (to the 85 deg north/south limits)
                    var newPos = clampLatLng(map.getCenter().wrap());
                    if (!map.getCenter().equals(newPos)) {
                        map.panTo(newPos, {
                            animate: false
                        })
                    }
                });

                // map update status handling & update map hooks
                // ensures order of calls
                map.on('movestart', function() {
                    window.mapRunsUserAction = true;
                    window.requests.abort();
                    window.startRefreshTimeout(-1);
                });
                map.on('moveend', function() {
                    window.mapRunsUserAction = false;
                    window.startRefreshTimeout(ON_MOVE_REFRESH * 1000);
                });

                map.on('zoomend', function() {
                    window.layerChooserSetDisabledStates();
                });
                window.layerChooserSetDisabledStates();

                // on zoomend, check to see the zoom level is an int, and reset the view if not
                // (there's a bug on mobile where zoom levels sometimes end up as fractional levels. this causes the base map to be invisible)
                map.on('zoomend', function() {
                    var z = map.getZoom();
                    if (z != parseInt(z)) {
                        console.warn('Non-integer zoom level at zoomend: ' + z +
                            ' - trying to fix...');
                        map.setZoom(parseInt(z), {
                            animate: false
                        });
                    }
                });

                // set a 'moveend' handler for the map to clear idle state. e.g. after mobile 'my location' is used.
                // possibly some cases when resizing desktop browser too
                map.on('moveend', idleReset);

                window.addResumeFunction(function() {
                    window.startRefreshTimeout(ON_MOVE_REFRESH * 1000);
                });

                // create the map data requester
                window.mapDataRequest = new MapDataRequest();
                window.mapDataRequest.start();

                // start the refresh process with a small timeout, so the first data request happens quickly
                // (the code originally called the request function directly, and triggered a normal delay for the next refresh.
                //  however, the moveend/zoomend gets triggered on map load, causing a duplicate refresh. this helps prevent that
                window.startRefreshTimeout(ON_MOVE_REFRESH * 1000);

                //create a map name -> layer mapping - depends on internals of L.Control.Layers
                var nameToLayer = {};
                var firstLayer = null;

                for (i in window.layerChooser._layers) {
                    var obj = window.layerChooser._layers[i];
                    if (!obj.overlay) {
                        nameToLayer[obj.name] = obj.layer;
                        if (!firstLayer) firstLayer = obj.layer;
                    }
                }

                var baseLayer = nameToLayer[localStorage['iitc-base-map']] || firstLayer;
                map.addLayer(baseLayer);

                // now we have a base layer we can set the map position
                // (setting an initial position, before a base layer is added, causes issues with leaflet)
                var pos = getPosition();
                map.setView(pos.center, pos.zoom, {
                    reset: true
                });

                //event to track layer changes and store the name
                map.on('baselayerchange', function(info) {
                    for (i in window.layerChooser._layers) {
                        var obj = window.layerChooser._layers[i];
                        if (info.layer === obj.layer) {
                            localStorage['iitc-base-map'] = obj.name;
                            break;
                        }
                    }

                    //also, leaflet no longer ensures the base layer zoom is suitable for the map (a bug? feature change?), so do so here
                    map.setZoom(map.getZoom());

                });

            })

        }

        $stackptr_html =
            `<div class="panel panel-primary" id="usermenu" style="z-index:9001;right: 380px">
	<div class="panel-heading">Tracked Users 
	<a ng-click="toggleUserMenu()"><span class="glyphicon glyphicon-remove closebox pull-right"></span></a>
		
	</div>
	<div class="panel-body">
		
		<img width="32" height="32" class="user-icon" ng-src="[[userMe.icon]]" ng-click="center.lat = userMe.loc[0]; center.lng = userMe.loc[1]; center.zoom = 16">
		<span class="userme-label">[[userMe.username]]<span ng-if="userMe.lastupd > 0">, </span><span am-time-ago="userMe.lastupd" am-preprocess="unix" ng-if="userMe.lastupd > 0">,</span></span>
		
		<div ng-if="userMe.lastupd < 0">Your position has never been updated. You can install the mobile client for Android <a href="https://play.google.com/apps/testing/com.stackunderflow.stackptr">here</a> (iOS coming soon)</div>
				
		<span ng-if="(hUsers = (userList | updateRange:0:60)).length"><div class="label" >&lt;1m ago</div></span>
		
		<img width="32" height="32" class="user-icon" ng-repeat="user in hUsers" ng-src="[[user.icon]]"
			data-trigger="hover" bs-tooltip data-placement="left" data-html="true"
			data-title="<b>[[user.username]]</b><br>Last update: [[user.lastupd * 1000 | amCalendar]]"
			ng-click="clickMarker(user)">

		<span ng-if="(hUsers = (userList | updateRange:60:3600)).length"><div class="label" >&lt;1h ago</div></span>
		
		<img width="32" height="32" class="user-icon" ng-repeat="user in hUsers" ng-src="[[user.icon]]"
			data-trigger="hover" bs-tooltip data-placement="left" data-html="true"
			data-title="<b>[[user.username]]</b><br>Last update: [[user.lastupd * 1000 | amCalendar]]"
			ng-click="clickMarker(user)">
		
		<span ng-if="(dUsers = (userList | updateRange:3600:86400)).length"><div class="label">&lt;1d ago</div></span>
		
		<img width="32" height="32" class="user-icon" ng-repeat="user in dUsers" ng-src="[[user.icon]]" 
			data-trigger="hover" bs-tooltip data-placement="left" data-html="true"
			data-title="<b>[[user.username]]</b><br>Last update: [[user.lastupd * 1000 | amCalendar]]"
			ng-click="clickMarker(user)">
		
		<span ng-if="(wUsers = (userList | updateRange:86400:604800)).length"><div class="label">&lt;1w ago</div></span>

		<img width="32" height="32" class="user-icon" ng-repeat="user in wUsers" ng-src="[[user.icon]]" 
			data-trigger="hover" bs-tooltip data-placement="left" data-html="true"
			data-title="<b>[[user.username]]</b><br>Last update: [[user.lastupd * 1000 | amCalendar]]"
			ng-click="clickMarker(user)">
		
		<span ng-if="(oUsers = (userList | updateRange:604800:-1)).length"><div class="label">&gt;1w ago</div></span>

		<img width="32" height="32" class="user-icon" ng-repeat="user in oUsers" ng-src="[[user.icon]]" 
			data-trigger="hover" bs-tooltip data-placement="left" data-html="true"
			data-title="<b>[[user.username]]</b><br>Last update: [[user.lastupd * 1000 | amCalendar]]"
			ng-click="clickMarker(user)">
		
		<span ng-if="!pendingListEmpty"><div class="label">Outgoing Requests</div></span>
		
		<img width="32" height="32" class="user-icon" ng-repeat="user in userPending" ng-src="[[user.icon]]" 
			data-trigger="click" bs-tooltip data-placement="left" data-html="true"
			data-title="<b>[[user.username]]</b><br><a onClick='delUserClick(this,[[user.id]])'>Cancel Request</a>">
		
		<span ng-if="!reqsListEmpty"><div class="label">Incoming Requests</div></span>
		
		<img width="32" height="32" class="user-icon" ng-repeat="user in userReqs" ng-src="[[user.icon]]" 
			data-trigger="click" bs-tooltip data-placement="left" data-html="true"
			data-title="<b>[[user.username]], [[user.id]]</b><br><a onClick='acceptUserClick(this,[[user.id]])'>Accept</a>
			<a onClick='delUserClick(this,[[user.id]])'>Delete</a>">

		<br>

		<div ng-if="userListEmpty">Your user list is empty. Click the <span class="glyphicon glyphicon-plus"></span> to add another user.</div>


			<span class="glyphicon glyphicon-plus" onclick="$('#adduser').collapse('toggle')"></span>
			<div class="collapse" id="adduser">
				<form class="input-group input-group-sm" ng-submit="addUser($event)">
					<input type="text" name="user" class="form-control" value="">
					<span class="input-group-btn">
						<button class="btn btn-default" type="button" ng-click="addUser($event)">Add</button>
					</span>
				</form>	
			</div>
		
	</div>
</div>

<div class="panel panel-primary" id="groupmenu" style="z-index:9001 ;right: 380px">
	<div class="panel-heading">Groups <a ng-click="toggleGroupMenu()"><span class="glyphicon glyphicon-remove closebox pull-right"></span></a></div>
	<div class="panel-body" id="groupmenu_content">

		<div class="form-horizontal">
			<div class="form-group">
				<div class="col-sm-9">
					<select class="form-control" name="group" id="group" ng-model="group" ng-change="selectGroup()"
						ng-options="groupl.id as groupl.name for groupl in grouplist">
					</select>
				</div>
				<div class="col-sm-3" style="padding: 0px">
					    <span class="glyphicon glyphicon-plus icon-white" data-template-url="https://stackptr.com/static/template/groupAdd.html"
					    data-container="body" data-title="Add Group" bs-modal></span>
					    <span class="glyphicon glyphicon-list icon-white" data-template-url="https://stackptr.com/static/template/groupDiscover.html"
					    data-container="body" data-title="Discover Groups" ng-click="groupDiscover()" bs-modal></span>
					    <span class="glyphicon glyphicon-cog icon-white" data-template-url="https://stackptr.com/static/template/groupInfo.html"
					    data-container="body" data-title="Group Info: [[ grouplist[group].name ]]" ng-if="group >= 0 && group != null" bs-modal></span>
				</div>
			</div>
		</div>

		<div class="panel panel-default" ng-if="group >= 0 && group != null">
			<div class="panel-body">
				[[grouplist[group].description]]
			</div>
		</div>

		<div class="text-white" ng-if="!(group >= 0) || group == null">
		You have no groups. Click the <span class="glyphicon glyphicon-plus"></span> icon above to create a new group or click the <span class="glyphicon glyphicon-list"></span> icon to find an existing group.
		</div>
		
		<div class="list-group" id="groupfeaturelist" bs-collapse ng-model="activePanel" ng-animation="am-fade">
		<span id="feature-[[item.json.id]]" class="list-group-item list-item-draw" ng-repeat="item in groupdata">
			<span class="icon_type icon_[[item.json.geometry.type]]">&nbsp;</span>
			<a ng-click="gotoItem(item.json.id)">[[item.name]]</a>
			<span class="glyphicon glyphicon-pencil pull-right" bs-collapse-toggle></span>
			<div class="panel-collapse" bs-collapse-target>
				<br>
				<form class="input-group input-group-sm" ng-submit="renameGroupItem($event)">
					<input type="text" name="name" class="form-control" value="[[item.name]]">
					<input type="hidden" name="id" value="[[item.json.id]]">
					<span class="input-group-btn">
						<button class="btn btn-default" type="button" ng-click="renameGroupItem($event)">Rename</button>
					</span>
				</form>
				<b>Created by</b>: [[ item.owner ]]<br>
				<b>Type</b>: [[item.json.geometry.type]]<br>
				<b>ID</b>: [[item.json.id]]<br>
				<b>Description</b>: [[item.description]]<br>

				<span class="input-group-btn">
					<button class="btn btn-danger" type="button" ng-click="removeGroupItem($event)">Remove</button>
				</span>
			</div>
		</span>
		</div>

	</div>
</div>
</div>

`;

        document.getElementById("map").innerHTML = ""
        document.getElementById("map").setAttribute("leaflet", "")
        document.getElementById("map").setAttribute('lf-defaults', "defaults")
        document.getElementById("map").setAttribute('tiles', "tiles")
        document.getElementById("map").setAttribute('lf-center', "center")
        document.getElementById("map").setAttribute('lf-draw', "drawOptions")
        document.getElementById("map").setAttribute('markers', "markers")
        document.getElementById("map").setAttribute('paths', "paths")

        stackptr_div = document.createElement("div")
        document.getElementsByTagName("body")[0].setAttribute("ng-controller", "StackPtrMap")
        stackptr_div.innerHTML = $stackptr_html
        document.getElementsByTagName("body")[0].appendChild(stackptr_div)
        document.getElementsByTagName("html")[0].setAttribute("ng-app", "StackPtr")

        $.getScript("https://cdnjs.cloudflare.com/ajax/libs/async/1.5.0/async.min.js", function() {

            var libs = ["bootstrap.min.js", "jquery-ui-1.10.3.custom.min.js", "jquery.cookie.js",
                "angular.min.js", "stackptr-mapview.js", "stackptr-utils.js",
                "angular-cookies.min.js", "ui-leaflet.min.js", "angular-animate.min.js",
                "angular-sanitize.min.js", "angular-simple-logger.min.js",
                "leaflet.draw-src.js", "ui-leaflet-draw.js", "moment.min.js",
                "angular-moment.min.js", "angular-strap.min.js", "angular-strap.tpl.min.js",
                "autobahn.min.js", "angular-wamp.js"

                , "color-thief.min.js"
            ]

            // /static/css/
            var css = [
                "bootstrap.min.css",
                "bootstrap-theme.min.css",
                "index.css"
            ]

            for (var y = 0; y < css.length; y++) {
                $('head').append('<link rel="stylesheet" type="text/css" href="' +
                    "https://stackptr.com/static/css/" + css[y] + '">');
            }

            stackptr_server_base_host = "stackptr.com"
            stackptr_server_base_protocol = "https:"
            stackptr_apikey = window.plugin.stackptr.lib.key

            var host = "https://stackptr.com/static/js/"

            var downloadFunction = function(url) {

                return function(callback) {

                    $.ajax({
                        url: url,
                        dataType: "script",
                        success: function() {
                            console.log("got - " + url);
                            callback()
                        },
                        cache: true
                    });

                }

            }

            var work = []

            for (var x = 0; x < libs.length; x++) {
                work.push(downloadFunction(host + libs[x]))
            }
            async.series(work, function() {

                $("#usermenu").draggable();
                $("#groupmenu").draggable().resizable({
                    minHeight: 96,
                    minWidth: 192
                });

                $("#groupmenu").on("dragstart", function(e, u) {
                    $("#usermenu").off("DOMSubtreeModified");
                });

                shiftGroupMenu();

                $("#usermenu").on("DOMSubtreeModified", shiftGroupMenu);

                angular.bootstrap(document, ["StackPtr"]);
                myVar = setTimeout(resetupIITC, 2000);
                L.Icon.Default.imagePath = "https://stackptr.com/static/js/images";

            })
        });

    }

    setup = window.plugin.stackptr.setup;

    // PLUGIN END //////////////////////////////////////////////////////////
    setup.info = plugin_info; //add the script info data to the function as a property
    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = {
    version: GM_info.script.version,
    name: GM_info.script.name,
    description: GM_info.script.description
};
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);