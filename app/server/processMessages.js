var timeoutHandle;
var twilio = Meteor.npmRequire('twilio');
var twilioClient = twilio(Meteor.settings.twilio.account, Meteor.settings.twilio.token);


var sendMessage = function(message){
	var user = Users.findOne({_id: message.userId}, {fields: {'profile.name': 1}});
	var messagetext = "We have detected an issue with your device \"" + message.name + "\" with the deviceiId: " + message.deviceId + ". Please perform maintenance as soon as possible.";
	try{
		_.each(message.emails, function(emailAddress){

			Email.send({
				to: emailAddress,
				from: 'audioargus@audioargus.com',
				subject: 'Message from ' + user && user.profile && user.profile.name,
				text: messagetext,
				html: Handlebars.templates.emailTemplate({
					message: messagetext,
					sendersName: user && user.profile && user.profile.name
				})
			});
		});

		_.each(message.texts, function(phoneNumber){
			//Send SMS
			twilioClient.sendMessage({

				to:'+1' + phoneNumber, // Any number Twilio can deliver to
				from: TWILIO_PHONE_NUMBER, // A number you bought from Twilio and can use for outbound communication
				body: messagetext // body of the SMS message

			}, function(err, responseData) { //this function is executed when a response is received from Twilio

				if (!err) { // "err" is an error received during the request, if any

					// "responseData" is a JavaScript object containing data received from Twilio.
					// A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
					// http://www.twilio.com/docs/api/rest/sending-sms#example-1
					console.log(responseData.from); // outputs "+14506667788"
					console.log(responseData.body); // outputs "word to your mother."
				}
			});

		});

		_.each(message.calls, function(phoneNumber){
			//Initiate Call
			twilioClient.makeCall({

				to:'+1' + phoneNumber, // Any number Twilio can call
				from: TWILIO_PHONE_NUMBER, // A number you bought from Twilio and can use for outbound communication
				url: Meteor.absoluteUrl('_twiml/' + message._id) // A URL that produces an XML document (TwiML) which contains instructions for the call

			}, function(err, responseData) {

				//executed when the call has been initiated.
				console.log(responseData.from); // outputs "+14506667788"

			});
		});
	}catch(err){
		console.log("error sending messages: ", JSON.stringify(err));
	}

	Messages.update({_id: message._id}, {$set: {messageSent: true, lastMessageSentAt: moment().valueOf()}});
};

processMessages = function(){
	//Process all old messages
	Messages.find({messageSent: false, deviceHealthy: false}).forEach(sendMessage);

};

Meteor.startup(function () {
	processMessages();
});



//We need some server side routing so we can process requests from twilio (for TWIML files to send voice)



// Listen to incoming API http requests
WebApp.connectHandlers.use(function(request, result, next) {
	// Need to create a Fiber since we're using synchronous http calls and nothing
	// else is wrapping this in a fiber automatically
	//Fiber(function () {
	Meteor.wrapAsync(function(){
		var message, messageId;
		try {
			if(!request || !request.url){
				next();
				return;
			}
			var splitPath = request.url.split('/');
			var requestRoot = splitPath[1];
			if (requestRoot !== '_twiml' && requestRoot !== '_sigfox'){
				//Not a request we're interested in, return null and the middleware handler will pass request processing to next connectHandler
				next();
				return;
			}else{
				if(requestRoot === '_twiml'){
					if(request.method === 'POST') {

					}
					messageId = splitPath[2];
					message = Messages.findOne({_id: messageId}, {fields: {text: 1, userId: 1}});
					var messagetext = "We have detected an issue with your device \"" + message.name + "\" with the deviceiId: " + message.deviceId + ". Please perform maintenance as soon as possible.";
					if(message && _.isString(messagetext)){
						var user = Users.findOne({_id: message.userId}, {fields: {profile: 1}});
						var twiml = new twilio.TwimlResponse();
						var intro = "This is an automated message from Audio Argus";
						if(user && user.profile && user.profile.name){
							intro += " being sent to you by " + user.profile.name;
						}
						intro += ". The message is as follows.";

						twiml.say(intro, {voice: 'man', language:'en'})
							.pause({ length: 1 })
							.say(messagetext, {voice: 'woman', language:'en'})
							.pause({ length: 1 })
							.say("This message was sent to you through Audio Argus, For more information go to Audio Argus, dot Meteor, dot com.", {voice: 'man', language:'en'})
							.pause({ length: 1 })
							.say("Thank you, good bye.", {voice: 'man', language:'en'});
						//.play('http://www.example.com/some_sound.mp3');
						result.writeHead(200, {'Content-Type': 'text/xml'});
						result.end(twiml.toString());
						return;
					}
				}else if(requestRoot === '_sigfox'){
					var deviceId = splitPath[2];
					message = Messages.findOne({deviceId: deviceId}, {fields: {userId: 1}});
					if(message){
						Messages.update({_id: message._id}, {$set: {deviceHealthy: false}});
					}
					processMessages();
					console.log("_sigfox deviceId: ", deviceId);
					result.writeHead(200, {'Content-Type': 'text/xml'});
					result.end();
					return;
				}

			}
			next();
			return;
		}catch(err){
			console.log("Error in middleware: " + JSON.stringify(err));
		}
	})();
	//}).run();
});