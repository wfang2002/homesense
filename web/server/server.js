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

    var val = ComfortSensorData.findOne();
    if (!val) {
        // insert dummy data for testing
        var now = new Date();
        var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        for (var i=0; i < 200; i++) {
            var rHour = Math.random()*24;
            var rMinute = Math.random()*60;
            var rSec = Math.random()*60;
            var ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - rHour, rMinute, rSec);
            var tmp = 20.0 + Math.random()*15.0;
            var hum = 40.0 + Math.random()*30.0;
            ComfortSensorData.insert({station_id:'0', data:{t:tmp, h:hum}, updated:ts});
        }
    }

    var outputs = Outputs.findOne();
    if (!outputs) {
        Outputs.insert({device_id:"111", binary_points:[false], analog_points:[30, 30, 30, 30, 30, 30]});
    }

    MotionSensorEvents._ensureIndex({status:1, updated:1});
    ComfortSensorData._ensureIndex({updated:1});

    aggregateEnabler();

});

Meteor.methods({
    unsolicitedResponse: function(details) {
        var ip = headers.methodClientIP(this);
        console.log("Client ip:  ", ip);
        //console.log("Inputs: ", details);

        var fields = details;
        fields.updated = new Date();
        var input = Inputs.findOne({device_id: details.device_id});        
        if (input) {        
            Inputs.update({_id: input._id}, {$set:fields});
        } else {
            fields.created = fields.updated;
            Inputs.insert(fields);
        }

        fields.created = fields.updated;
        delete fields.octet_points; // don't need image in history yet.
        InputsHistory.insert(fields);

    },
    
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

    updateComfortSensorData: function(details) {
        console.log("updateComfortSensorData called: %j", details);
        if (!details || details.length === 0) {
            return;
        }

        details.updated = new Date();
        ComfortSensorData.insert(details);
    },

    getMotionEvents: function(tsStart, tsEnd) {
        var events = MotionSensorEvents.find({status:"1", updated:{$gte:tsStart, $lt:tsEnd}}, {sort:{updated:-1}}).fetch();
        console.log('Found %s events.', events.length);
        return events;
    },

    getComfortData: function(tsStart, tsEnd, type) {

        var condition = {updated:{$gte:tsStart, $lt:tsEnd}};
        if (type) condition.type = type;
        var events = ComfortSensorData.find(condition, {sort:{updated:-1}}).fetch();
        console.log('Found %s comfort data.', events.length);
        return events;
    },

    getMotionEventsAggregate: function(tsStart, tsEnd, granularity) {
        granularity = granularity || "hour";

        var minutes = 10;

        var match = {$match:{status:"1", updated:{$gte:tsStart, $lt:tsEnd}}};
        var proj1 =  {"$project" : {
            "_id" : 0,
            "updated" : 1,
            "station_id" : 1,
            "h" : {
                "$hour" : "$updated"
            },
            "m" : {
                "$minute" : "$updated"
            },
            "fmin" : {
                "$mod" : [
                    {
                        "$minute" : "$updated"
                    },
                    minutes
                ]
            },
            "s" : {
                "$second" : "$updated"
            },
            "ml" : {
                "$millisecond" : "$updated"
            }
        }};

        var projDay={"$project" : {
            "_id" : 0,
            "station_id" : 1,
            "updated" : {
                "$subtract" : [
                    "$updated",
                    {
                        "$add" : [
                            "$ml",
                            {"$multiply" : ["$s",1000]},
                            {"$multiply" : ["$m",60,1000]},
                            {"$multiply" : ["$h",60,60,1000]}
                        ]
                    }
                ]
            }
        }};

        var projHour={"$project" : {
            "_id" : 0,
            "station_id" : 1,
            "updated" : {
                "$subtract" : [
                    "$updated",
                    {
                        "$add" : [
                            "$ml",
                            {"$multiply" : ["$s",1000]},
                            {"$multiply" : ["$m",60,1000]}
                        ]
                    }
                ]
            }
        }};

        var projMinute={"$project" : {
            "_id" : 0,
            "station_id" : 1,
            "updated" : {"$subtract" : ["$updated", {"$add" : ["$ml",{"$multiply" : ["$s",1000]}]}]}
        }};

        var projxMinute={"$project" : {
            "_id" : 0,
            "station_id" : 1,
            "updated" : {"$subtract" : ["$updated", {"$add" : [
                "$ml",
                {"$multiply" : ["$s",1000]},
                {"$multiply" : ["$fmin",60,1000]}
            ]}]}
        }};

        var group = {$group:{_id: "$updated", count:{$sum:1}}};

        var sort = {$sort: {_id:1}};

        var events = MotionSensorEvents.aggregate([match, proj1, granularity == 'minute' ? projxMinute : projHour, group, sort]);

        console.dir(events);
        //var events = MotionSensorEvents.find({status:"1", updated:{$gte:tsStart, $lt:tsEnd}}, {sort:{updated:-1}}).fetch();
        //console.log('Found %s events.', events.length);
        return events;
    }
})