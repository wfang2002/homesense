var cmdQueue = [];
var busy = false;

var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort("/dev/ttyAMA0", {
  baudrate: 57600
});


serialPort.on("open", function () {
  console.log('port open');
  serialPort.on('data', function(data) {
    console.log('data received: ' + data);

    if (cmdQueue.length > 0) {
        var cmd = cmdQueue.shift();
        serialPort.write(cmd);
    }
    busy = false;
  });

  setInterval(function(){
	// clear stuck commands to avoid memory overflow
	if (cmdQueue.length > 10)cmdQueue = [];
  }, 60000);

});


function setLevels(levels) {
	console.log("Entering uartdimmer.setLevels()");
    
    if (busy) {
        cmdQueue.push("L " + levels.join(',') + "\n");
        return;
    }
    busy = true;
    serialPort.write("L " + levels.join(',') + "\n", function(err, results) {
        if (err)console.log('err ' + err);
	else console.log("command sent");

        //console.log('results ' + results);
    });
}


exports.setLevels = setLevels;

