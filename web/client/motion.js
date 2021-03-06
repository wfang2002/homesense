var liveChart  = true;      // if true then each refresh will adjust data end time to current time.
var hourlyChart;    // jqPlot handle
var hourlySerialData = []; //data
var hourlyChartEnd = new Date();

Template.motion.motionEvents = function() {
    return MotionSensorEvents.find({status:'1'}, {sort:{updated:-1}, limit:5});
}

Template.motion.status = function() {
    var event = this;
    if (event.status === '1') {
        return "On"
    } else {
        return 'Off';
    }
}

Template.motion.location = function() {
    var event = this;
    // TODO: get location name from db
    if (event.station_id == '0') {
        return 'Family Room';
    } else {
        return event.station_id;
    }
}

Template.motion.hourlyEvents = function() {

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

Template.motion.created = function() {
    hourlyChart = null;
    $(window).resize(function(evt) {
        showHourlyChart();
    });
}

Template.motion.rendered = function() {

    if (liveChart) {
        hourlyChartEnd = new Date();
    }

    refreshHourlyChart();

    // Force refresh jQuery Mobile elements
    $('#motion-content').trigger('create');
}


Template.motion.events({
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

Template.motion.helpers({
    shortTime: function(time) {
        return shortTime(time);
    }
})

function getHourlyStatAsync(tsStart, tsEnd, callback) {

    console.log("Current hour:", tsEnd.getHours());

    tsStart.setMinutes(0);
    tsStart.setSeconds(0);
    tsEnd.setMinutes(59);
    tsEnd.setSeconds(59);

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
    Meteor.call('getMotionEventsAggregate', tsStart, tsEnd, function(err, events) {
        _.each(events, function(event) {
            console.dir(event);

            var date = event._id;
            var label;
            label = date.format("MMddhh");
            list[label].count = event.count;

        });

        console.dir(list);

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
    var s1 = _.map(hourlyData, function(val){return val.count;});
    // x-axis label
    var ticks = _.map(hourlyData, function(val){
        var date = new Date(val.ts);
        if (date.getHours() == 0) {
            return date.format('M/dd');
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
            {label:'Motion'}
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
                tickOptions: {
                    showGridline: true,
                    formatString: '%d'
                }
            }
        } ,

        axesDefaults: {
            tickOptions: {
                showGridline: false
            }

        }
    };

    //console.dir(s1);

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