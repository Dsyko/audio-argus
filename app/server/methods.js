Meteor.methods({
	resetDeviceStatus: function(messageId, clientTime) {
		//console.log('messageId: ', messageId);
		//console.log('clientTime: ', clientTime);
		check(messageId, String);
		check(clientTime, Number);
		if(Meteor.userId()) {
			this.unblock();
			var message = Messages.findOne({_id: messageId}, {fields: {userId: 1}});
			if(message && message.userId === Meteor.userId()){
				Messages.update({_id: messageId}, {$set: {
					lastClientResetTime: clientTime,
					lastServerResetTime: moment().valueOf(),
					messageSent: false,
					deviceHealthy: true
				}});
				processMessages();
			}else{
				throw new Meteor.Error(500, "User does not own message");
			}
		}
	},
	deviceUnHealthy: function(messageId) {
		//console.log('messageId: ', messageId);
		//console.log('clientTime: ', clientTime);
		check(messageId, String);
		if(Meteor.userId()) {
			this.unblock();
			var message = Messages.findOne({_id: messageId}, {fields: {userId: 1}});
			if(message && message.userId === Meteor.userId()){
				Messages.update({_id: messageId}, {$set: {
					messageSent: false,
					deviceHealthy: false
				}});
			}else{
				throw new Meteor.Error(500, "User does not own message");
			}
		}
	}
});