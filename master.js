var sys        = require('sys'),
    exec       = require('child_process').exec,
    spawn      = require('child_process').spawn,
    moment     = require('moment'),
    neg        = require('./config.js').negTime,
    database   = require('./database.js');


client = database.client;

//Go through log file and seperate lines into log entries.
//Read first line then delete
exports.monitorFile = function(filename) {
  var cmd = spawn("head", ["-n 1",filename]);
  cmd.stderr.on("data", function(data){
    console.log('stderr: ' + data);
  });
  cmd.stdout.on("data", function(data){
    var logEntries = (""+data).split("\n"),
        le = logEntries[0].trim();
    if (le.length) {
      handleLogEntry(le);
    }
  });
  exec('sed -i -e 1d '+ filename);
}

//Sift through log entries and pick out those which have the validation fingerprint.
//Template: DATE, TIME, "Validations:DBG", "Val", "for", FOR_CODE, "from", FROM_CODE, "added", TRUSTED/NOT
function handleLogEntry(le) {
  console.log('Got one.');
  le = JSON.parse(le);
  var public_key = le.public_key,
      ping_datetime = le.ping_datetime,
      trusted = le.trusted,
      pinger = le.ping_id;
  
  //Make sure data is not corrupted
  if (public_key === undefined || ping_datetime === undefined || trusted === undefined || pinger === undefined){
    return;
  }

  database.addPing(client, public_key, ping_datetime, trusted);
}

function timeDiff(d1, d2){
  d1 = moment(d1, 'YYYYMMDDHHmmss').format('X');
  d2 = moment(d2, 'YYYYMMDDHHmmss').format('X');
  return Math.abs(d1-d2);
}

function findDowntime(pings){
  var validators = {},
      lifetime,
      ping,
      key,
      dt,
      diff,
      last_dt = pings[pings.length-1].key.split("|")[0];

  for (var i = 0; i<pings.length; i++){
    var ping = pings[i],
        key  = ping.key.split("|")[1],
        dt   = ping.key.split("|")[0];  
    if (!validators[key]){
      lifetime = timeDiff(dt, last_dt);
      validators[key] = {
        downtime: 0,
        lifetime: lifetime,
        last: dt,
        trusted: ping.$,
        key: key
      }
    }
    diff = timeDiff(validators[key].last, dt);
    if (diff > neg){
      validators[key].downtime += diff - neg;
    }
    validators[key].last = dt;
  }

  for (var key in validators){
    diff = timeDiff(validators[key].last, last_dt);
    if(diff > neg) validators[key].downtime += diff - neg;
    var lifetime = validators[key].lifetime,
        downtime = validators[key].downtime,
        trusted = validators[key].trusted,
        health = (lifetime - downtime)/lifetime;
        health = (health*100).toFixed(2);
    validators[key].health = health;
  }
  return validators;
}

exports.main = function(start, end, callback){
  console.log(start, end);
  var response = {
    startDate : start,
    endDate : end,
    threshold : neg
  }
  database.createScanner(start,end,function(error, scanner){
    database.getPings(scanner, function(error, pings){
      if (error) callback(error);
      else { 
        var vals = findDowntime(pings, start, end);
        response.validators = vals;
        callback(null,response);
      }
    });
  })
}
