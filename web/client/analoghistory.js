Template.analogHistory.value = function() {
	return "Hello world!";
}

Template.analogHistory.rendered = function() {
	console.log("Entering analogHistory.rendered");

	$(this.firstNode).on("pageinit", function(evt) {
	    console.log("analogHistory page init!");
	    Deps.autorun(function() {

	    })

	    var deviceId = "111";
	    var queryStr = '/api/history_data?points=6,7&device_id=' + deviceId + '&callback=?'
	    $.getJSON(queryStr, function (data) {
	        console.log(data);
	        var s1 = data[0];
	        var s2 = data[1];

	    $('#histChart').highcharts({
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
	            name: 'Temperature#1',
	            type:'spline',
	            data: s1
	        },
	        {
	            name: 'Temperature#2',
	            type:'spline',
	            data: s2
	        }]
	    });
	      });
	})
}