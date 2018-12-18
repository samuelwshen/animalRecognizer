const Twitter = require('twitter');
const config = require('./config');
const axios = require('axios');
const crypto = require('crypto')
const AWS = require('aws-sdk');
const http = require('http');
const https = require('https');
const request = require('request');
const util = require('util');

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
*   as a promise
*/
function putObjPromise(data, name, filetype) {
    var bucket = new AWS.S3();
    var params = {
        Body: data,
        Bucket: 'bucketofanimals',
        Key: name + '.' + filetype
    }
    return new Promise((resolve, reject) => {
        console.log("Putting an image to S3");
        bucket.putObject(params, (err, response) =>{
            if(err) reject(err);
            else resolve(response);
        })
    });
}

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

            //do get request and s3 upload in one
            var options = {
                uri: img_url,
                encoding: null
            };
            const rq = util.promisify(request)
            await rq(options)
            var resp = await rq(options)
            await putObjPromise(resp.body, "Hello", "jpg")

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

/**
*   Finds the best animal fit for the image 
*   Image's s3:putObject response passed into event
*/
module.exports.processImage = async(event, context) => {
     
    //var bucket = event['Records'][0]['s3']['bucket']['name']
    var key = event['Records'][0]['s3']['object']['key']
    
   // var key = "cheetah-mom-cubs.ngsversion.1461770750320.adapt.1900.1.jpg"
    var response = await getObjPromise(key)
    //console.log(JSON.stringify(response.Body))
    var data = JSON.parse(JSON.stringify(response.Body))['data']
    console.log(new Uint8Array(data))
    var res = await rekogPromise(new Uint8Array(data))
    
    console.log(res)
    //var bucket = 'bucketofanimals'
    //var key = 'cheetah-mom-cubs.ngsversion.1461770750320.adapt.1900.1.jpg'
    
    /**
    await rekognitionPromise(bucket, key, 80)
        .then(function(response) {
            var animal = processResponse(response)
        })
        .catch(function(err) {
            console.log(err)
        })
        */
    statusUpdate("Thanks for the image! " + new Date())   
};

/**
 * Processes a response from a detectLabels call, returning the best fit
 */ 
function processResponse(response) {
    //non-useful names that are common
    var forbidden = ["Wildlife", "Animal"]
    
    //find the max element of response by it's Confidence rating that isn't forbidden 
    var max_animal = ""
    var max_score = 0
    
    for (let index in response['Labels']) {
        let name = response['Labels'][index]['Name']
        let score = parseFloat(response['Labels'][index]['Confidence'])
        //if name isn't forbidden
        if (forbidden.indexOf(name) < 0) {
            if (score > max_score) {
                max_animal = name
                max_score = score
            }
        }

    }
    return max_animal;
}


function rekognitionPromise(bucket, key, confidence) {
    var rekognition = new AWS.Rekognition();
    var params = {
        Image: {
            S3Object: {
                Bucket: bucket,
                Name: key
            }
        },
        MinConfidence: confidence || 80
    };
    
    return new Promise((resolve, reject) => {
        console.log("Calling AWS detectLabels");
        
        rekognition.detectLabels(params, (err, response) => {
            if (err) reject(err);
            else resolve(response);
        });
    });
}



