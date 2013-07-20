Meteor.startup(function () {

    console.log("Server start.");

    process.env.MAIL_URL = 'smtp://bchgatev.bchydro.bc.ca:25';


    var evt = MotionSensorEvents.findOne();
    if (!evt) {
        // insert dummy data for testing
        var now = new Date();
        var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        for (var i=0; i < 200; i++) {
            var rHour = Math.random()*24;
            var rMinute = Math.random()*60;
            var rSec = Math.random()*60;
            var ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - rHour, rMinute, rSec);
            MotionSensorEvents.insert({station_id:'0', status:'1', updated:ts});
        }
    }

    //sendMessage("wei.fang@bchydro.com", {subject:"server booted", content:"Server Url: " + Meteor.absoluteUrl()})
});

Meteor.methods({
    updateMotionSensorEvent: function(details) {
        console.log("updateMotionSensorEvent called: %j", details);
        if (!details || details.length === 0) {
            return;
        }

        details.updated = new Date();
        MotionSensorEvents.insert(details);
    },

    updateTemperatureSensorData: function(details) {
        console.log("updateTemperatureSensorData called: %j", details);
        if (!details || details.length === 0) {
            return;
        }

        details.updated = new Date();
        details.type = 't'; // type: temperature
        ComfortSensorData.insert(details);
    },
    updateHumiditySensorData: function(details) {
        console.log("updateHumiditySensorData called: %j", details);
        if (!details || details.length === 0) {
            return;
        }

        details.updated = new Date();
        details.type = 'h';     // type: humidity
        ComfortSensorData.insert(details);
    },

    getMotionEvents: function(tsStart, tsEnd) {
        var events = MotionSensorEvents.find({status:"1", updated:{$gte:tsStart, $lt:tsEnd}}, {sort:{updated:-1}}).fetch();
        console.log('Found %s events.', events.length);
        return events;
    }
})