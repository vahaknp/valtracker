var console = require('better-console');
var mongoose = require('mongoose');
var async = require('async');
var prompt = require('prompt');

//Connect to database.
mongoose.connect('mongodb://localhost/validations');
var db = mongoose.connection;

//Define Schema of collections.
var validatorSchema = mongoose.Schema({
		pk: String,
		ping_datetime: Date,
		trusted: String,
		pinger: Number
});

//Open database and ask for prompts.
db.on('error', console.error.bind(console, 'Connection Error:'));
db.once('open', function callback () {
	async.waterfall([
		//Prompt for parameters
		function(callback){
			console.clear();
			console.log('Connected to database.');
			console.log('');
			console.log('Please enter the a threshold after which downtime should start being ');
			console.log('recorded and a time interval during which you want to know the downtime.');
			console.log('The date format is: yyyy-mm-dd hh-mm-ss.');
			console.log('Input "all" for no upper or lower bound.');
			prompt.start();
			prompt.get(['threshold', 'start_date', 'end_date'], function(err, result){
				//Date far enough into past. Replace with -infinity date.
				if (result.start_date == 'all'){
					start = '2000-Jan-1 9:00:00';
				}
				else{
					start = result.start_date;
				}
				//Date far enough into the future. Replace with +infinity date.
				if (result.end_date == 'all'){
					end = '2042-Jan-1 9:00:00';
				}
				else{
					end = result.end_date;
				}
				var negligable_time = result.threshold;
				callback(null, start, end, negligable_time);
			});
		},
		//Main
		function(start,end,negligable_time,callback){
			negligable_time = negligable_time;
			// Get logs from "debug.log".
			setInterval(function(){
				monitorFile("../log/validations.log");
			},10);

			//Query for uptime and display
			setInterval(function(){
				//Loop through collection names = all the public_keys that have been seen
				mongoose.connection.db.collectionNames(function (err, names) {
					console.clear();
					console.log("------------------------PK-------------------------- u - d - h ----- trusted? -----");
					for (var i=0; i<names.length; i++){
						name = names[i].name;
						if (name != "validations.system.indexes"){
							async.series([
								//Get name
								function(callback){
									pk = name.substr(name.indexOf('.')+1);
									callback(null, pk);
								},
								//Get all pings between given start and end dates, sorted
								function(callback){
									var Validator = mongoose.model(pk,validatorSchema, pk);
									Validator.find({ping_datetime:{"$gte": start, "$lt": end}}).sort('ping_datetime').exec(function(err, pings) {
										//Calculate downtime and lifetime.
										result = findDowntime(pings, negligable_time);
										callback(null, result);
									});
								}
							],
							//Return results
							function (err, result){
								console.log(result[0], result[1]);
							});
						}
					}
				});
			}, 1000);
		}
	], function(err, result){});
});

//Go through log file and seperate lines into log entries.
//Read first line then delete
function monitorFile(filename) {
		var sys = require('sys');
		var exec = require('child_process').exec;
		var spawn = require('child_process').spawn;
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
//Template: DATE, TIME, "Validations:DBG", "Val", "for", FOR_CODE, "from", FROM_CODE, "added", TRUSTED/NOT
function handleLogEntry(le) {
	le = JSON.parse(le);
	var public_key = le.public_key;
	var ping_datetime = le.ping_datetime;
	var trusted = le.trusted;
	var pinger = le.ping_id;
	
	//Make sure data is not corrupted
	if (public_key === undefined || ping_datetime === undefined || trusted === undefined || pinger === undefined){
		return;
	}

	//Save to database.
	var Validator = mongoose.model(public_key,validatorSchema, public_key);
	var ping = new Validator({pk: public_key, ping_datetime: ping_datetime, trusted: trusted, pinger: pinger});
	ping.save(function(err, ping){
		if (err) return console.error(err);
	});
}

//Finds downtime given a list of json objects of pings
function findDowntime(pings, neg){
	if (pings.length === 0){
		return (0+"   "+0+" "+" "+" 0 "+" "+" "+" "+" "+" "+" "+" "+" "+" x ");
	}
	var lifetime = 0;
	var health = 0;
	var total_dt = 0;
	var start_date = pings[0].ping_datetime;
	var end_date = pings[pings.length-1].ping_datetime;
	lifetime = time_diff(start_date, end_date);
	//Iterate through pings and add to downtime 
	//if interval is longer than the given threshold
	for (var i=1; i<pings.length; i++){
		now = pings[i].ping_datetime;
		last = pings[i-1].ping_datetime;
		diff = time_diff(now, last);
		if (diff > neg){
			total_dt += diff - neg;
		}
	}
	health = (lifetime - total_dt)/lifetime;
	return total_dt+" "+lifetime+" "+Math.round(health*100)+"% "+pings[0].trusted;
}

//Function to calculate difference in seconds between two dates.
function time_diff(date1, date2){
	var time1 = new Date(date1);
	var time2 = new Date(date2);
	var diff = time1.getTime() - time2.getTime();
	var seconds_between_dates = Math.abs(diff/1000);
	return seconds_between_dates;
}