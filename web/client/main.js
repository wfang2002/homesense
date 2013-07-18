Meteor.subscribe("motion_sensor_events");

var hourlyChart;
var hourlySerialData = [1];
var hourlyLabel = ["0"];
var hourlyChartEnd = new Date();

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
    $(window).resize(function(evt) {
        showHourlyChart();
    });
}

Template.home.rendered = function() {
//    if (!hourlyChart) {
//        createHourlyChart();
//    } else {
//        refreshHourlyChart();
//    }
    showHourlyChart();

    // Force refresh jQuery Mobile elements
    $('#home-content').trigger('create');
}


Template.home.events({
    'click #btn-prev':function(evt, tmpl) {
        evt.stopPropagation();
        evt.preventDefault();

        var now = new Date();
        var next = hourlyChartEnd.getTime() - 24*60*60000;
        if (next > now.getTime()) next = now.getTime;
        hourlyChartEnd = new Date(next);
        showHourlyChart();
    },

    'click #btn-next':function(evt, tmpl) {
        evt.stopPropagation();
        evt.preventDefault();

        var now = new Date();
        var next = hourlyChartEnd.getTime() + 24*60*60000;
        if (next > now.getTime()) next = now.getTime();
        hourlyChartEnd = new Date(next);
        showHourlyChart();
    }
})

Template.home.helpers({
    shortTime: function(time) {
        return shortTime(time);
    }
})

function getHourlyStat(tsStart, tsEnd) {

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
    var events = MotionSensorEvents.find({status:"1", updated:{$gte:tsStart, $lt:tsEnd}}, {sort:{updated:-1}}).fetch();
    _.each(events, function(event) {

        var date = event.updated;
        var label;
        label = date.format("MMddhh");
        list[label].count++;

    });

    console.dir(list);

    return list;
}

function createHourlyChart() {
    console.log('create hourly chart');
    hourlyChart = $.jqplot('hourly-chart', [hourlySerialData], {
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
                ticks: hourlyLabel
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
    });

}

function refreshHourlyChart() {
    console.log('refresh hourly chart');
    var now = new Date();
    var yesterDay = new Date(now.getTime() - 24*60*60000);
    var hourlyData = getHourlyStat(yesterDay, now);

    hourlySerialData = _.map(hourlyData, function(val){return val.count;});
    hourlyLabel = _.map(hourlyData, function(val){
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

    hourlyChart.series[0].data = hourlySerialData;
    hourlyChart.replot();
}


function showHourlyChart() {

    var tsStart = new Date(hourlyChartEnd.getTime() - 24*60*60000);
    var hourlyData = getHourlyStat(tsStart, hourlyChartEnd);

    var s1 = _.map(hourlyData, function(val){return val.count;});
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

//    if (hourlyChart) {
//        hourlyChart.replot();
//        return;
//    }
    $('#hourly-chart').empty();


    hourlyChart = $.jqplot('hourly-chart', [s1], {
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
    });
}