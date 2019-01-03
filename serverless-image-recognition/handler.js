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
function statusUpdate(statuss = 'Hello World!') {
    return twitterClient.post('statuses/update', { status: statuss });
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
/**
*   Gets object named key from bucketofanimals
*   as a promise
*/
function getObjPromise(key) {
    var bucket = new AWS.S3();
    var params = {
        Bucket: 'bucketofanimals',
        Key: key
    }
    return new Promise((resolve, reject) => {
        console.log("Putting an image to S3");
        bucket.getObject(params, (err, response) =>{
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
            var resp = await rq(options)
            await putObjPromise(resp.body, parsed['tweet_create_events'][0]['user']['screen_name'], "jpg")

        } else {
            console.log("Tweet had no photo, doing nothing")
        }
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

/**
*   Finds the best animal fit for the image 
*   Image's s3:putObject response passed into event
*/
module.exports.processImage = async(event, context) => {

    var key = event['Records'][0]['s3']['object']['key']
    
    //pass into rekognition
    var labels = await rekogPromise("bucketofanimals", key, 80)
    
    console.log(labels)
    //find and tweet animal name
    var animal = processResponse(labels)

    //can hardcode as jpg since all images are uploaded as jpgs
    var handle = key.replace(".jpg", "")
    await statusUpdate("Thanks for the image of a " + animal + " @" + handle + "\n\n" + new Date())   
};

/**
    Performs a verification request for FB
*/
module.exports.fbverify = async(event, context, callback) => {
    
    //get the query paramters
    let params = event['queryStringParameters']
    
    //some random string
    let VERIFY_TOKEN = "sRExr8YoXoIJWYIGteloLT5DHUb5vrTx4DmxtxMYJMwF2W8igE"

    // Parse the query params
    let mode = params['hub.mode'];
    let token = params['hub.verify_token'];
    let challenge = params['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            return {
                statusCode: 200,
                body: parseInt(challenge)
            }
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            return {
                statusCode: 403   
            }
        }
    }
    
};

/**
    Processes an image for the FB messenger bot
    Takes in a webhook event, gets image, passes into
    rekognition, and responds
*/
module.exports.fbProcessImage = async(event, context) => {
    console.log(event['body'])
    var body = JSON.parse(event['body'])
    
    //Checks this is an event from a page subscription
    if (body['object'] === "page") {
        var message = body['entry'][0]['messaging'][0];
        var sender = message['sender']['id']
        var text = message['message']['text']
        
        //if there's an image attachment
        if (message['message']['attachments']) {
            await fbmessage(sender, "thanks for the image")
            console.log("Sent message in response to image")
        }
        
        return {
            statusCode: 200,
            body: "EVENT_RECEIVED"
        }
    } else {
        console.log("Not a webhook event from a page we are subscribed to");
        return {
            statusCode: 404
        }
    }
};

/**
 * Sends a facebook message to a recipient
 */
function fbmessage(recipient_id, response_text) {
    var request_body = {
        recipient: {
            id: recipient_id
        }, 
        message: {
            text: response_text
        }
    }
    var params = {
        uri: "https://graph.facebook.com/v2.6/me/messages",
        qs: { access_token: 'EAAEEM3wbR2QBAKtwZBrO6COYlCnxTZACJ4iXZCuF9c36L2DXUXQTWk9m8A5w5slebJ1MmLDqILtSoJXggPpvZCtCnIKRG3orwxd2upFqkvEvHo9xd2caYIDzZBbebAAuZBK2Y5dSZCmQ4LGG8QzNUd0cz1wnbGWWA1f8DapB2GOAAZDZD' },
        method: "POST",
        json: request_body
    }
    return new Promise((resolve, reject) => {
        request(params, (err, res, body) => {
            if (err) {
                console.log(err)
                reject(err)
            } else {
                console.log(body)
                resolve(body)
            }
        });  
    })
}
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


function rekogPromise(bucket, key, confidence) {
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






