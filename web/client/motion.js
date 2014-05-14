var deviceId = "111";

Template.motionHistory.rendered = function() {
    console.log("Entering motionHistory.rendered");

    $(this.firstNode).on("pageinit", function(evt) {
        console.log("motionHistory page init!");
        Deps.autorun(function() {

        })

        Highcharts.setOptions({
            global: {
                useUTC: false
            }
        });

        var queryStr = '/api/history_data?binary_points=0&device_id=' + deviceId + '&callback=?';
        $.getJSON(queryStr, function (data) {
            console.log(data);
            var s1 = data[0];

            $('#motion-chart').highcharts('StockChart', {
                chart : {
                    zoomType: 'x'
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
                    events : {
                        afterSetExtremes : afterSetExtremes
                    },
                    minRange: 3600 * 1000 // one hour
                },          
                yAxis: [
                    {
                        title: {
                            //text: '°C', 
                            align:'high',
                            offset: 0,
                            rotation: 0,
                            y: 15
                        },
                        // min: 22,
                        // max: 29
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
                navigator : {
                    adaptToUpdatedData: false,
                    series : {
                        data : s1
                    }
                },
                scrollbar: {
                    liveRedraw: false   // avoid redraw while dragging navigator
                },
                rangeSelector: {
                    buttons: [{
                            count: 1,
                            type: 'hour',
                            text: '1h'
                        },{
                            count: 1,
                            type: 'day',
                            text: '1D'
                        }, {
                            count: 1,
                            type: 'week',
                            text: '1W'
                        }, {
                            type: 'all',
                            text: 'All'
                        }],
                        inputEnabled: false,
                        selected: 1
                  },
                series: [{
                    name: 'Count',
                    type:'column',
                    data: s1
                }],
                tooltip:{
                    valueSuffix:''
                }
            });

        });
    })
}

/**
 * Load new data depending on the selected min and max
 */
function afterSetExtremes(e) {

    var currentExtremes = this.getExtremes(),
        range = e.max - e.min,
        chart = $('#motion-chart').highcharts('StockChart');

        console.log("afterSetExtremes: ", e);
        
    var queryStr = '/api/history_data?binary_points=0&device_id=' + deviceId + 
        '&start='+ Math.round(e.min) +
        '&end='+ Math.round(e.max) + 
        '&callback=?';
    $.getJSON(queryStr, function(data) {
        
        chart.series[0].setData(data[0]);
        chart.hideLoading();
    });
    
}