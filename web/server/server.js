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

    aggregateInputs("111");

});


function aggregateRec(dataSet, rec) {
    _.each(rec.binary_points, function(val, idx) {
        dataSet.binary_points = dataSet.binary_points || [];
        dataSet.binary_points[idx] = (dataSet.binary_points[idx] || 0) + 1;
    })

    _.each(rec.analog_points, function(val, idx) {
        dataSet.analog_points = dataSet.analog_points || [];
        dataSet.analog_points[idx] = dataSet.analog_points[idx] || {sum:0, count:0, avg:0};
        dataSet.analog_points[idx].sum += val;
        dataSet.analog_points[idx].count++;
        dataSet.analog_points[idx].avg = dataSet.analog_points[idx].sum / dataSet.analog_points[idx].count;
    })
}

function aggregateInputs(deviceId) {
    var aggStatus = SysStatus.findOne({device_id: deviceId});


    var filter = {device_id: deviceId};
    if (!aggStatus)aggStatus = {device_id: deviceId};
    else filter.created = {$gt:aggStatus.lastTs};

    aggStatus.lastTs = new Date();

    var inputs = InputsHistory.find(filter, {sort:{created:1}}).fetch();

    var aggHours = {};  // store hourly aggregate result
    var aggMinute5 = {};    // store 5-minute aggregate result

    _.each(inputs, function(rec) {
        var hourTs = new Date(rec.created.getFullYear(), rec.created.getMonth(), rec.created.getDate(), rec.created.getHours()).getTime();
        var minute5Ts = hourTs + parseInt(rec.created.getMinutes()/5)*5*60000;

        console.log("HourTs=%s, minute5Ts=%s", new Date(hourTs), new Date(minute5Ts));

        // aggregate hourly data
        if (!aggHours[hourTs]) {
            aggHours[hourTs] = InputsAggregated.findOne({device_id:deviceId, type:"60", ts:hourTs}) || {device_id:deviceId, type:"60", ts:hourTs};
        }

        aggregateRec(aggHours[hourTs], rec);


        if (!aggMinute5[minute5Ts]) {
            aggMinute5[minute5Ts] = InputsAggregated.findOne({device_id:deviceId, type:"5", ts:hourTs}) || {device_id:deviceId, type:"5", ts:hourTs};            
        }

        aggregateRec(aggMinute5[minute5Ts], rec);

    })

    //Insert/Update aggregated data
    _.each(aggHours, function(fields) {
        if (fields._id) {
            var id = fields._id;
            delete fields._id;
            InputsAggregated.update({_id:id}, {$set:fields});
        } else {
            InputsAggregated.insert(fields);
        }
    })

    _.each(aggMinute5, function(fields) {
        if (fields._id) {
            var id = fields._id;
            delete fields._id;
            InputsAggregated.update({_id:id}, {$set:fields});
        } else {
            InputsAggregated.insert(fields);
        }
    })

    if (aggStatus._id) {
        var id = aggStatus._id;
        delete aggStatus._id;
        SysStatus.update({_id:id}, {$set:aggStatus});
    } else {
        SysStatus.insert(aggStatus);
    }
}

Meteor.methods({
    unsolicitedResponse: function(details) {
        var ip = headers.methodClientIP(this, 1);
        console.log("Client ip:  ", ip);
        //console.log("Inputs: ", details);
        details.ip = ip;
        var fields = details;
        fields.updated = new Date();
        var input = Inputs.findOne({device_id: details.device_id});        
        if (input) {        
            _.each(details.binary_points, function(pt, idx) {
                if (input.binary_points && input.binary_points.length > idx && pt != input.binary_points[idx]) {
                    lastChanges = details.lastChanges || {};
                    lastChanges.binary_points = lastChanges.binary_points || [];
                    lastChanges.binary_points[idx] = {ts: new Date(), value:pt};
                    details.lastChanges = lastChanges;
                }
            })
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