var liveChart  = true;      // if true then each refresh will adjust data end time to current time.
var hourlyChart;    // jqPlot handle
var hourlySerialData = []; //data
var hourlyChartEnd = new Date();

Template.comfortSensor.latestTemperature = function() {

    return ComfortSensorData.find({type:'t'});
}


Template.comfortSensor.location = function() {
    var event = this;
    // TODO: get location name from db
    if (event.station_id == '0') {
        return 'Family Room';
    } else {
        return event.station_id;
    }
}

Template.comfortSensor.created = function() {
    hourlyChart = null;
    $(window).resize(function(evt) {
        showHourlyChart();
    });
}

Template.comfortSensor.rendered = function() {

    if (liveChart) {
        hourlyChartEnd = new Date();
    }

    refreshHourlyChart();

    // Force refresh jQuery Mobile elements
    $('#comfortSensor-content').trigger('create');
}

Template.comfortSensor.helpers({
    shortTime: function(time) {
        return shortTime(time);
    }
})

Template.comfortChart.created = function() {
    hourlyChart = null;
    $(window).resize(function(evt) {
        showHourlyChart();
    });
}

Template.comfortChart.rendered = function() {

    if (liveChart) {
        hourlyChartEnd = new Date();
    }

    refreshHourlyChart();

    // Force refresh jQuery Mobile elements
    $('#comfortSensor-content').trigger('create');
}

Template.comfortChart.events({
    'click #btn-prev':function(evt, tmpl) {
        evt.stopPropagation();
        evt.preventDefault();

        console.log("show prev day chart");
        var now = new Date();
        var next = hourlyChartEnd.getTime() - 24*60*60000;
        if (next > now.getTime()) next = now.getTime;
        liveChart = false;
        hourlyChartEnd = new Date(next);
        refreshHourlyChart();
    },

    'click #btn-next':function(evt, tmpl) {
        evt.stopPropagation();
        evt.preventDefault();

        console.log("show next day chart");
        var now = new Date();
        var next = hourlyChartEnd.getTime() + 24*60*60000;
        if (next > now.getTime()) {
            next = now.getTime();
            liveChart = true;
        }
        hourlyChartEnd = new Date(next);
        refreshHourlyChart();
    }
})

function getHourlyStatAsync(tsStart, tsEnd, callback) {

    console.log("Current hour:", tsEnd.getHours());

    tsStart.setMinutes(0);
    tsStart.setSeconds(0);
    tsStart.setMilliseconds(0);

    var interval = 20; //minutes

    // Initialize hourly buffer
    var list = {};
    for (var ts = tsStart.getTime(); ts <= tsEnd.getTime();) {

        var label;
        var date = new Date(ts);
        label = date.format("MMddhhmm");
        list[label] = {ts:ts, label:label};
        ts = ts + interval*60000;
    }

    // Fill in hourly count
    //var events = MotionSensorEvents.find({status:"1", updated:{$gte:tsStart, $lt:tsEnd}}, {sort:{updated:-1}}).fetch();
    Meteor.call('getComfortData', tsStart, tsEnd, function(err, result) {
        _.each(result, function(val) {

            var date = val.updated;
            var label;
            date.setMinutes(parseInt(date.getMinutes()/interval)*interval);
            label = date.format("MMddhhmm");
            //console.dir(val);


            // integrated new data
            if (val.data && val.data.t)list[label].temperature = val.data.t;
            if (val.data && val.data.h)list[label].humidity = val.data.h;

            // backward compatibility
            if (val.type === 't') {
                //console.log("%s temperature: ",label, val.data);
                list[label].temperature = val.data;
            } else if (val.type === 'h') {
                //console.log("%s Humidity: ",label, val.data);
                list[label].humidity = val.data;
            }

        });

        //console.dir(list);

        if(callback)callback(err, list);
    })
}


function refreshHourlyChart() {
    console.log('refresh hourly chart');
    var tsStart = new Date(hourlyChartEnd.getTime() - 24*60*60000);
    getHourlyStatAsync(tsStart, hourlyChartEnd, function(err, hourlyData) {
        hourlySerialData = hourlyData;
        showHourlyChart();
    })
}


function showHourlyChart() {

    var hourlyData = hourlySerialData;

    var idx = 0;
    // series data
    var s1 = _.map(hourlyData, function(val){return val.temperature;});
    var s2 = _.map(hourlyData, function(val){return val.humidity;});

    //var tsStart = s1[50][0];
    //var vertLinePos = tsStart;
    //console.log('tsStart = %s', tsStart);
//    var vertLinePos = new Date(tsStart);
//    vertLinePos.setDate(vertLinePos.getDate() + 1);
//    vertLinePos.setHours(0);
//    vertLinePos.setMinutes(0);
//    vertLinePos.setMilliseconds(0);

    // x-axis label
    var vertPos = 0;
    var idx = 0;
    var ticks = _.map(hourlyData, function(val){
        idx++;
        var date = new Date(val.ts);
        if (date.getHours() == 0 && date.getMinutes() == 0) {
            vertPos = idx;
            return date.format('M/dd');
        } else {
            if (date.getHours() % 2 === 0 && date.getMinutes() == 0) {
                return date.format('hh');
            } else {
                return "";
            }
        }
    });

    var options = {
        // The "seriesDefaults" option is an options object that will
        // be applied to all series in the chart.
        seriesDefaults:{
            //renderer:$.jqplot.BezierCurveRenderer,
            showMarker:false,
            rendererOptions: {
                smooth: true
            }
        },
        // Custom labels for the series are specified with the "label"
        // option on the series option.  Here a series option object
        // is specified for each series.
        series:[
            {label:'Temperature'},
            {label:'Humidity', yaxis:'y2axis'}

        ],
        // Show the legend and put it outside the grid, but inside the
        // plot container, shrinking the grid to accomodate the legend.
        // A value of "outside" would not shrink the grid and allow
        // the legend to overflow the container.
        legend: {
            show: true,
            placement: 'insideGrid'
        },
        axes: {
            // Use a category axis on the x axis and use our custom ticks.
            xaxis: {
                renderer: $.jqplot.CategoryAxisRenderer,
                ticks: ticks
            },
//            xaxis: {
//                renderer: $.jqplot.DateAxisRenderer,
//                tickOptions:{formatString: '%H'},
//                tickInterval: '2 hours'
//            },
            // Pad the y axis just a little so bars can get close to, but
            // not touch, the grid boundaries.  1.2 is the default padding.
            yaxis: {
                //pad: 1.05,
                padMin: 0,
                tickOptions: {
                    showGridline: true,
                    formatString: '%d°C'
                },
                min:10,
                max:40
            },

            y2axis: {
                padMin: 0,
                min:40,
                max:70,
                tickOptions: {
                    formatString: '%d%%'
                }
            }
        } ,

        axesDefaults: {
            tickOptions: {
                showGridline: false
            }

        },

        canvasOverlay: {
            show: true,
            objects: [
                {dashedVerticalLine: {
                    name: 'dateline',
                    x: vertPos,
                    lineWidth: 1,
                    yOffset: 0,
                    color: 'rgb(133, 120, 24)',
                    shadow: false
                }}
            ]
        }
    };

    //console.dir(s1);

    // Replot chart if already initialized
    if (hourlyChart) {
        console.log("replot chart");
        options.data = [s1, s2];
        hourlyChart.replot(options);
        return;
    }

    console.log("Initial drawing chart. shall call only once.");
    $('#comfort-chart').empty();
    hourlyChart = $.jqplot('comfort-chart', [s1, s2], options);
}
