//tail -f debut.log | grep -i "text"

var console  = require("better-console"),
    sys      = require('sys'),
    exec     = require('child_process').exec,
    spawn    = require('child_process').spawn,
    master   = require('./config.js').master_config;

// Set path and address of master
var ip = master.ip,
    master_path = master.master_path,
    log_path = "/home/../var/log/rippled/debug.log";

//Go through log file and seperate lines into log entries.
function monitorFile(filename) {
  console.log('Path: ', filename);
  var cmd = spawn("tail", ["-F",filename]);
  cmd.stderr.on("data", function(data){
    console.log('stderr: ' + data);
  });
  cmd.stdout.on("data", function(data){
    var logEntries = (""+data).split("\n");
    for (var i=0; i<logEntries.length; i++) {
      var le = logEntries[i].trim();
      if (le.length) {
        handleLogEntry(le);
      }
    }
  });
}

//Delete everything in master log file for testing
//exec("echo '' | "+ip+" 'cat /dev/null > "+master_path+"'");

//Sift through log entries and pick out those which have the validation fingerprint.
//Template: DATE, TIME, "Validations:DBG", "Val", "for", FOR_CODE, "from", FROM_CODE, "added", TRUSTED/NOT
function handleLogEntry(le) {
  if (le.indexOf("Validations:DBG Val") > 0) {
    leSplit = le.split(" ");
    //Create datetime from date+time
    var ping_datetime = leSplit[0]+" "+leSplit[1];
    //Define JSON object to send to validator server.
    var val_package = {};
    //Populate JSON entry
    val_package.public_key = leSplit[7];
    val_package.trusted = leSplit[9];
    val_package.ping_datetime = ping_datetime;
    val_package.ping_id = 1;
    //Write to master log file through ssh.
    exec("echo '"+JSON.stringify(val_package)+"' | ssh "+ip+" 'cat >> "+master_path+"'");
    console.log(JSON.stringify(val_package));
  }
}

// Get logs from "debug.log".
monitorFile(log_path);
