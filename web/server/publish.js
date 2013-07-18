Meteor.publish("motion_sensor_events", function() {
    return MotionSensorEvents.find();
});

Meteor.publish("recentEvents", function(count) {
    var limit = count || 5;
    return MotionSensorEvents.find({status:'1'}, {sort:{updated:-1}, limit:limit});
});
