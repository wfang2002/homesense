var DDPClient = require("ddp");
var Step = require("step");
var request = require("request");
var fs = require('fs');
var Crypto = require("crypto");
var http = require('http-get');
var easyimg = require('easyimage');
var uartDimmer = require('./uartdimmer.js');
var tempSensors = require('./ds18b20.js')
var execSync = require('exec-sync'); 

var _ = require('underscore');

var workInt;
var deviceId = "111";

// local device settings
var settings = {
    isManual: false,
    brightness: []
};

var dimSchedule = [
{hour: 0, brightness:[ 0,  0, 5, 0, 0, 5]},
{hour: 5, brightness:[ 5,  0, 10, 0, 0, 10]},
{hour: 6, brightness:[ 5,  5, 20, 0, 0, 20]},
{hour: 7, brightness:[ 5,  5, 20, 5, 5, 20]},
{hour: 8, brightness:[50, 50, 50, 50, 50, 50]},
{hour: 9, brightness:[80, 80, 80, 80, 80, 80]},
{hour:17, brightness:[60 ,60, 60, 60, 60, 60]},
{hour:20, brightness:[30 ,30, 30, 30, 30, 30]},
{hour:21, brightness:[10 ,10, 20, 10, 10, 20]},
{hour:23, brightness:[ 0 , 0, 5, 0, 0, 5]}
];

var tempIds = [ '28-000002391385', '28-00000248a63f' ];

getHash = function(str) {
    var shasum = Crypto.createHash("sha1");
    shasum.update(str);
    return shasum.digest('hex');
}

var usage = "Arguments: [--host hostname] [--port port_number]";
var argv = require('optimist')
    .usage(usage)
    .default('host', '127.0.0.1')
    .default('port', '3000')
    .argv;

var meteor_host = argv.host;
var meteor_port = argv.port;

var ddp_connected = false;

if (argv.help) {
    console.log(usage);
    process.exit(0);
}

console.log("connecting to meteor server: %s:%s", meteor_host, meteor_port);

var ddpclient = new DDPClient({
    host: meteor_host,
    port: meteor_port,
    /* optional: */
    auto_reconnect: true,	// reconnect if server down
    auto_reconnect_timer: 5000	
});


// Server connect event handler
ddpclient.connect(function(error) {
    if (error) {
        console.log('DDP connection error!');
        return;
    }

    console.log('connected @ ', new Date().toString());

    ddp_connected = true;	

    ddpclient.subscribe('outputs');

    // wake worker every one minute
    if (workInt)clearInterval(workInt);
    workInt = setInterval(function() {
        doWork();
    }, 60000);

	doWork();
});

// All subscription events
ddpclient.on('message', function(msg) {

    msg = JSON.parse(msg);

    //console.log("on message: ");
    //console.dir(msg);

    if (msg.collection == "outputs") {

        handleOutputChanges(msg);
    }
});

// Server down?
ddpclient.on('socket-close', function(code, message) {
    console.log("Close: %s %s", code, message);
    //clearInterval(workInt);
    ddp_connected = false;
});

// Connection lost?
ddpclient.on('socket-error', function(error) {
    console.log("Error: %s", error.toString());
    //clearInterval(workInt);
    ddp_connected = false;
});

function dimLed(levels){
    console.log("Dimming LED: ", levels);
    uartDimmer.setLevels(levels);
}


function handleOutputChanges(msg) {
    if (msg.msg == "added" || msg.msg == "changed") {
        var fields = msg.fields;
        if (fields.binary_points) { // mode changed
            settings.isManual = !!fields.binary_points[0];
        } 

        if (fields.analog_points) {
            settings.brightness = fields.analog_points;
        }

        if (settings.isManual) {
            dimLed(settings.brightness);
        } else {
            autoDimLed();
        }
    }
}

function autoDimLed(){

    var now = new Date();
    var brightness = [];
    var hours = now.getHours();
    var ready = false;

    // hardcoded lighting schedule
    for(var idx = dimSchedule.length -1; idx >= 0; idx--) {
        var schedule = dimSchedule[idx];
        if (hours >= schedule.hour && !ready) {
           
            var nextIdx = idx + 1;
            if (nextIdx >= dimSchedule.length) nextIdx = 0;
            var nextSchedule = dimSchedule[nextIdx];
            var minutes = now.getMinutes() + (hours - schedule.hour) * 60;
            var totalMinutes = ((nextSchedule.hour + 24 - schedule.hour) % 24) * 60;

            for (var brIdx = 0; brIdx < schedule.brightness.length; brIdx++) {
                var curBrightness = parseInt(schedule.brightness + (nextSchedule.brightness[brIdx] - schedule.brightness[brIdx]) * minutes / totalMinutes);
                brightness[brIdx] = curBrightness;
            }
	    ready = true;
        }
    }

    console.log("autoDmLed: hours=%s, levels=%s", hours, brightness);

    if (brightness.join(',') != settings.brightness.join(',')) {
        // changed
        settings.brightness = brightness;
        dimLed(brightness);
    }
}

function doWork() {
    
    if (!settings.isManual || !ddp_connected) { // force to auto mode if server not reachable
        
        autoDimLed();
    }

    var temps = tempSensors.readAll();
    var values = settings.brightness;
    values = values.concat(_.values(temps));
    var response = {device_id: deviceId, analog_points:values};
    console.log("values=", values);

    var imgTmpFile = '/home/pi/homesene_cap.jpg';
    var resp = execSync('raspistill -t 1 -w 300 -h 200 -rot 180 -o ' + imgTmpFile);
    var img = readPic(imgTmpFile);
    response.octet_points = [img];

    if (ddp_connected)ddpclient.call("unsolicitedResponse", [response], function(err, result){}); 
}

function readPic(picFile) {
 var fs = require('fs');
 var path = require('path');

 var data = fs.readFileSync(picFile);
 var tp = data.toString('base64');
 return 'data:image/jpeg;base64,' + tp;
}



