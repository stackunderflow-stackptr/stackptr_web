// ==UserScript==
// @id             iitc-plugin-stackptr
// @name           IITC plugin: StackPtr
// @category       Layer
// @version        0.05
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
if(typeof window.plugin !== 'function') window.plugin = function() {};

// PLUGIN START ////////////////////////////////////////////////////////

window.plugin.stackptr = function() {};

window.plugin.stackptr.settings = function() {
	 
	 if (window.plugin.stackptr.lib.key == undefined){
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
  if(L.Browser.retina) {
		tp = "tiles_r";
  };
  var ocmOpt = {attribution: osmAttribution, maxNativeZoom: 18, maxZoom: 18};
  var ocmStackptr = new L.TileLayer('https://stackptr.com/'+tp+'/{z}/{x}/{y}.png', ocmOpt);
  layerChooser.addBaseLayer(ocmStackptr, "Stackptr Tiles");
};


window.plugin.stackptr.setup = function() {
	window.plugin.stackptr.layer = new L.FeatureGroup();
	window.plugin.stackptr.placemarks = {};
    window.plugin.stackptr.addTileLayer();
	window.addLayerGroup('StackPtr', window.plugin.stackptr.layer, true);
	$.getScript("https://stackptr.com/static/js/stackptr-utils.js", function() {
		$.getScript("https://stackptr.com/static/js/stackptr-map.js", function() {
			setInterval(window.plugin.stackptr.update, 5000);
            window.plugin.stackptr.lib = new StackPtr("https://stackptr.com/",localStorage['plugin-stackptr-apikey'], window.plugin.stackptr.layer)
                window.plugin.stackptr.configload();
				$('#toolbox').append('<a onclick="window.plugin.stackptr.settings();return false;">StackPtr Opts</a>');
            	window.plugin.stackptr.lib.setupAutoRefresh()
		});
	});
};

window.plugin.stackptr.configsave = function() {
	localStorage['plugin-stackptr-apikey'] = window.plugin.stackptr.lib.key;
};
    
window.plugin.stackptr.configload = function() {
	window.plugin.stackptr.lib.key = localStorage['plugin-stackptr-apikey'];
	if (window.plugin.stackptr.lib.key == undefined){
		window.plugin.stackptr.settings();
	}
};


setup = window.plugin.stackptr.setup;
    
// PLUGIN END //////////////////////////////////////////////////////////
setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);