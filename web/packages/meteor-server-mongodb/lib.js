if(typeof(Npm) != "undefined") {
    MongoDB = Npm.require("mongodb");
}
else
{
    console.log("Please upgrade meteor to 0.6.0")
    MongoDB = __meteor_bootstrap__.require("mongodb");
}