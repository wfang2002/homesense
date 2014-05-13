Template.analogHistory.value = function() {
	return "Hello world!";
}

Template.analogHistory.rendered = function() {
	console.log("Entering analogHistory.rendered");

	$(this.firstNode).on("pageinit", function(evt) {
	    console.log("analogHistory page init!");
	    Deps.autorun(function() {
	        output = Outputs.findOne({device_id:"111"});

	        if (!output) return;

	        console.log("analogHistory output changed: ", output);

	        var isManual = false;
	        if (output && output.binary_points[0]) isManual = true;

	        //if ($("#flip-manual-control").length)
	        //$("#flip-manual-control.ui-flipswitch-input").flipswitch("option", "checked", isManual).flipswitch( "refresh" );
	        $("#flip-manual-control2").prop("checked", isManual ? "checked" : "");
	        $("#flip-manual-control2").flipswitch( "refresh" );
	        _.each(output.analog_points, function(value, index) {
	            var selector = "#aslider-" + index;
	            $(selector).val(value);
	            $(selector).slider("refresh");
	        })
	    })
	})
}