const Twitter = require('twitter');
const config = require('./config');
const axios = require('axios');
const crypto = require('crypto')
const AWS = require('aws-sdk');
const http = require('http');
const https = require('https');

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
*   Puts <data> named <name> of type <filetype> to bucketofanimals
*/
function putToS3(data, name, filetype){
    var bucket = new AWS.S3();
    var params = {
        Bucket: 'bucketofanimals',
        Key: '/' + name + '.' + filetype,
        Body: data
    }
    bucket.putObject(params, function(error, data) {
        if (error) {
            console.log(error, error.stack)
        } else {
            console.log(data)
        }
    })
}

module.exports.tweet = async (event, context) => {
    //await statusUpdate("Hello world " + new Date());
    var parsed = JSON.parse(event.body);
    
    try {
        //if the media in the tweet is a photo
        var media_type = parsed['tweet_create_events'][0]['entities']['media'][0]['type']
        if (media_type === 'photo') {
            //get the url of the image
            var img_url = parsed['tweet_create_events'][0]['entities']['media'][0]['media_url_https']
            
            //write the img data to the S3 bucket
            axios.get(img_url)
                .then(resp => {
                    putToS3(data, "HelloImage", "jpg")
                    console.log("Wrote image to S3")
                })
                .catch(error => {
                    console.log(error[0])
                })
        }

        //get the user and respond
		var user = parsed['tweet_create_events'][0]['user']
		await statusUpdate("Hello " + user['screen_name'] + " what a nice image at " + new Date())
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Tweeted at the world!',
            }),
        };    
    } catch(error) {
        console.log(error[0])
    }
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




