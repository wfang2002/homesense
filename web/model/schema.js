MotionSensorEvents = new Meteor.Collection("motion_sensor_events");

ComfortSensorData = new Meteor.Collection("comfort_sensor_data");

LatestSensorData = new Meteor.Collection("latest_sensor_data");

RemoteDevices = new Meteor.Collection("remote_devices");

DeviceStatusData = new Meteor.Collection("device_status_data");

DeviceRegistration = new Meteor.Collection("device_reg");

// all devices shall have a record here, and the status is one of:
// 'new', 'presold', 'sold', 'restock', 'active', 'obsolete'
DeviceStock = new Meteor.Collection("device_stock");

// A new record add here when user is registering a new device.
// record shall be removed after registration process done.
DevicePendingVerification = new Meteor.Collection("device_pending_verification")

// output value to remote device with binary/analog value points.
Outputs = new Meteor.Collection("outputs");

// keeps the latest value of remote device value points.
Inputs = new Meteor.Collection("inputs");

// History log of all inputs
InputsHistory = new Meteor.Collection("inputs_history");

// Aggregated input history log
// Aggregate types: 5 minutes, 30 minutes, 1 hour
InputsAggregated = new Meteor.Collection("inputs_aggregated");

SysStatus = new Meteor.Collection("system_status");