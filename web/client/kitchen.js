Template.kitchen.knobs = function() {
	var knoblist = [
	{
		idx: 0,
		knobImg:"knob-on.png",
		name:"Knob #0",
		status:"On for 10 minutes"
	},
	{
		idx: 1,
		knobImg:"knob-off.png",
		name:"Knob #1",
		status:"Off"
	},
	];

	return knoblist;
}

Template.kitchen.rendered = function() {

    console.log("Enter Template.kitchen.rendered,");

    $(this.firstNode).on("pageinit", function(evt) {
        console.log("kitchen page init!");
        Deps.autorun(function() {
            output = Outputs.findOne({device_id:"222"});

            if (!output || !output.binary_points) return;

            console.log("output changed: ", output);

            // output: 
            // binary_points[0]: current state of knob[0]. 0 = off, 1 = on
            // analog_points[0]: current position of knob[0]
            // analog_points[1]: elapse time (sec) of current state (on or off)

            var totalKnobs = output.binary_points.length;

            for (var idx = 0; idx < totalKnobs; idx++) {
            	var state = output.binary_points[idx];
            	var angle = output.analog_points[idx*2];
            	var elapse = output.analog_points[idx*2 + 1];

            	var name = "Knob #" + idx;
            	var subtitle = "Off";           
            	var imgSelector = "#knob-img-" + idx;
            	var imgFilename = "knob-off.png"
            	;
            	if (state) {
            		subtitle = "On for " + elapse + " minutes";
					imgFilename = "knob-on.png";
            	}

            	console.log("Updating img element: ", imgSelector);
            	$(imgSelector).attr("src", "/images/" + imgFilename);
            	$(imgSelector).rotate(angle);
            	$(imgSelector).parent().find(".subtitle").text(subtitle);
            }

            //if ($("#flip-manual-control").length)
            //$("#flip-manual-control.ui-flipswitch-input").flipswitch("option", "checked", isManual).flipswitch( "refresh" );
            //$("#flip-manual-control").prop("checked", isManual ? "checked" : "");
            //$("#flip-manual-control").flipswitch( "refresh" );
        })
    })
}