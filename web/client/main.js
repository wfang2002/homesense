Meteor.subscribe("motion_sensor_events");


Template.home.motionEvents = function() {
    return MotionSensorEvents.find({status:'1'}, {sort:{updated:-1}, limit:5});
}

Template.home.status = function() {
    var event = this;
    if (event.status === '1') {
        return "On"
    } else {
        return 'Off';
    }
}

Template.home.hourlyEvents = function() {

    var events = MotionSensorEvents.find({status:"1"}, {sort:{updated:-1}, limit:200}).fetch();

    var list = {};
    _.each(events, function(event) {
        var time = event.updated.format("MM-dd, hh:00");
        if (list[time]) {
            list[time].count ++;
        }
        else {
            list[time] = {hour:time, count:1};
        }
        console.log('list[%s]=%s', time, list[time]);

    });

    return _.map(list, function(val, key){return val});

}

Template.home.helpers({
    shortTime: function(time) {
        return shortTime(time);
    }
})