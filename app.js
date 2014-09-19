
var express    = require('express'),
    path       = require('path'),
    bodyParser = require('body-parser'),
    app        = express(),
    routes     = require('./routes/index'),
    master     = require('./master.js');


var server = app.listen('8080');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

//API
app.use('/', routes);

//Add pings to database from master file
setInterval(function(){
  master.monitorFile("../log/validations.log");
},10);