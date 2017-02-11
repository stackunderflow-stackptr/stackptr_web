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