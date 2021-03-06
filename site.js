/**
 * Delft van boven
 * @author Jan Pieter Waagmeester <jieter@jieter.nl>
 *
 */

/*jshint browser:true, strict:false, globalstrict:false, indent:4, white:true, smarttabs:true*/
/*global L:true,$:true,console:true*/

var dvb = dvb || {};
var geojson;

function highlightFeature(e) {
	var layer = e.target;

	layer.setStyle({
		weight: 4,
		color: '#666',
		dashArray: '',
		fillOpacity: 0.2
	});

	if (!L.Browser.ie && !L.Browser.opera) {
		layer.bringToFront();
	}
}
function resetHighlight(e) {
	layers['wijken'].resetStyle(e.target);
}

dvb.addGeoJSON = function (url, map) {
	var layer = L.geoJson(null, {
		style: function () {
			return {
				fill: true,
				fillColor: '#fff',
				color: '#000',
				weight: 1,
				opacity: 0.8,
				fillOpacity: 0.1
			};
		},
		onEachFeature: function (feature, layer) {
			var center = L.latLngBounds(
				// flip x/y for it is a geojson layer.
				feature.geometry.coordinates[0].map(function (a) {
					return [a[1], a[0]];
				})
			).getCenter();

			layers['wijkNummers'].addLayer(L.marker(center, {
				icon: L.divIcon({
					iconSize: [40, 40],
					html: feature.properties.WK_NAAM.substring(5, 7)
				})
			}));

			layer.on({
				'mouseover': function (e) {
					highlightFeature(e);
					dvb.drawPie(feature);
					map.removeLayer(layers['wijkNummers']);
				},
				'mouseout': function (e) {
					resetHighlight(e);
					if (!map.hasLayer(layers['wijkNummers'])) {
						map.addLayer(layers['wijkNummers']);
					}
					dvb.drawDichtheid(geojson);
				}
			});
		}
	});

	$.getJSON(url).success(function (response) {
		// amend properties with bebouwingsdichtheid.
		$.each(response.features, function (k, v) {
			var props = v.properties;

			response.features[k].properties.bebouwingsdichtheid = (props.bebouwd / props.OPP_TOT);
			response.features[k].properties.deelnemers = isNaN(props.deelnemers) ? 0 : props.deelnemers;
		});

		layer.addData(response);
		dvb.drawDichtheid(response);
		geojson = response;
	});
	return layer;
};

var layers = {};

dvb.makeMap = function () {
	var delftCenter = [52.002, 4.36];
	var map = L.map('map', {
		maxZoom: 17,
		minZoom: 13,
		maxBounds: L.latLngBounds(
			[
				[51.95262362986526, 4.26492691040039],
				[52.05048476578602, 4.461994171142578]
			]).pad(20)
		}
	).setView(delftCenter, 14);

	map.attributionControl
		.addAttribution(' <a href="#" rel="#credits" class="uitleg-trigger">Credits</a>')
		.addAttribution(' <a href="#" rel="#url" class="uitleg-trigger">Permalink</a>');

	var osm = L.tileLayer('http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles courtesy of <a href="http://hot.openstreetmap.org/" target="_blank">Humanitarian OpenStreetMap Team</a>'
	});
	L.control.scale({
		imperial: false
	}).addTo(map);

	// custom layers
	layers['omgeving'] = L.tileLayer('data/omgeving/{z}/{x}/{y}.png').addTo(map);

	layers['wijkNummers'] = L.layerGroup().addTo(map);
	layers['terrein'] = L.tileLayer('data/terrein/{z}/{x}/{y}.png').addTo(map);
	layers['heat'] = L.tileLayer('data/heat_all_all/{z}/{x}/{y}.png', {opacity: 0.6}).addTo(map);
	layers['bebouwing'] = L.tileLayer('data/bebouwing/{z}/{x}/{y}.png').addTo(map);
	layers['plint'] = L.tileLayer('data/plint/{z}/{x}/{y}.png').addTo(map);
	layers['wijken'] = dvb.addGeoJSON('data/wijken/wijken.geojson', map).addTo(map);

	$.each(['terrein', 'heat', 'bebouwing', 'plint'], function (_, name) {
		if (layers[name] && map.hasLayer(layers[name])) {
			map.removeLayer(layers[name]);
		}
	});

	var layerControl = new L.Control.Layers(
		{
			'Bebouwing omgeving': layers['omgeving'],
			'OpenStreetMap': osm
		},
		{
			'Wijknummers': layers['wijkNummers'],
			'Stadsweefsel Delft<br />(terreinen)': layers['terrein'],
			'Delft van Boven<br />Heatmap alle deelnemers': layers['heat'],
			'Stadsweefsel Delft<br />(bebouwing)': layers['bebouwing'],
			'Openbare plint': layers['plint']
		},
		{
			collapsed: false
		}
	).addTo(map);

	return map;
};



// Een grafiek met de dichtheid van elke wijk als bargraph.
dvb.drawDichtheid = function (geojson) {
	var wijk = $('#wijk');
	wijk.find('h2').html('<h2>Wijken van Delft.</h2>');
	var plots = wijk.find('.plots').html('');

	$.each({
		'Huishoudens': { key: 'AANTAL_HH' },
		'Inwoners': { key: 'AANT_INW' },
		'Oppervlakte': { key: 'OPP_TOT' },
		'Bebouwings-_dichtheid': { key: 'bebouwingsdichtheid' }
	}, function (grafieknaam, def) {
		var data = [];

		$.each(geojson.features, function (i, wijk) {
			var props = wijk.properties;
			var postcode = props.WK_NAAM.substring(5, 7);

			data.push([props[def.key], postcode]);
		});


		plots.append(
			'<div class="plotBox">' +
				'<div class="floatL">' +
					'<h2>' + grafieknaam.replace('_', ' ') + '</h2>' +
				'</div>' +
				'<div class="plot ' + grafieknaam + '"></div>' +
			'</div>').find('.' + grafieknaam);
		var el = plots.find('.' + grafieknaam);

		makeBar(el, data);
	});


	function makeBar(el, data) {
		var d1, xaxisLabels = [], i = 0;

		d1 = data.map(function (elt) {
			return {
				label: elt[1],
				data: [[i++, elt[0]]]
			};
		});
		i = 0;
		// example for xaxis option: {ticks: [[1,'One'], [2,'Two'], [3,'Three'], [4,'Four'], [5,'Five']]},
		xaxisLabels = data.map(function (elt) {
			return [i++, elt[1]];
		});

		$.plot(
			el,
			d1,
			{
				legend: {
					show: false
				},
				series: {
					bars: {
						show: true,
						align: 'center',
						dataLabels: true,
						barWidth: 0.8,
						fill: 0.8
					}
				},
				xaxis: {
					ticks: xaxisLabels,
					// min en max om linker en rechter padding ruimte te geven.
					min: -1,
					max: 10
				},
				yaxis: {
					ticks: 4
				},
				grid: {
					show: true,
					backgroundColor: { colors: ["#fff", "#eee"] },
					hoverable: true,
					clickable: true
				}
			}
		);
	}
};

dvb.drawPie = function (feature) {
	var props = feature.properties;

	//props.bb_dichtheid = L.Util.formatNum(props.bebouwd / props.OPP_TOT, 2);

	var wijk = $('#wijk');
	var plots = wijk.find('.plots').html('');

	wijk.find('h2').html(props.WK_NAAM);

	var table = wijk.find('table');
	if (table.length === 0) {
		plots.append('<div class="plotBox"><table class="datatable"></table></div>');
		table = plots.find('table');
	}
	table.html('');


	$.each({
			'Huishoudens': { key: 'AANTAL_HH' },
			'Inwoners': { key: 'AANT_INW' },
			'Oppervlakte': { key: 'OPP_TOT', eenheid: 'Ha' },
		//	'Opp. water': { key: 'OPP_WATER', eenheid: 'Ha' },
			'Opp. bebouwd': { key: 'bebouwd', eenheid: 'Ha' },
			'Bebouwingsdichtheid': { key: 'bebouwingsdichtheid' },
			'Deelnemers (DVB)': { key: 'deelnemers'}
		},
		function (label, value) {
			table.append(
				'<tr><td>' + label + ':</td>' +
				'<td>' + L.Util.formatNum(props[value.key], 2) + '</td>' +
				'<td>' + (value.eenheid ? value.eenheid : '') + '</td>' +
				'<tr>');
		}
	);

	var data = {
		'Geslacht':	[
			{ label: "man",  data: props.AANT_MAN},
			{ label: "vrouw",  data: props.AANT_VROUW}
		],
		'Demografie': [
			{ label: '0-14', data: props.P_00_14_JR},
			{ label: '15-24', data: props.P_15_24_JR},
			{ label: '25-44', data: props.P_25_44_JR},
			{ label: '45-64', data: props.P_45_64_JR},
			{ label: '> 65', data: props.P_65_EO_JR}
		],
		'Huishoudens': [
			{ label: 'eenpersoons', data: props.P_EENP_HH},
			{ label: 'met kinderen', data: props.P_HH_M_K},
			{ label: 'zonder kinderen', data: props.P_HH_Z_K}
		],
		'Allochtonen': [
			{ label: 'Autochtoon', data: (100 - props.P_WEST_AL - props.P_N_W_AL)},
			{ label: 'Westers', data: props.P_WEST_AL},
			{ label: 'Niet-westers', data: props.P_N_W_AL}
		]
	};


	var makePie = function (el, data) {
		if (data[0].data < 0 || data[data.length - 1].data < 0) {
			el.html('Geen data.');
			return;
		}
		return $.plot(el, data,
			{
				series: {
					pie: {
						show: true
					}
				},
				grid: {
					hoverable: true,
					clickable: true
				},
				legend: {
					show: true
				}
			}
		);
	};
	$.each(data, function (k, v) {
		var el = plots.find('.' + k);
		if (el.length === 0) {
			plots.append('<div class="plotBox">' +
				'<div class="floatL">' +
					'<h2>' + k.replace('_', ' ') + '</h2>' +
				'</div>' +
				'<div class="plot ' + k + '"></div></div>').find('.' + k);
			el = plots.find('.' + k);
		}
		makePie(el, v);
	});
};

$(function () {
	var map = dvb.makeMap();

	var uitleg = $('#uitleg');

	$('.uitleg-trigger, #tabs li[rel]').on({
		'click': function () {
			uitleg.fadeIn(400);
			var tab = uitleg.find($(this).attr('rel'));

			if (tab.length === 1) {
				$('#tabs').find('.active').removeClass('active');
				$('#tabs').find('li[rel="' + $(this).attr('rel') + '"]').addClass('active');
				uitleg.find('div.active').hide();
				tab.fadeIn(400).addClass('active');

			}
		}
	});
	uitleg.find('#content div').hide();

	uitleg.find('.close').on({
		click: function (e) {
			e.stopPropagation();
			uitleg.hide(300);
		}
	});
	function resize() {
		if (uitleg.hasClass('presentation')) {
			uitleg.offset({
				top: $(window).innerHeight() - uitleg.outerHeight(),
				left: 0
			});
		}
	}
	uitleg.on('resize', resize);
	$(window).on('resize', resize);

	uitleg.find('.presentation').on({
		click: function () {
			if (!uitleg.hasClass('presentation')) {
				var docElm = document.documentElement;
				if (docElm.requestFullscreen) {
					docElm.requestFullscreen();
				} else if (docElm.mozRequestFullScreen) {
					docElm.mozRequestFullScreen();
				} else if (docElm.webkitRequestFullScreen) {
					docElm.webkitRequestFullScreen();
				}
			}
			uitleg.toggleClass('presentation');

			resize();
		}
	});

	$('#tabs li[rel="#home"]').click();

	$('.uitleg').drags({'handle': 'h1'});

	var toggleLayer = function (layer) {
		if (!layer) {
			return;
		}
		if (map.hasLayer(layer)) {
			map.removeLayer(layer);
		} else {
			map.addLayer(layer);
		}
	};

	$('*[data-layer]').click(function () {
		toggleLayer(layers[$(this).data('layer')]);
	});

	if (window.location.hash == '#presentatie') {
		uitleg.find('.presentation').click();
	}
});
