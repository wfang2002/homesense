//Meteor.subscribe("motion_sensor_events");
Meteor.subscribe("recentEvents");

var liveChart  = true;      // if true then each refresh will adjust data end time to current time.
var hourlyChart;    // jqPlot handle
var hourlySerialData = []; //data
var hourlyChartEnd = new Date();

Meteor.startup(function(){
    $.mobile.orientationChangeEnabled = false;
});

Template.home.motionEvents = function() {
    return MotionSensorEvents.find({status:'1'}, {sort:{updated:-1}, limit:5});
}

Template.home.status = function() {
    var event = this;
    if (event.status === '1') {
        return "On"
    } else {
        return 'Off';
    }
}

Template.home.hourlyEvents = function() {

    var events = MotionSensorEvents.find({status:"1"}, {sort:{updated:-1}, limit:200}).fetch();

    var list = {};
    _.each(events, function(event) {
        var time = event.updated.format("MM-dd, hh:00");
        if (list[time]) {
            list[time].count ++;
        }
        else {
            list[time] = {hour:time, count:1};
        }
        //console.log('list[%s]=%s', time, list[time]);

    });

    return _.first(_.map(list, function(val, key){return val}), 12);

}

Template.home.created = function() {
    hourlyChart = null;
    $(window).resize(function(evt) {
        showHourlyChart();
    });
}

Template.home.rendered = function() {

    if (liveChart) {
        hourlyChartEnd = new Date();
    }

    refreshHourlyChart();

    // Force refresh jQuery Mobile elements
    $('#home-content').trigger('create');
}


Template.home.events({
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

Template.home.helpers({
    shortTime: function(time) {
        return shortTime(time);
    }
})

function getHourlyStatAsync(tsStart, tsEnd, callback) {

    console.log("Current hour:", tsEnd.getHours());
    // Initialize hourly buffer
    var list = {};
    for (var ts = tsStart.getTime(); ts <= tsEnd.getTime();) {

        var label;
        var date = new Date(ts);
        label = date.format("MMddhh");
        list[label] = {count:0, ts:ts};
        ts = ts + 60*60000;
    }

    // Fill in hourly count
    //var events = MotionSensorEvents.find({status:"1", updated:{$gte:tsStart, $lt:tsEnd}}, {sort:{updated:-1}}).fetch();
    Meteor.call('getMotionEvents', tsStart, tsEnd, function(err, events) {
        _.each(events, function(event) {

            var date = event.updated;
            var label;
            label = date.format("MMddhh");
            list[label].count++;

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
    var s1 = _.map(hourlyData, function(val){return [idx++, val.count];});
    // x-axis label
    var ticks = _.map(hourlyData, function(val){
        var date = new Date(val.ts);
        if (date.getHours() == 0) {
            return date.format('MM/dd');
        } else {
            if (date.getHours() % 2 === 0) {
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
            renderer:$.jqplot.BarRenderer,
            rendererOptions: {
                barMargin: 2,
                fillToZero: true
            }
        },
        // Custom labels for the series are specified with the "label"
        // option on the series option.  Here a series option object
        // is specified for each series.
        series:[
            {label:'Event Count'}
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
            // Pad the y axis just a little so bars can get close to, but
            // not touch, the grid boundaries.  1.2 is the default padding.
            yaxis: {
                //pad: 1.05,
                padMin: 0,
                tickOptions: {formatString: '%d'}
            }
        } ,

        axesDefaults: {
            tickOptions: {
                showGridline: false
            }

        }
    };

    // Replot chart if already initialized
    if (hourlyChart) {
        console.log("replot chart");
        options.data = [s1];
        hourlyChart.replot(options);
        return;
    }

    console.log("Initial drawing chart. shall call only once.");
    $('#hourly-chart').empty();
    hourlyChart = $.jqplot('hourly-chart', [s1], options);
}