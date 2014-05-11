var cmdQueue = [];
var busy = false;

var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort("/dev/ttyAMA0", {
  baudrate: 57600
});


serialPort.on("open", function () {
  console.log('port open');
  serialPort.on('data', function(data) {
    console.log('UART received: ' + data);

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
   var cmdStr = "L " + levels.join(',') + "\r\n"; 
    if (busy) {
        cmdQueue.push(cmdStr);
        return;
    }
    busy = true;
    serialPort.write(cmdStr, function(err, results) {
        if (err)console.log('err ' + err);
	else console.log("command sent: ", cmdStr);
	busy = false;

        //console.log('results ' + results);
    });
}


exports.setLevels = setLevels;

