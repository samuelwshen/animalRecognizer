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
async function statusUpdate(statuss = 'Hello World!') {
    return twitterClient.post('statuses/update', { status: statuss })
    	.then(function (status){
    		console.log("I tweeted: " + status)
            return;
    	}).catch(function (error){
    		console.log("Error: " + String(error))
    	})
}

/**
*   Puts <data> named <name> of type <filetype> to bucketofanimals
*/
function putToS3(data, name, filetype){
    console.log("In here")
    var bucket = new AWS.S3();
    var params = {
        Body: data,
        Bucket: 'bucketofanimals',
        Key: name + '.' + filetype
    }
    return bucket.putObject(params, function(err, data){
        if(err) console.log(err);
        else console.log(data);
    })

}
//TODO: pass image as stream
function test() {
    var img_url = 'https://pbs.twimg.com/profile_images/1066114215465734145/FJrZUYZm_400x400.jpg'
    
    https.get('https://pbs.twimg.com/profile_images/1066114215465734145/FJrZUYZm_400x400.jpg', (resp) => {
        resp.setEncoding('base64');
        resp.on('data', (data) => {
            putToS3(data, "Hello", "jpg")
        });
    })


/**
    axios.get(img_url)
        .then(resp => {
            var encodedImg = resp.data
            var decodedImg = Buffer.from(encodedImg, 'base64')
            putToS3(, "HelloImage", "jpg")
            console.log("Wrote image to S3")
            console.log(resp)
        })
        .catch(error => {
            console.log(error)
        })
        */
}
//test()

module.exports.tweet = async (event, context) => {
    
    var parsed = JSON.parse(event.body);
    console.log("In tweet lambda")
    try {
        //if the media in the tweet is a photo
        var media_type = parsed['tweet_create_events'][0]['entities']['media'][0]['type']
        if (media_type === 'photo') {
            
            //get the url of the image
            var img_url = parsed['tweet_create_events'][0]['entities']['media'][0]['media_url_https']
            console.log("Tweet had a photo:  " + img_url)
            //get the image
            var get_response = await axios.get(img_url)
            //write the image data
            putToS3(get_response.data, "HelloOoOO", "jpg")
        } else {
            console.log("Tweet had no photo, doing nothing")
        }
        /**
        //get the user and respond
        var user = parsed['tweet_create_events'][0]['user']
        var statuss = "Hello " + user['screen_name'] + " what a nice image at " + new Date()
        await twitterClient.post('statuses/update', { status: statuss })
        console.log("Tweeted")
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Tweeted at the world!',
            }),
        };    
        */
    } catch(error) {
        console.log(error)
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

module.exports.processImage = async(event, context) => {
    var rekognition = new AWS.Rekognition();
    
    //var bucket = event['Records'][0]['s3']['bucket']['name']
    //var key = event['Records'][0]['s3']['object']['key']
    
    var bucket = 'bucketofanimals'
    var key = 'cheetah-mom-cubs.ngsversion.1461770750320.adapt.1900.1.jpg'

    var params = {
        Image: {
            S3Object: {
                Bucket: bucket,
                Name: key
            }
        },
        MinConfidence: 80
    };
    rekognition.detectLabels(params, function(err, data){
        if(err) console.log(err);
        else    console.log(data);
    });
}




