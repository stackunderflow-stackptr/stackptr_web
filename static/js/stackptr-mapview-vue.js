var isMobileUi = L.Browser.mobile;

libstackptr_connect();

function setupVue() {
	app = new Vue({
		el: '#usermenu',
		data: data
	})
}

/// ui hacks

function shiftGroupMenu() {
	var um = $("#usermenu");
	var gm = $("#groupmenu");

	var ump = um.position();
	var umb = ump.top + um.height();
	gm.css("top", umb + 8);
	var umr = $(window).width() - (ump.left + um.width() + 2);
	gm.css("right", umr);

	var wh = $(window).height();
	gm.css("height", wh - umb - 16);
}

$(document).ready(function() {
	if (isMobileUi) {
		$("#usermenu").hide();
		$("#groupmenu").hide();
	} else {
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
	}

	setupVue();
});