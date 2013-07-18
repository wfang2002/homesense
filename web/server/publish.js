Meteor.publish("motion_sensor_events", function() {
    return MotionSensorEvents.find();
});
