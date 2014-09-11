var PORT = 3000;
var express = require('express');
var app = express();
var console = require('better-console');
var mongoose = require('mongoose');
var async = require('async');

//Connect to database.
mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;

//Define Schema of collections.
var validatorSchema = mongoose.Schema({
		pk: String,
		ping_datetime: Date,
		trusted: String,
		pinger: Number
});


// --- Main --- //
//Open database.
db.on('error', console.error.bind(console, 'Connection Error:'));
db.once('open', function callback () {
	console.log('Connected');

	// Get logs from "debug.log".
	setInterval(function(){
		monitorFile("../log/validations.log")
	},10);

	//Query for uptime.
	setInterval(function(){
		mongoose.connection.db.collectionNames(function (err, names) {
			var start = '2014-Sep-8 21:42:42';
			var end = '2014-Sep-12 1:42:42';
			console.clear();
			for (var i=0; i<names.length; i++){
				name = names[i].name;
				if (name != "test.system.indexes"){
					async.series([
						function(callback){
							pk = name.substr(name.indexOf('.')+1);
							callback(null, pk);
						},
						function(callback){
							var Validator = mongoose.model(pk,validatorSchema, pk);
							Validator.find({ping_datetime:{"$gte": start, "$lt": end}}).sort('ping_datetime').exec(function(err, pings) {
								//Calculate downtime and lifetime.
								results = findDowntime(pings);
								callback(null, results);
							});
						}
					],
					function (err, result){
						console.log(result[0], result[1]);
					});
				}
			}
		});
	}, 1000);

});

// ------------ //



// - Utility - //
var sys = require('sys');
var exec = require('child_process').exec;

//Go through log file and seperate lines into log entries.
var spawn = require('child_process').spawn;
function monitorFile(filename) {
		var cmd = spawn("head", ["-n 1",filename]);
		cmd.stderr.on("data", function(data){
				console.log('stderr: ' + data);
		});
		cmd.stdout.on("data", function(data){
				var logEntries = (""+data).split("\n");
				var le = logEntries[0].trim();
				if (le.length) {
						handleLogEntry(le);
				}
		});
		exec('sed -i -e 1d '+ filename);
}


//Sift through log entries and pick out those which have the validation fingerprint.
// Template: DATE, TIME, "Validations:DBG", "Val", "for", FOR_CODE, "from", FROM_CODE, "added", TRUSTED/NOT
function handleLogEntry(le) {
	le = JSON.parse(le);
	var public_key = le.public_key;
	var ping_datetime = le.ping_datetime;
	var trusted = le.trusted;
	var pinger = le.ping_id;
	
	if (public_key == undefined || ping_datetime == undefined || trusted == undefined || pinger == undefined){
		return;
	}

	var Validator = mongoose.model(public_key,validatorSchema, public_key);

	var ping = new Validator({pk: public_key, ping_datetime: ping_datetime, trusted: trusted, pinger: pinger})
	ping.save(function(err, ping){
		if (err) return console.error(err);
		//console.log("Added "+ ping);
	});
};

//Finds downtime given a list of json objects of pings
function findDowntime(pings){
	var lifetime = 0;
	var health = 0;
	var start_date = pings[0].ping_datetime;
	var end_date = pings[pings.length-1].ping_datetime;
	lifetime = time_diff(start_date, end_date);

	var total_dt = 0;
	var negligable_time = 5;
	for (var i=1; i<pings.length; i++){
		now = pings[i].ping_datetime;
		last = pings[i-1].ping_datetime;
		diff = time_diff(now, last);
		if (diff > negligable_time){
			total_dt += diff - negligable_time;
		}
	}
	health = (lifetime - total_dt)/lifetime;
	return total_dt+" "+lifetime+" "+Math.round(health*100)+"% "+pings[0].trusted;
	//return pings.length;
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