var PORT = 8000;
var http = require('http');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./database.db');
var express = require('express');
var app = express();
var console = require("better-console");

//Time after which downtime begins to be counted.
var negligable_time = 5;

//Restarting database in to account for script not running
db.run("DROP TABLE IF EXISTS connections;");

//Create table if it doesn't exist yet.
db.serialize(function() {
	db.run("CREATE TABLE IF NOT EXISTS connections ("+[
		"id INTEGER PRIMARY KEY AUTOINCREMENT",
		"validator_pk TEXT",
		"first_ping DATETIME",
		"last_ping DATETIME",
		"downtime INTEGER",
		"trusted TEXT" //Any other things to add?
	].join(",")+");");
});

//Go through file and seperate lines into log entries.
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

// Get logs from "debug.log".
monitorFile("/home/../var/log/rippled/debug.log");

//Sift through log entries and pick out those which have the validation fingerprint.
// Template: DATE, TIME, "Validations:DBG", "Val", "for", FOR_CODE, "from", FROM_CODE, "added", TRUSTED/NOT
function handleLogEntry(le) {
	if (le.indexOf("Validations:DBG Val") > 0) {
		leSplit = le.split(" ");
		var date = leSplit[0];
		var time = leSplit[1];
		var ledger_key = leSplit[5];
		var public_key = leSplit[7];
		var trusted = leSplit[9];
		var datetime = date+" "+time;
		var total_dt = 0, seconds_between_dates = 0, lifetime = 0, health = 0;

		//Check whether public key exists in table.
		db.get("SELECT * FROM connections WHERE validator_pk ='"+public_key+"';", function(err, row){
			//If it does not exist:
			if (row == undefined){
				//Initiate pk entry. Set first_ping and last_ping to datetime and downtime to 0.
				insert_new_pk(public_key, datetime, trusted);
			}
			else{
				//If it exists:
				//Calculate time btween last ping and current ping.
				seconds_between_dates = time_diff(row.last_ping, datetime);
				//If time between last ping and current ping is greater than the negligable time:
				if (seconds_between_dates > negligable_time){
					//Add downtime to total.
					total_dt = row.downtime + seconds_between_dates - negligable_time;
					//Update total in db.
					update_downtime(datetime, total_dt, row.id);
				}
				//If it is negligable:
				else{	
					//Update last ping
					update_last_ping(datetime,row.id);
				}		
			}
		});

		//Print all
		console.clear();
		console.log("Threshold:", negligable_time+"s");
		console.log("ID ------------------------- PK ------------------------- H -- Upd -- DT ----- Trusted ------");
		db.all("SELECT * FROM connections;", function(err, entries){
			for (var i = 0; i < entries.length; i++){ 
				var row = entries[i];
				var now = new Date();
				total_dt = row.downtime;
				lifetime = Math.round(time_diff(row.first_ping, now));
				health = Math.round(((lifetime-total_dt)/lifetime)*100);
				diff = Math.round(time_diff(row.last_ping, now));
				console.log(row.id, row.validator_pk, health+"%   "+diff+"s   "+total_dt+"/"+lifetime, row.trusted);
			}
		});

	}
	
	
}

function update_last_ping(ping_datetime, id){
	db.run("UPDATE connections SET last_ping = '"+ping_datetime+"' WHERE id = '"+id+"';")
}

function update_downtime(ping_datetime, total_dt, id){
	db.run("UPDATE connections SET last_ping = '"+ping_datetime+"', downtime = '"+total_dt+"'  WHERE id = '"+id+"';");
}

function insert_new_pk(public_key, ping_datetime, trusted){
	db.run("INSERT INTO connections (validator_pk, first_ping, last_ping, downtime, trusted) VALUES ('"+public_key+"', '"+ping_datetime+"', '"+ping_datetime+"', '0', '"+trusted+"');");
}

//Function to calculate difference in seconds between two dates.
function time_diff(date1, date2){
	var time1 = new Date(date1);
	var time2 = new Date(date2);
	var diff = time1.getTime() - time2.getTime();
	var seconds_between_dates = Math.abs(diff/1000);
	return seconds_between_dates;
}


app.listen(PORT);
console.log("Listening at 127.0.0.1:"+PORT);
