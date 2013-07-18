Meteor.methods({
    updateMotionSensorEvent: function(details) {
        console.log("updateMotionSensorEvent called: %j", details);
        if (!details || details.length === 0) {
            return;
        }

        details.updated = new Date();
        MotionSensorEvents.insert(details);
    }
})