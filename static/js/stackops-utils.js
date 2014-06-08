function distanceFormat(distance) {
	if (distance > 1000) {
		return (distance/1000).toFixed(2) + ' km';
	} else {
		return distance.toFixed(0) + ' m'
	}
}
function compassBox(heading) {
	if (heading < 22.5) {
		return "N";
	} else if (heading < 67.5) {
		return "NE";
	} else if (heading < 112.5) {
		return "E";
	} else if (heading < 157.5) {
		return "SE";
	} else if (heading < 202.5) {
		return "S";
	} else if (heading < 247.5) {
		return "SW";
	} else if (heading < 292.5) {
		return "W";
	} else if (heading < 337.5) {
		return "NW";
	} else {
		return "N";
	}
}
function headingFormat(heading) {
	if (heading < 0) {
		heading = 360 + heading;
	}
	return heading.toFixed(0) + ' ' + compassBox(heading);
}

function timeFormat(time) {
	if (time == -1) {
		return 'no upd';
	} else if (time < 60) {
		return time + 's ago'
	} else if (time < 3600) {
		return (time/60).toFixed(0) + 'm ago';
	} else if (time < 28800) {
		return (time/3600).toFixed(0) + 'h' + ((time % 3600)/60).toFixed(0) + 'm ago';
	} else {
		return (time/86400).toFixed(0) + 'd ago';
	}
}

function opacityValue(time) {
	if (time == -1) {
		return 0.4;
	} else if (time < 60) {
		return 1.0;
	} else if (time < 1800) {
		return 0.8;
	} else if (time < 7200) {
		return 0.6;
	} else {
		return 0.5;
	}
}