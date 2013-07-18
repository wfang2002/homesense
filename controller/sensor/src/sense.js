
var serialPort = require("serialport");
var SerialPort = serialPort.SerialPort;

var sp = new SerialPort("COM9", {baudrate:38400});

sp.on("open", function(err) {
	console.log('port opened');
	
	//sp.write('INP RD0\r\n', function(err, result) {
	//	console.log('write err=', err || 'no error');
	//	console.log('result=', result);
	//});
	setInterval(queryInfraRedSensor, 3000);
});

	sp.on('data', function(data){
		console.log('data received:' + data);
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
	
function queryInfraRedSensor() {
		sp.write('INP RD0\r\n', function(err, result) {
		console.log('write err=', err || 'no error');
		//console.log('result=', result);
	});	
}
	
