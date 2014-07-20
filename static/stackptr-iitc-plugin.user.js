// ==UserScript==
// @id             iitc-plugin-stackptr
// @name           IITC plugin: StackPtr
// @category       Layer
// @version        0.03
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
9

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

// PLUGIN START ////////////////////////////////////////////////////////

window.plugin.stackptr = function() {};

window.plugin.stackptr.settings = function() {
	 
	 if (window.plugin.stackptr.apikey == undefined){
	 	var html = '<b>API Key :</b><input type="text" name="apikey" onchange="window.plugin.stackptr.apikey=this.value;window.plugin.stackptr.configsave()" value=""></br>';
	 	html = html + "<br>Warning: no API key set. Go to <a href='https://stackptr.com/api/' target='new'>https://stackptr.com/api/</a> to generate an API key";
	 } else {
	 		 	var html = '<b>API Key :</b><input type="text" name="apikey" onchange="window.plugin.stackptr.apikey=this.value;window.plugin.stackptr.configsave()" value="' + window.plugin.stackptr.apikey + '\"></br>';
	 }
	 dialog({
	 	html: html,
	 	title: 'StackPtr settings',
	 });

}



window.plugin.stackptr.setup = function() {
	window.plugin.stackptr.layer = new L.FeatureGroup();
	window.plugin.stackptr.placemarks = {};
	window.addLayerGroup('StackPtr', window.plugin.stackptr.layer, true);
	$('#toolbox').append('<a onclick="window.plugin.stackptr.settings();return false;">StackPtr Opts</a>');
	window.plugin.stackptr.configload();
	$.getScript("https://stackptr.com/static/js/stackptr-utils.js", function() {
		$.getScript("https://stackptr.com/static/js/stackptr-map.js", function() {
			setInterval(window.plugin.stackptr.update, 5000);
		});
	});
};

groupData = {}
groupInfo = {}

window.plugin.stackptr.update = function(){
	//fix for placemarker issue - TODO find better way
	L.Icon.Default.imagePath = "https://stackptr.com/static/js/images/"
	window.plugin.stackptr.updateFollowing();
	window.plugin.stackptr.updateGroup();
}
window.plugin.stackptr.updateGroup = function(){
  $.post('https://stackptr.com/groupdata', {'group': "Ingress", "apikey": window.plugin.stackptr.apikey}, function(data){updateDrawnItems(data,window.plugin.stackptr.layer,function(){},function(){},function(){})}, 'json');
}

window.plugin.stackptr.updateHidden = function(pln, status) {
	alert("updateHidden");
};

window.plugin.stackptr.configsave = function() {
	localStorage['plugin-stackptr-apikey'] = window.plugin.stackptr.apikey;
};

window.plugin.stackptr.configload = function() {
	window.plugin.stackptr.apikey = localStorage['plugin-stackptr-apikey'];
	if (window.plugin.stackptr.apikey == undefined){
		window.plugin.stackptr.settings();
	}
};

window.plugin.stackptr.load = function() {
	alert("load");
};

setup = window.plugin.stackptr.setup;


window.plugin.stackptr.updateFollowing = function() {
	$.getJSON('https://stackptr.com/users?apikey=' + window.plugin.stackptr.apikey, function(data) {
		updatePlacemarks(data,window.plugin.stackptr.placemarks, window.plugin.stackptr.layer);
	});
	return true;
};




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