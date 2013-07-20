var DDPClient = require("ddp");
var Step = require("step");
var request = require("request");
var fs = require('fs');
var Crypto = require("crypto");
var http = require('http-get');
var easyimg = require('easyimage');
var knox = require("knox");
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort;

getHash = function(str) {
    var shasum = Crypto.createHash("sha1");
    shasum.update(str);
    return shasum.digest('hex');
}

var usage = "Arguments: [--host hostname] [--port port_number] [--name controller_name] --comport serial_port";
var argv = require('optimist')
    .usage(usage)
    .default('host', '127.0.0.1')
    .default('port', '3000')
    .default('name', 'MULTISENSE')
    .default('comport', 'COM9')
    .argv;

var meteor_host = argv.host;
var meteor_port = argv.port;

//Controller name in format [EVN:]CLASS[.instance]
var controller_name = argv.name;

// Setup job queue to avoid too many network connection requests
var MAX_JOBS = 5;
var job_count = 0;
var job_queue = [];
var job_int;

var ddp_connected = false;

if (argv.help) {
    console.log(usage);
    process.exit(0);
}

var sp = new SerialPort(argv.comport, {baudrate:38400});

sp.on("open", function(err) {
    console.log('port opened');

    var i = 0;
    setInterval(function() {
        if (++i == 5*60) {  // query temperature/humidity every 5 minute
            i = 0;
            querySHT11();
        } else {
            queryInfraRedSensor();
        }
    }, 1000);
});

var last_status = '0';

sp.on('data', function(data){
    var status = data.toString();
    status = status.replace('\r\n', '');
    var fields = status.split(' ');
    if (fields.length < 2) return;

    var cmd = fields[0];

    if (cmd == 'INP') {
        status = fields[1];
        //console.log('data received:' + data);
        if (status != last_status && ddp_connected) {
            console.log('status changed to: ', status);
            last_status = status;
            ddpclient.call('updateMotionSensorEvent', [{station_id:'0', status:status, updated:new Date()}]);
        }

    } else if (cmd == 'SHT') {
    	console.log("received: %s", status);

        var temperature = parseFloat(fields[1]);
        var humidity = parseFloat(fields[2]);
        
        if (isNaN(temperature) || isNaN(humidity)) {
            querySHT11();   // Retry
            return;
        }
        console.log("Temperature: %s, Humidity: %s", temperature, humidity);
        ddpclient.call('updateTemperatureSensorData', [{station_id:'0', data:temperature, updated:new Date()}]);
        ddpclient.call('updateHumiditySensorData', [{station_id:'0', data:humidity, updated:new Date()}]);
    }


});

sp.on('close', function (err) {
    console.log('port closed');
});

sp.on('error', function (err) {
    console.error("error", err);

    console.log("Valid ports:");
    serialPort.list(function (err, ports) {
        ports.forEach(function(port) {
            console.log(port.comName);
            //console.log(port.pnpId);
            //console.log(port.manufacturer);
        });
    });
});

function querySHT11() {
    sp.write('SHT\r\n');
}

function queryInfraRedSensor() {
    sp.write('INP RD0\r\n', function(err, result) {
        //console.log('write err=', err || 'no error');
        //console.log('result=', result);
    });
}


console.log("Controller %s connecting to meteor server: %s:%s",controller_name, meteor_host, meteor_port);

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

});

// All subscription events
ddpclient.on('message', function(msg) {

    msg = JSON.parse(msg);

    //console.dir(msg);

    // new command?
    if (msg.msg == "added" && msg.collection == "images") {

        var task = msg.fields;
        task._id = msg.id;

        job_queue.push(task);
    }
});

// Server down?
ddpclient.on('socket-close', function(code, message) {
    console.log("Close: %s %s", code, message);
    //clearInterval(job_int);
    ddp_connected = false;
});

// Connection lost?
ddpclient.on('socket-error', function(error) {
    console.log("Error: %j", error);
    //clearInterval(job_int);
    ddp_connected = false;
});

handleTask = function(task) {

    console.log("handle image request: ", task._id);
    //console.dir(task);

    if (!task.raw || !task.raw.url) {

        ddpclient.call('updateImage', [task._id, {status:'failed', update:new Date(), error:"No raw source url"}]);
        return;
    }

    worker(task);

}
