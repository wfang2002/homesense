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

Outputs = new Meteor.Collection("outputs");