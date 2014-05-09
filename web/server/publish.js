Meteor.publish("motion_sensor_events", function() {
    return MotionSensorEvents.find();
});

Meteor.publish("recentEvents", function(count) {
    var limit = count || 5;
    return MotionSensorEvents.find({status:'1'}, {sort:{updated:-1}, limit:limit});
});

Meteor.publish("recentComfortData", function(count) {
    var limit = count || 5;
    return ComfortSensorData.find({}, {sort:{updated:-1}, limit:limit});
});

Meteor.publish("outputs", function() {
    return Outputs.find();
})
