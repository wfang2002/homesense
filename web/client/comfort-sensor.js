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
    var s1 = _.map(hourlyData, function(val){return [val.ts, val.temperature || 1];});
    var s2 = _.map(hourlyData, function(val){return [val.ts, val.humidity || 1];});
    
    // x-axis label
    var vertPos = 0;
    var idx = 0;

    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    });

    $('#comfort-chart').highcharts({
        plotOptions: {
                line: {
                    connectNulls: true
                }
            },
        title: {
            text: '',
            x: -20 //center
        },
        subtitle: {
            text: '',
            x: -20
        },  
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats: { // don't display the dummy year
                month: '%e. %b',
                year: '%b'
            },
        },          
        yAxis: [
            {
                title: {text: '°C'}
            },
            {
                title: {text: '%'},
                opposite: true
            }]
        ,
        legend: {
            layout: 'vertical',
            align: 'right',
            verticalAlign: 'top',
            borderWidth: 1,
            floating: true,
            x: -20
        },
        series: [{
            name: 'Temperature',
            type:'spline',
            data: s1
        },
        {
            name: 'Humidity',
            type:'spline',
            data: s2
        }]
    });
}
