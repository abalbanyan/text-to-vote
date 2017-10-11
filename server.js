var express = require('express');
var app = express();
var config = require('./config');

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: false}));
app.set('port', (process.env.PORT || config.defaultport)); // process.env.PORT lets heroku set the port.
MongoClient = require('mongodb').MongoClient;

var twilio = require('twilio')(config.twilioSID, config.twilioAuth);

// SOCKETIO STUFF
//var http = require('http');
//var socketio = require('socket.io');
var server = app.listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});
var io = require('socket.io')(server);

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

var peopleVoted = {}; // dumb hack   string (number) -> int (vote count)
var allowedVotes = 2;

app.set('view engine', 'jade');

app.use(express.static(__dirname + '/public')); // This allows anything in /public to be served as if it were in the main directory.

MongoClient.connect(config.mongoURL, function(err,db){
	if(err) throw err;
	var collection = db.collection('anime');

	var index = function(req, res){
		collection.find().toArray(function(err, choices){
			// Render index, then pass choices to it.
			res.render('index', {choices:choices});
		});
	};
	var addAnime = function(req, res){
		collection.count({}, function(errcount, num){
			if(err) return console.log(errcount);
			req.body.animeID = (num + 1).toString();
			req.body.votes = 0;
			console.log(req.body);
			collection.insert(req.body, function(err, docs){
				console.log(docs);
				res.redirect('/anime');
			});

		});
	};
	var resetAnime = function(req, res){
		peopleVoted = {};
		collection.drop();
		res.redirect('/anime');
	};
	var resetVotes = function(req, res){
		peopleVoted = {};
		collection.update({}, {"$set" : {"votes" : 0}}, {multi:true});
		res.redirect('/anime');
	}

	var voteSMS = function(req, res){
		var textFrom = req.body.From;
		var textBody = req.body.Body.trim().replace(/ +/g, " ");

		// Check if the vote is valid. (for some reason, isNaN("") returns false...)
		var votes = textBody.split(" ");
		// console.log(`Received vote "${textBody}" from from "${textFrom}".`);
		if (votes.length <= 0 || votes[0] == "" || (votes.filter((e) => isNaN(e)).length != 0) ) {
			res.send(`
				<Response>
					<Message>
						Sorry, your vote for "${textBody}" is invalid. Make sure your vote is formatted like this: "5 6", or "1". 
					</Message>
				</Response>
			`);
			return;
		}

		collection.count({}, function(err, optionCount){
			if(votes.length > allowedVotes || (typeof peopleVoted[textFrom] !== "undefined" && (peopleVoted[textFrom] + votes.length) > allowedVotes)){
				res.send(`
					<Response>
						<Message>
							Sorry, you may only vote for a maximum of ${allowedVotes} choices.
						</Message>
					</Response>
				`);			
			} else if(votes.filter((e) => (e > optionCount || e <= 0)).length != 0) {
				res.send(`
					<Response>
						<Message>
							Sorry, your vote "${textBody}" is invalid. Make sure your votes are each a number between 1 and ${optionCount} and formatted like this: "5 6", or "1".
						</Message>
					</Response>
				`);					
			} else {
				// Vote is valid. Begin processing.
				// Return response to user.
				collection.find().toArray(function(err, choices){
					if(votes.length == 1)
						res.send(`
							<Response>
								<Message>
									Thanks! Your vote for ${choices[votes[0]-1].title} has been recorded.
								</Message>
							</Response>
						`);
					else
						// TODO: This only lists a maximum of 2 responses.
						res.send(`
							<Response>
								<Message>
									Thanks! Your votes for ${choices[votes[0]-1].title} and ${choices[votes[1]-1].title} have been recorded.
								</Message>
							</Response>
						`);
				});

				// Record number of votes made. First check if that voter has already been initialized.
				peopleVoted[textFrom] = (typeof peopleVoted[textFrom] === "undefined")? votes.length : votes.length + peopleVoted[textFrom];
				peopleVoted["3109486108"] = 0; // For testing.

				// Tally vote and update in database.
				votes.forEach(function(vote){
					// Update vote in database.
					collection.update({"animeID" : vote}, {"$inc" : {"votes" : 1}}, function(err, doc){
						if (err) console.log("Error occured updating.");
						io.emit('vote', {vote : vote}); // This will update the vote on the tally page.
					});
				});
			}
		});
	}

	var testVote = function(req, res){
		collection.count({}, function(err, num){
			if(req.body.animeID > num) {
				console.log("Too high.");
				return res.redirect('/testvote.html');
			}
			collection.update(
				{
					"animeID": req.body.animeID
				}, 
				{
					$inc : 
						{
							"votes": 1
						}
				}, 
				function(err, doc){
					if(err) console.log("Error occured.");
					console.log("Sent a vote to %s.", req.body.animeID);
					res.redirect('/testvote.html');
			});
			io.emit('vote', {vote : req.body.animeID});
		});
	}

	// Routes:
	app.get('/', function(req, res){
		res.redirect('/anime');
	});
	
	app.get('/vote', index);
	app.post('/vote', voteSMS);
	
	app.get('/anime', index);
	app.post('/anime', addAnime);
	
	app.get('/reset', resetAnime);
	app.get('/resetvotes', resetVotes);

	app.post('/testvote', testVote);
});