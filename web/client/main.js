//Meteor.subscribe("motion_sensor_events");
Meteor.subscribe("recentEvents");
Meteor.subscribe("recentComfortData");
Meteor.subscribe("outputs");


Meteor.startup(function(){
    $.mobile.orientationChangeEnabled = false;
});

