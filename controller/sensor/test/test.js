var uploader = require("../src/uploader.js");

var imgurl = "http://hellobc.com.cn/sites/default/files/imagecache/meitibaodao/meitibaodao/sonora_20090618-1099_dx30519.jpg";
var dest = "test3.jpg";

uploader.upload(imgurl,dest, function(err, res) {
        if (err) {
            console.log("upload failed: ", err);
            return;
        }

        console.log("Uploaded to : ", res);
    });
