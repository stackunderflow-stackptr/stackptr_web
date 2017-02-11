// stackptr-utils.js
// This file is for various utilities that are helpful

function opacityValue(time) {
	var utc = Math.round(new Date().getTime()/1000);
	time = utc - time;
	if (time < 60) {
		return 1.0;
	} else if (time < 1800) {
		return 0.8;
	} else if (time < 7200) {
		return 0.6;
	} else {
		return 0.5;
	}
}

function updateTrackColour(usericon,colour_callback) {
	var img = new Image();
	img.onload = function() {
		var colourThief = new ColorThief();
		var colourPalette = colourThief.getPalette(img,8);
		for (var i=0; i<colourPalette.length; i++) {
			var e = colourPalette[i];
			var lum = e[0] + e[1] + e[2];
			if (lum < (127*3)) {
				colour_callback(rgb2hash(e[0], e[1], e[2]));
				return;
			}
		};
		// otherwise if we didn't find a suitable colour, just return the first...
		colour_callback(rgb2hash(colourPalette[0][0], colourPalette[0][1], colourPalette[0][2]));
		return;
	};
	img.crossOrigin = 'Anonymous';
	img.src = usericon;
}



function rgb2hash(r,g,b) {
	var r = r.toString(16);
	var g = g.toString(16);
	var b = b.toString(16);

	r = r.length < 2 ? "0"+r : r;
	g = g.length < 2 ? "0"+g : g;
	b = b.length < 2 ? "0"+b : b;

	return "#" + r + g + b;

}