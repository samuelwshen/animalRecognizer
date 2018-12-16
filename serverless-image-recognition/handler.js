const Twitter = require('twitter');
const config = require('./config');
const axios = require('axios');
const crypto = require('crypto')
const AWS = require('aws-sdk');
const http = require('http');

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

/**
*   Puts something to the S3 bucket hardcoded in here
*/
function putToS3(){
    var bucket = new AWS.S3();
    var params = {
        Bucket: 'bucketofanimals',
        Key: '/hello.txt',
        Body: 'Hello!'
    }
    bucket.putObject(params, function(error, data) {
        if (error) {
            console.log(error, error.stack)
        } else {
            console.log(data)
        }
    })
}
putToS3()

module.exports.tweet = async (event, context) => {
    //await statusUpdate("Hello world " + new Date());
    var parsed = JSON.parse(event.body);
    
    try {
        //if there's a photo in the tweet
        var media_type = parsed['tweet_create_events'][0]['entities']['media'][0]['type']
        if (media_type === 'photo') {
            var img_url = parsed['tweet_create_events'][0]['entities']['media'][0]['media_url_https']
            console.log(img_url)
        }
		var user = parsed['tweet_create_events'][0]['user']
		var result = await statusUpdate("Hellooooo00000 " + user['screen_name'] + " what a nice image at " + new Date())
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Tweeted at the world!',
            }),
        };    
    } catch(error) {
        console.log(error[0])
    }
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'I didnt tweet back at the world!',
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




