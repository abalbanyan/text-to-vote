var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser());
var port = 3000;
MongoClient = require('mongodb').MongoClient;

var accountSid = 'AC9550722b43b00be70c63b686a2cc07c0';
var authToken = '9a93918597cfc083f72a4f443b4420ef';
var twilio = require('twilio');
var client = new twilio.RestClient(accountSid, authToken);

app.set('view engine', 'jade');

app.use(express.static(__dirname + '/public')); // This allows anything in /public tobe served as if it were in the main directory.

MongoClient.connect('mongodb://127.0.0.1:27017/animetest', function(err,db){
	if(err) throw err;
	var collection = db.collection('anime');

	var index = function(req, res){
		collection.find().toArray(function(err, choices){
			// Render index, then pass choices to it.
			res.render('index', {choices:choices});
		});
	};
	var addAnime = function(req, res){
		collection.insert(req.body, function(err, docs){
			console.log(docs);
			res.redirect('/anime');
		});
	};
	var resetAnime = function(req, res){
		collection.drop();
		res.redirect('/anime');
	};
	var voteSMS = function(req, res){
		if(twilio.validateExpressRequest(req, authToken)){
			res.header('Content-Type', 'text/xml');
			var body = req.param('Body').trim();
			var to = req.param('To'); // Number vote is sent to.
			var from = req.param('From'); // Voter number.
			var body = req.param('Body');

			response.send('<Response><Sms>If you get this, then it means shit worked.</Sms></Response>'); 
		}
	}

	app.post('/vote', voteSMS);
	app.get('/anime', index);
	app.post('/anime', addAnime);
	app.get('/reset', resetAnime);

	app.listen(port);
	console.log('Server is on %s', port);
});