var PORT = 8000;
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./database.db');
var express = require('express');
var app = express();
var console = require("better-console");
var sys = require('sys');

var exec = require('child_process').exec;
function puts(error, stdout, stderr) {sys.puts(stdout)};

//Go through log file and seperate lines into log entries.
var spawn = require('child_process').spawn;
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
temp_path = "/Users/vahakn/Documents/log/validations.log";
exec("echo '' | ssh vahakn@10.15.20.166 'cat /dev/null > "+temp_path+"'");

// Get logs from "debug.log".
monitorFile("/home/../var/log/rippled/debug.log");

//Sift through log entries and pick out those which have the validation fingerprint.
// Template: DATE, TIME, "Validations:DBG", "Val", "for", FOR_CODE, "from", FROM_CODE, "added", TRUSTED/NOT
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
                //Master log file's path on main server.
                var log_path = "/Users/vahakn/Documents/log/validations.log";
                //Write to master log file through ssh.
                exec("echo '"+JSON.stringify(val_package)+"' | ssh vahakn@10.15.20.166 'cat >> "+log_path+"'");
                console.log(JSON.stringify(val_package));

        }


}

app.listen(PORT);
console.log("Listening at 127.0.0.1:"+PORT);
