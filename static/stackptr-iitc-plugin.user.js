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
                var html = '<b>API Key :</b><input type="text" name="apikey" onchange="window.plugin.stackptr.lib.key=this.value;window.plugin.stackptr.configsave()" value=""></br>';
                html = html + "<br>Warning: no API key set. Go to <a href='https://stackptr.com/api/' target='new'>https://stackptr.com/api/</a> to generate an API key";
            } else {
                var html = '<b>API Key :</b><input type="text" name="apikey" onchange="window.plugin.stackptr.lib.key=this.value;window.plugin.stackptr.configsave()" value="' + window.plugin.stackptr.lib.key + '\"></br>';
            }
            dialog({
                html: html,
                title: 'StackPtr settings',
            });

        }

        window.plugin.stackptr.addTileLayer = function() {
            osmAttribution = 'Map data © OpenStreetMap';
            var tp = "tiles";
            if (L.Browser.retina) {
                tp = "tiles_r";
            };
            var ocmOpt = {
                attribution: osmAttribution,
                maxNativeZoom: 18,
                maxZoom: 18
            };
            var ocmStackptr = new L.TileLayer('https://stackptr.com/' + tp + '/{z}/{x}/{y}.png', ocmOpt);
            layerChooser.addBaseLayer(ocmStackptr, "Stackptr Tiles");
        };


        window.plugin.stackptr.setup = function() {
            window.plugin.stackptr.layer = new L.FeatureGroup();
            window.plugin.stackptr.placemarks = {};
            window.plugin.stackptr.addTileLayer();
            window.addLayerGroup('StackPtr', window.plugin.stackptr.layer, true);

            $.getScript("https://stackptr.com/static/js/stackptr-utils.js", function() {
                $.getScript("https://stackptr.com/static/js/stackptr-map.js", function() {
                    $.getScript("https://stackptr.com/static/js/leaflet.draw.js", function() {
                        setInterval(window.plugin.stackptr.update, 5000);
                        window.plugin.stackptr.lib = new StackPtr("https://stackptr.com/", localStorage['plugin-stackptr-apikey'], window.plugin.stackptr.layer);
                        window.plugin.stackptr.configload();
                        $('#toolbox').append('<a onclick="window.plugin.stackptr.settings();return false;">StackPtr Opts</a>');
                        window.plugin.stackptr.lib.setupAutoRefresh();
                        if (window.plugin.drawTools) {
                            window.dialog({
                                html: "StackPtr drawing tools will not fuction as IITC drawing tools are installed",
                                title: "StackPtr Warning"
                            })
                        } else {
                            window.plugin.stackptr.css();
                            window.plugin.stackptr.lib.setupDraw();
                        }
                    });
                });
            });
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



        window.plugin.stackptr.css = function() {
            // *shrug* could be done better but meh.
            $('head').append('<style>/* ================================================================== */\n/* Toolbars\n/* ================================================================== */\n\n.leaflet-draw-section {\n    position: relative;\n}\n\n.leaflet-draw-toolbar {\n	margin-top: 12px;\n}\n\n.leaflet-draw-toolbar-top {\n	margin-top: 0;\n}\n\n.leaflet-draw-toolbar-notop a:first-child {\n	border-top-right-radius: 0;\n}\n\n.leaflet-draw-toolbar-nobottom a:last-child {\n	border-bottom-right-radius: 0;\n}\n\n.leaflet-draw-toolbar a {\n	background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANIAAAAeCAYAAABZs0CNAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAtVJREFUeNrsmlFy2jAQhkWG93CD0hM0PUHhhdfADeAECScInAA4QblBeOYFcoK6Jyg5QdwTtLvp747GhNgmWttx/m/GY42s8Uqy/l1JlnOEEEIIIYQQQgghhBBCCCGEHNNiF5C6MxgMOnIbb7fbpcG7Z3K7S2XPxdasyHvaASv0J0lLJVpGDb6Ra4OGHho+eLpyG8rVQVasbbduNwat2u0i6wC7sbHNq3S+2Nzj2U6fS/qL5E0MqvBfOBhn1UQkNPZJBaSCCi0keedYbt9T2WtLQfmO4TWMnMat3BYnHk8tPDPs6mC+90TkPDGNxG5kICC113vhsX7fKdLaFzoGJlKHtVEUyhSZqZB8j2ExuE6IyFxQVQkpQ0RmYsJ3/AERafRZ4dENoqL279eQkUls7iCiA64EFewc40rp6/jSCFXXGUQ7oIi08f3AHZ0lIgdPNW7Ceg/TuUWOogspG3qa50/n+kn0UTuewIZwXKF4FpHY+pzhnHtSZlPC2uisaPQmIdVERE1jWLBsyKjU9aJs5KflWxyVCcgmQ0STVLQKujYK9aKLOooIFBFR1BAhdYzKnrNWOkoLlwbmfmeIKPKmeLXloqYicgWnEHFDhPSpQtt+H+506oPpjz+IH43rcOuLCBsLQ0unUYmQShRREnbzvvuhIUL6WaHzWKei3R2uzpnO7S0E2Z2rpZBKFpHDQnr1wSLSxqhsnv6OM9YMc8vvjTrMdBf0vYkot5CwFfxUlog8ljlF0og1EpzHNEfRqdH/s+WJhf0h8MaGz3We59jRrC3tAh+5BUGVJaJnLyk2V+71bcrY2e3qVCGmJXbJSv8hi/4eYebhn6gYGX3zvVw9/E96aXr+Dc57X/eTLLn+vVgf/8lh/5f7t/W6h2gekY7KEnUFbe66Co4IwXZywsE5gxMNqeXCqZMNvtiCCzn0fyRCCCGEEEIIIYQQQgghhBBCCCFG/BVgAMuWWtfqVjkMAAAAAElFTkSuQmCC);\n	background-repeat: no-repeat;\n}\n\n.leaflet-retina .leaflet-draw-toolbar a {\n	background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAaQAAAA8CAYAAAApDs6vAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABV1JREFUeNrs3d1R20AUhmHBUIBLcCqI6UDccA0VYFcAqQBTAbgCQwVwzQ1OBTgVxCU4FZA9ydGMoki2flZmz+p9ZjTBxNaw7M+3KwkpSQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALo54lcAAMN1fn7+Ued9r6+vvefFCdUBAF4G9on7581t39zg/chvJIJAqkrrQ6SzxzJM3T9Lt0mjfHI/+4qmBgwijEbS993rxFooVY2xdVdQrJDCbZhLfSnBNHXfk0C6I5iiquNrt6VuGxf+e+O2VUwTEVfekbblK7dNCv+9lrLK5MuVdxtBOSc13rp1ZV3nPjfOhVHGZCh9tqMAG8VHPq2Lrw3NksqYDybfsyVjK9+xTjbSmh+Rep65Mm4M1/eFlnm0b5DWsr4YK5/U6a3bLmqUMTMrBo3bz1JDO//7OMsHV2x9t48+fBzggB7Dkr2KDGRv7r2ypQmsDczvDcIoq+93/azFMssA+1xzoJb3POtnLPXZdw2SxmEkYaarKhmUZ8nfQ/RBhhErJM8Desgz6ZphVDWDfrK0rB/iCkkD5bnjbi4trR52lFkG22ygnVS0+eDLqiuj94Z9Nh9GWZ/faPhs9fv32qcJI6uBVGdAD3Xg6hBGedKo7ywE09ACqeXAlVQM5KcWDt/prP9nSZmljc4L75XXtyVl/RLyOaWSQ2x/JofaF0vrLwuZkj6/zocS2jsJoGGUDegmlryewkjIoCcnQW9dmb/QLIOy9FC/ie5D9nVmoMzTOmGkE4q5nLwvhFJ2EcRDwGXMH0ZduXKcdejz2YVMl0M6ytHHZPL4k38xhNH/wYRw6jhNmp0z2ic1cp70qmR1MN8xMM213+7aR2jy/fauY5/f1t0HAg0kwqjUhiYZ9MDsw7WBcpdd2r3Pes8+Qrbu0OfNXsAgK5z8Kqfp62gCyXgYjXsKIwIpPKmRfaLbwLz1EUZ6XgqWAslyGKm6l8H2MlPDQY2N7PPQK6a27zGnYRhN6TKGAimCMMp+3r78okkiQCO9mq6qX897nKQRRgQSYbRDnycvVzRJBKCsP96WhVLFZd+xrPbrnjMijDw5yGXfEYWRHG9e6b3pUmOrL6DJxGhSEUrXyf4/jI1lchXNBQyskCIMo75XSTT04GyM7NO3xZ5BOtVt1HIfFhFG1gMp0jBK9OaojwMcqIa4UrCwT9/tW9pil1v/vFi+oWyhrrKNMDqA3g7ZxRpGhVXSlECK2iLxf35gYah9X3T4rHl1796AwFdIAwijbBbpc5XE7Cu8Ol57XtGsrLR//Tnb3PrngZUEPn2FtOf+SLEef81mkT4ueeWS7zDJYwV83Vx1ZrR9jxus8s2tjmQC3XZs4jEyBlZIAwmjbJXk6xDMiuYYbB37CBJzD+rTOxjMGpbRypWi+Z+zy/Oq0op9IoRAKrnfUewnAx88NUQac7gDs5zgv2xZR/KZS2tPUs2VfVUzlGbGnoScrw+5nP0me9heg9XRTfLv32C90Fu6OTlAg476eLLMCF3DXCTlfxxYd2W04bh7+KHk6lnqaFCPMNeyP7qyf3Vf3lRNyiw9ZFIVD7fLg/Xu9VEabSeU3PG7I293bq06h2ThiaCeyi8PNBvveIsMZjIw/dCv15FcGjs4etHOtQZTsc43GkSL2CYZ+njyZcnK6NFwPfq4UbKp0xIhPw/pJIHPGddSByTZvmdfGzuUgXqr/tkAyy0rpU0ulGaW27bUoyvPqR7daHNxkgSRHKa7Y3IJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAjLbwEGABdIk04CWmrYAAAAAElFTkSuQmCC);\n	background-size: 210px 30px;\n}\n\n.leaflet-draw a {\n	display: block;\n	text-align: center;\n	text-decoration: none;\n}\n\n/* ================================================================== */\n/* Toolbar actions menu\n/* ================================================================== */\n\n.leaflet-draw-actions {\n	display: none;\n	list-style: none;\n	margin: 0;\n	padding: 0;\n	position: absolute;\n	left: 26px; /* leaflet-draw-toolbar.left + leaflet-draw-toolbar.width */\n	top: 0;\n	white-space: nowrap;\n}\n\n.leaflet-right .leaflet-draw-actions {\n	right:26px;\n	left:auto;\n}\n\n.leaflet-draw-actions li {\n	display: inline-block;\n}\n\n.leaflet-draw-actions li:first-child a {\n	border-left: none;\n}\n\n.leaflet-draw-actions li:last-child a {\n	-webkit-border-radius: 0 4px 4px 0;\n	        border-radius: 0 4px 4px 0;\n}\n\n.leaflet-right .leaflet-draw-actions li:last-child a {\n	-webkit-border-radius: 0;\n	        border-radius: 0;\n}\n\n.leaflet-right .leaflet-draw-actions li:first-child a {\n	-webkit-border-radius: 4px 0 0 4px;\n	        border-radius: 4px 0 0 4px;\n}\n\n.leaflet-draw-actions a {\n	background-color: #919187;\n	border-left: 1px solid #AAA;\n	color: #FFF;\n	font: 11px/19px "Helvetica Neue", Arial, Helvetica, sans-serif;\n	line-height: 28px;\n	text-decoration: none;\n	padding-left: 10px;\n	padding-right: 10px;\n	height: 28px;\n}\n\n.leaflet-draw-actions-bottom {\n	margin-top: 0;\n}\n\n.leaflet-draw-actions-top {\n	margin-top: 1px;\n}\n\n.leaflet-draw-actions-top a,\n.leaflet-draw-actions-bottom a {\n	height: 27px;\n	line-height: 27px;\n}\n\n.leaflet-draw-actions a:hover {\n	background-color: #A0A098;\n}\n\n.leaflet-draw-actions-top.leaflet-draw-actions-bottom a {\n	height: 26px;\n	line-height: 26px;\n}\n\n/* ================================================================== */\n/* Draw toolbar\n/* ================================================================== */\n\n.leaflet-draw-toolbar .leaflet-draw-draw-polyline {\n	background-position: -2px -2px;\n}\n\n.leaflet-draw-toolbar .leaflet-draw-draw-polygon {\n	background-position: -31px -2px;\n}\n\n.leaflet-draw-toolbar .leaflet-draw-draw-rectangle {\n	background-position: -62px -2px;\n}\n\n.leaflet-draw-toolbar .leaflet-draw-draw-circle {\n	background-position: -92px -2px;\n}\n\n.leaflet-draw-toolbar .leaflet-draw-draw-marker {\n	background-position: -122px -2px;\n}\n\n/* ================================================================== */\n/* Edit toolbar\n/* ================================================================== */\n\n.leaflet-draw-toolbar .leaflet-draw-edit-edit {\n	background-position: -152px -2px;\n}\n\n.leaflet-draw-toolbar .leaflet-draw-edit-remove {\n	background-position: -182px -2px;\n}\n\n/* ================================================================== */\n/* Drawing styles\n/* ================================================================== */\n\n.leaflet-mouse-marker {\n	background-color: #fff;\n	cursor: crosshair;\n}\n\n.leaflet-draw-tooltip {\n	background: rgb(54, 54, 54);\n	background: rgba(0, 0, 0, 0.5);\n	border: 1px solid transparent;\n	-webkit-border-radius: 4px;\n	        border-radius: 4px;\n	color: #fff;\n	font: 12px/18px "Helvetica Neue", Arial, Helvetica, sans-serif;\n	margin-left: 20px;\n	margin-top: -21px;\n	padding: 4px 8px;\n	position: absolute;\n	white-space: nowrap;\n	z-index: 6;\n}\n\n.leaflet-draw-tooltip:before {\n	border-right: 6px solid black;\n	border-right-color: rgba(0, 0, 0, 0.5);\n	border-top: 6px solid transparent;\n	border-bottom: 6px solid transparent;\n	content: "";\n	position: absolute;\n	top: 7px;\n	left: -7px;\n}\n\n.leaflet-error-draw-tooltip {\n	background-color: #F2DEDE;\n	border: 1px solid #E6B6BD;\n	color: #B94A48;\n}\n\n.leaflet-error-draw-tooltip:before {\n	border-right-color: #E6B6BD;\n}\n\n.leaflet-draw-tooltip-single {\n	margin-top: -12px\n}\n\n.leaflet-draw-tooltip-subtext {\n	color: #f8d5e4;\n}\n\n.leaflet-draw-guide-dash {\n	font-size: 1%;\n	opacity: 0.6;\n	position: absolute;\n	width: 5px;\n	height: 5px;\n}\n\n/* ================================================================== */\n/* Edit styles\n/* ================================================================== */\n\n.leaflet-edit-marker-selected {\n	background: rgba(254, 87, 161, 0.1);\n	border: 4px dashed rgba(254, 87, 161, 0.6);\n	-webkit-border-radius: 4px;\n	        border-radius: 4px;\n}\n\n.leaflet-edit-move {\n	cursor: move;\n}\n\n.leaflet-edit-resize {\n	cursor: pointer;\n}\n</style>');
        };


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