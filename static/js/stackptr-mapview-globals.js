var map; 				// leaflet map
var placemarks = {};	// map of placemarks
var webLocation;		// last location from website
var gpsLocation;		// my current location as a L.LatLng()
var watchID;			// id of geolocation watcher

var locData;			// last fetched location data

var autoRefresh = false; // do we auto-update?
var usesGeoLoc = false;

var groupData = {};		// group placemarks
var groupInfo = {};
var drawnItems;			// FeatureGroup of drawn items

var refreshTime;		// seconds left for refresh counter

var uploadInterval;
var downloadInterval;
