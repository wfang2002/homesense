Template.analogHistory.value = function() {
	return "Hello world!";
}

Template.analogHistory.rendered = function() {
	console.log("Entering analogHistory.rendered");

	$(this.firstNode).on("pageinit", function(evt) {
	    console.log("analogHistory page init!");
	    Deps.autorun(function() {

	    })

	    Highcharts.setOptions({
	        global: {
	            useUTC: false
	        }
	    });

	    var deviceId = "111";
	    var queryStr = '/api/history_data?points=6,7&device_id=' + deviceId + '&callback=?'
	    $.getJSON(queryStr, function (data) {
	        console.log(data);
	        var s1 = data[0];
	        var s2 = data[1];

	    $('#histChart').highcharts('StockChart', {
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
	                title: {
	                	//text: '°C', 
	                	align:'high',
	                	offset: 0,
	                	rotation: 0,
	                	y: 15
	                },
	                min: 22,
	                max: 29
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
	        rangeSelector: {
                buttons: [{
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
        			selected: 0
              },
	        series: [{
	            name: 'Temperature#1',
	            type:'spline',
	            data: s1
	        },
	        {
	            name: 'Temperature#2',
	            type:'spline',
	            data: s2
	        }],
	        tooltip:{
                valueSuffix:'°C'
            }
	    });
	      });
	})
}