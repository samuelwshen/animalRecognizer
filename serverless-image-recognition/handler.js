const Twitter = require('twitter');
const config = require('./config');
const axios = require('axios');
const crypto = require('crypto')

const twitterClient = new Twitter(config);

/**
 * @param {*} status
 * @return {Promise}
 */
function statusUpdate(status = 'Hello World!') {
    return twitterClient.post('statuses/update', { status });
}

module.exports.tweet = async (event, context) => {
    await statusUpdate("Hello world " + new Date());

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Tweeted hello world!',
        }),
    };
};

module.exports.verify = async (event, context) => {
	var crc_token = String(event['queryStringParameters']['crc_token'])
	var consumer_secret = 'AWSPQ3HIEZFW4s4PeiM6h5DmCqSSdR4uaBpPNouBJidrPJVHCE'

	var hmac = crypto.createHmac('sha256', consumer_secret).update(crc_token).digest('base64')

	//do all this formatting so AWS doesn't get angry 
	return {
	    isBase64Encoded: true,
		statusCode: 200,
		headers: {},
        body: JSON.stringify({
            response_token: "sha256=" + hmac
        }),
	};
}

module.exports.process = async(event) => {
	//var l = []
	//for (var i in event) {
	//	l.push(i)
	//}
	//console.log(l)
	
	//console.log(event.body)
	//console.log(JSON.parse(event.body))
	//if I get tweeted at
	var parsed = JSON.parse(event.body)
	console.log(parsed)
	if (parsed['tweet_create_events']) {
		var user = parsed['tweet_create_events'][0]['user']
		await statusUpdate("Hello @ " + user.screen_name)
	}

	return {
		statusCode: 200,
		body: JSON.stringify({
			message: "Got tweeted at"
		})
	};
}



