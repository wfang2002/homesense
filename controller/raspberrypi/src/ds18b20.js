var sensor = require('ds18x20');

var isLoaded = sensor.isDriverLoaded();
console.log("1-Wire driver loaded: ", isLoaded);

var listOfDeviceIds = sensor.list();

console.log(listOfDeviceIds);


function readAll()
{
    var tempObj = {};
    try {
        tempObj = sensor.getAll();
        console.log(tempObj); 
    } catch (e) {
        console.log("ds18x20 readAll failed: ", e.toString());
    }

    return tempObj;
}

exports.readAll = readAll;