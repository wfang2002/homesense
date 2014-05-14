var deviceId = "111";

Template.brightnessHistory.rendered = function() {
	console.log("Entering brightnessHistory.rendered");

	$(this.firstNode).on("pageinit", function(evt) {
	    console.log("brightnessHistory page init!");
	    Deps.autorun(function() {

	    })

	    Highcharts.setOptions({
	        global: {
	            useUTC: false
	        }
	    });

	    var queryStr = '/api/history_data?points=0,1,2,3,4,5&device_id=' + deviceId + '&callback=?'
	    $.getJSON(queryStr, function (data) {
	        console.log(data);
	        var s1 = data[0];
	        var s2 = data[1];

	    $('#lightChart').highcharts('StockChart', {
	    	chart: {
	    	    type: 'area',
	    	    zoomType: 'x'
	        },
	    	plotOptions: {
	            area: {
	                stacking: 'normal',
	                lineColor: '#666666',
	                lineWidth: 1,
	                // marker: {
	                //     lineWidth: 1,
	                //     lineColor: '#666666'
	                // }
	            },
	            areaspline: {
                    fillOpacity: 0.5
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
	                min: 0,
	                max: 600
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
	            name: 'ch#1',
	            //type:'spline',
	            color: '#dddddd',
	            data: data[0]
	        },
	        {
	            name: 'ch#2',
	            //type:'spline',
	            color: '#dddddd',
	            data: data[1]
	        },
	        {
	            name: 'ch#3',
	            //type:'spline',
	            color: '#000080',
	            data: data[2]
	        },
	        {
	            name: 'ch#4',
	            //type:'spline',
	            color: '#dddddd',
	            data: data[3]
	        },
	        {
	            name: 'ch#5',
	            //type:'spline',
	            color: '#dddddd',
	            data: data[4]
	        },
	        {
	            name: 'ch#6',
	            //type:'spline',
	            color: '#000080',
	            data: data[5]
	        }],
	        tooltip:{
                valueSuffix:'%'
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
        chart = $('#lightChart').highcharts('StockChart');
       
    chart.showLoading('Loading data...');
    var queryStr = '/api/history_data?points=0,1,2,3,4,5&device_id=' + deviceId + 
        '&start='+ Math.round(e.min) +
        '&end='+ Math.round(e.max) + 
        '&callback=?';
    $.getJSON(queryStr, function(data) {
        
        chart.series[0].setData(data[0]);
        chart.series[1].setData(data[1]);
        chart.series[2].setData(data[2]);
        chart.series[3].setData(data[3]);
        chart.series[4].setData(data[4]);
        chart.series[5].setData(data[5]);
        chart.hideLoading();
    });
    
}