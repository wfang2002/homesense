
var output;

Template.lightdimmer.created = function() {
    console.log("Enter Template.lightdimmer.created");

}

Template.lightdimmer.rendered = function() {

    console.log("Enter Template.lightdimmer.rendered,");

    $(this.firstNode).on("pageinit", function(evt) {
        console.log("light page init!");
        Deps.autorun(function() {
            output = Outputs.findOne({device_id:"111"});

            if (!output) return;

            console.log("output changed: ", output);

            var isManual = false;
            if (output && output.binary_points[0]) isManual = true;

            //if ($("#flip-manual-control").length)
            //$("#flip-manual-control.ui-flipswitch-input").flipswitch("option", "checked", isManual).flipswitch( "refresh" );
            $("#flip-manual-control").prop("checked", isManual ? "checked" : "");
            $("#flip-manual-control").flipswitch( "refresh" );
            _.each(output.analog_points, function(value, index) {
                var selector = "#slider-" + index;
                $(selector).val(value);
                $(selector).slider("refresh");
            })
        })
    })
}

Template.lightdimmer.events({

    'change #flip-manual-control': function(evt, tmpl) {
        var isManual = $(evt.currentTarget).is(":checked");
        console.log("Flip changed to ", isManual);

        Outputs.update({_id:output._id}, {$set:{"binary_points.0":isManual}});

        $(".dimming-slider").slider("option", "disabled", !isManual);
    },

    'change .dimming-slider': function(evt, tmpl) {
        var sValue = $(evt.currentTarget).val();
        var value = parseFloat(sValue);
        console.log("slider changed to ", value);

        var fields = {};
        var pointIdx = $(evt.currentTarget).attr("data-point-index");
        fields["analog_points."+pointIdx] = value;
        Outputs.update({_id:output._id}, {$set:fields});
    }
}) 