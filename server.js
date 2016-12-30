var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: false}));
var port = process.env.PORT || 8080; // process.env.PORT lets heroku set the port.
MongoClient = require('mongodb').MongoClient;

var accountSid = 'AC9550722b43b00be70c63b686a2cc07c0';
var authToken = '9a93918597cfc083f72a4f443b4420ef';
var twilio = require('twilio')(accountSid, authToken);
//var client = new twilio.RestClient(accountSid, authToken);

var peopleVoted = []; // dumb hack

app.set('view engine', 'jade');

app.use(express.static(__dirname + '/public')); // This allows anything in /public tobe served as if it were in the main directory.

MongoClient.connect('mongodb://heroku_cxgp2vvm:caetrp2v57asq6a593ub7i7891@ds149268.mlab.com:49268/heroku_cxgp2vvm', function(err,db){
	if(err) throw err;
	var collection = db.collection('anime');

	var index = function(req, res){
		collection.find().toArray(function(err, choices){
			// Render index, then pass choices to it.
			res.render('index', {choices:choices});
		});
	};
	var addAnime = function(req, res){
		req.body.votes = 2;
		req.body.animeID = toString(collection.count() + 1);
		console.log(req.body);
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
		console.log(req.body) // Details about the incoming text are passed into the body of the request.
		var textFrom = req.body.From;
		var textBody = req.body.Body;

		if(peopleVoted.indexOf(textFrom) < 0){
			res.send(`
				<Response>
					<Message>
						Sorry, you may only vote once.
					</Message>
				</Response>
			`);			
		}
		else if(textBody > collection.count()){
			res.send(`
				<Response>
					<Message>
						Thanks! Your vote for ${textBody} has been recorded.
					</Message>
				</Response>
			`);
			peopleVoted.push(textFrom);
			collection.update({"animeID" : textBody}, {"$inc" : {"votes" : 1}})
		}
		else{
			res.send(`
				<Response>
					<Message>
						Sorry, your vote for ${textBody} is invalid. Make sure your vote is a number between 1 and ${collection.count()}.
					</Message>
				</Response>
			`);
		}
	}
	var redir = function(req, res){
		res.redirect('/anime');
	}

	app.get('/', redir);
	
	app.get('/vote', index);
	app.post('/vote', voteSMS);
	
	app.get('/anime', index);
	app.post('/anime', addAnime);
	
	app.get('/reset', resetAnime);

	app.listen(port);
	console.log('Server is on %s', port);
});