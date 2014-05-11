//Meteor.subscribe("motion_sensor_events");
Meteor.subscribe("recentEvents");
Meteor.subscribe("recentComfortData");
Meteor.subscribe("outputs");
Meteor.subscribe("inputs");

Meteor.startup(function(){
    $.mobile.orientationChangeEnabled = false;
});

