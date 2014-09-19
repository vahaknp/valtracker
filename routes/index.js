var express = require('express');
var router = express.Router();
var master = require('../master.js');
var moment = require('moment');

//Display health for all time
router.get('/health/display', function(req, res) {
	console.log('Displaying health for all time.');
	var list = [];
	master.main(0,0,function(error, response){
		if (error) res.send(error);
		else {
			for (key in response.validators){
				var val = response.validators[key];
				list.push(val);
			}
			res.render('index', {
				"dates": ['',''],
				"vallist" : list
			});
		}
	})
});

//Display health for start date to end date
router.get('/health/display/:start/:end', function(req, res) {
	console.log('Displaying health for range.');
	var start  = req.params.start,
				end  = req.params.end,
				list = [];
	master.main(start,end,function(error, response){
		if (error) res.send(error);
		else {
			for (key in response.validators){
				var val = response.validators[key];
				list.push(val);
			}
			res.render('index', {
				"dates": [start, end],
				"vallist" : list
			});
		}
	})
});

/* POST change date range*/
router.post('/', function(req, res) {
		var start = new Date(req.body.start),
				end   = new Date(req.body.end);
		start = moment(start).format("YYYYMMDDHHmmss");
		end = moment(end).format("YYYYMMDDHHmmss");
		if (start === 'Invalid date') start = '0';
		if (end === 'Invalid date') end = '0';
		res.redirect('/health/display/'+start+'/'+end);
});

//Api Call for all health
router.get('/health/:start/:end', function(req, res) {
	console.log('Displaying json for range.');
	var start = req.params.start,
				end = req.params.end;
	master.main(start,end,function(error, response){
		if (error) res.send(error);
		else res.send(response);
	})
});

//Api call for start date to end date
router.get('/health', function(req, res) {
	console.log('Displaying json for all time.');
	master.main(0,0,function(error, response){
		if (error) res.send(error);
		else res.send(response);
	})
});


module.exports = router;