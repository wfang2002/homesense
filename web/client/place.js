var deviceId = "111"; // hard-coded for now

Template.placeview.lastUpdated = function() {
    var input = Inputs.findOne({device_id: deviceId})

    if (!input) return;

    return shortTime(input.updated); //input.updated.format("yyyy-MM-dd, hh:mm:ss");
}

Template.placeview.placeStatus = function() {
    var input = Inputs.findOne({device_id: deviceId})

    if (!input) return;

    // first 6 analog points are light brightness
    var brightness = (input.analog_points[0] + input.analog_points[1] + input.analog_points[2] +
        input.analog_points[3] + input.analog_points[4] + input.analog_points[5]) / 6;

    var result = [];
    result.push({label: "Temperature#1", icon: "/icons/temperature-64.png", value: input.analog_points[6] + "°C"});
    result.push({label: "Temperature#2", icon: "/icons/temperature-64.png", value: input.analog_points[7] + "°C"});
    result.push({label: "LED", icon: "/icons/brightness-32.png", value: parseInt(brightness) + "%"});

    console.log("placeStatus=", result);

    return result;
}

Template.placeview.rendered = function() {
    console.log("Entering placeview.rendered");

        Deps.autorun(function() {
            var input = Inputs.findOne({device_id: deviceId})

            if (!input) return;

            console.log("input changed: ", input);

            $("#place-status-list").listview("refresh");
            $(".ui-slider-input").slider("refresh");
    })
}