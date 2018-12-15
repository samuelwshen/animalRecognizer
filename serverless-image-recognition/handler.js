const Twitter = require('twitter');
const config = require('./config');
const axios = require('axios');
const crypto = require('crypto')

const twitterClient = new Twitter(config);

/**
 * @param {*} status
 * @return {Promise}
 */
function statusUpdate(statuss = 'Hello World!') {
    twitterClient.post('statuses/update', { status: statuss })
    	.then(function (status){
    		console.log("I tweeted: " + status)
    	}).catch(function (error){
    		console.log("Error: " + String(error))
    	})
}

module.exports.tweet = async (event, context) => {
    //await statusUpdate("Hello world " + new Date());
    var parsed = JSON.parse(event.body);
    
    //if there's a photo in the tweet
    if (parsed['tweet_create_events'][0]['entities']['media'][0]['type'] === 'photo') {
        console.log("In the loop")
        
        console.log(parsed['tweet_create_events'][0]['entities']['media'][0]['media_url_https'])
    }
    console.log(event)
	if (parsed['tweet_create_events']) {
		var user = parsed['tweet_create_events'][0]['user']
		var result = await statusUpdate("Hellooooo00000 " + user['screen_name'])
	}
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Tweeted at the world!',
        }),
    };
};


module.exports.verify = async (event, context) => {
	var crc_token = String(event['queryStringParameters']['crc_token'])
	var consumer_secret = 'AWSPQ3HIEZFW4s4PeiM6h5DmCqSSdR4uaBpPNouBJidrPJVHCE'

	var hmac = crypto.createHmac('sha256', consumer_secret).update(crc_token).digest('base64')

	return {
	    isBase64Encoded: true,
		statusCode: 200,
		headers: {},
        body: JSON.stringify({
            response_token: "sha256=" + hmac
        }),
	};
};

module.exports.process = async(event, context) => {
	//var l = []
	//for (var i in event) {
	//	l.push(i)
	//}
	//console.log(l)
	
	//console.log(event.body)
	//console.log(JSON.parse(event.body))
	console.log(event);
	var parsed = JSON.parse(event.body);
	console.log(parsed);
	//if I get tweeted at
	if (parsed['tweet_create_events']) {
		var user = parsed['tweet_create_events'][0]['user'];
		var result = statusUpdate("Hellooooo")
	}

	return {
		statusCode: 200,
		body: JSON.stringify({
			message: "Got tweeted at"
		})
	};
}



