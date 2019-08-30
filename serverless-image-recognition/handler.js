const Twitter = require('twitter');
const { config, secrets } = require('./config');
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
*
*   Unit testable, get image data from a live image URL, manually check upload on S3
*/
function putObjPromise(data, name, filetype) {
    var bucket = new AWS.S3();
    var params = {
        Body: data,
        Bucket: 'bucketofanimals',
        Key: name + '.' + filetype, 
    };
    return new Promise((resolve, reject) => {
        console.log("Putting an image to S3");
        bucket.putObject(params, (err, response) =>{
            if(err) reject(err);
            else resolve(response);
        });
    });
}

/**
*   Receives twitter webhook and uploads image from tweet to s3 if one exists.
*
*   Testable by tweeting to the bot or recording a webhook event and passing into function locally.
*/
module.exports.tweet = async (event, context) => {
    const parsed = JSON.parse(event.body);
    try {
        //if the media in the tweet is a photo
        const media_type = parsed['tweet_create_events'][0]['entities']['media'][0]['type'];
        if (media_type === 'photo') {
            
            //get the url of the image
            const img_url = parsed['tweet_create_events'][0]['entities']['media'][0]['media_url_https'];
            console.log("Tweet had a photo:  " + img_url)

            //do get request and s3 upload in one
            const options = {
                uri: img_url,
                encoding: null
            };
            const rq = util.promisify(request);
            const resp = await rq(options);
            
            //prepends the name with 'tw***' to identify this as a photo uploaded from a tweet
            await putObjPromise(resp.body, "tw***" + parsed['tweet_create_events'][0]['user']['screen_name'], "jpg")

        } else {
            console.log("Tweet had no photo, doing nothing")
        }
    } catch(error) {
        console.log(error)
    }
    
};


/**
*   Performs webhook verification for Twitter.
*
*   Testable by manually triggering a webhook verification event:
*       https://developer.twitter.com/en/docs/accounts-and-users/subscribe-account-activity/guides/managing-webhooks-and-subscriptions.html
*/
module.exports.verify = async (event, context) => {
	const crc_token = String(event['queryStringParameters']['crc_token']);
	const consumer_secret = secrets.tw_verification_token;

	const hmac = crypto.createHmac('sha256', consumer_secret).update(crc_token).digest('base64');

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
*
*   Testable by manually uploading an image with an animal to bucketofanimals s3 bucket
*/
module.exports.processImage = async(event, context) => {
    
    const key = event['Records'][0]['s3']['object']['key'];
    
    //pass into rekognition
    const labels = await rekogPromise("bucketofanimals", key, 80);
    
    //find animal name
    const animal = processResponse(labels);

    //can hardcode as jpg since all images are uploaded as jpgs
    let handle = key.replace(".jpg", "");
    
    //if image from twitter
    if (key.indexOf("tw***") >= 0) {
        handle = handle.replace("tw***", "")
        const date = new Date();
        if (animal !== 'not-animal') {
            await statusUpdate(`Thanks for the image of a ${animal} @${handle} \n\n ${date}`);
        } else {
            await statusUpdate(`I\'m not sure that\'s an animal @${handle}\n\n${date}`);
        }
    } else if (key.indexOf("fb***") >= 0) {
        handle = handle.replace("fb***", "")
        await fbmessage(handle, "thanks for the image of a " + animal)
    }
};

/**
    Performs a verification request for FB

    Testable by manually triggering a webhook verification in FB app console.
*/
module.exports.fbverify = async(event, context, callback) => {
    
    //get the query paramters
    const params = event['queryStringParameters'];
    
    //some random string
    const VERIFY_TOKEN = secrets.fb_verification_token;

    // Parse the query params
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

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
    Uploads an image for the FB messenger bot
    Takes in a webhook event, gets image, uploads to S3

    Testable by messaging the messenger bot an image, or recording a webhook event and passing in locally.
*/
module.exports.fbUploadImage = async(event, context) => {
    const body = JSON.parse(event['body']);
    
    //Checks this is an event from a page subscription
    if (body['object'] === "page") {
        const message = body['entry'][0]['messaging'][0];
        const sender = message['sender']['id'];
        
        //if there's an image attachment
        if (message['message']['attachments'] && message['message']['attachments'][0]['type'] === 'image') {
            const img_url = message['message']['attachments'][0]['payload']['url'];
            console.log("FB image at " + img_url)
            
            //do get request and s3 upload in one
            const options = {
                uri: img_url,
                encoding: null
            };
            const rq = util.promisify(request);
            const resp = await rq(options);
            
            //prepends the name with 'tw***' to identify this as a photo uploaded from a tweet
            await putObjPromise(resp.body, "fb***" + sender, "jpg")
        } else {
            await fbmessage(sender, "Try sending me an image of an animal")
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
 *
 *  Testable by recording the recipient id of a tester-accessible account and passing in.
 */
function fbmessage(recipient_id, response_text) {
    const request_body = {
        recipient: {
            id: recipient_id
        }, 
        message: {
            text: response_text
        }
    }
    const params = {
        uri: "https://graph.facebook.com/v2.6/me/messages",
        qs: { access_token: secrets.fb_access_token},
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
    const forbidden = ["Wildlife", "Animal", "Mammal"];
    
    //find the max element of response by it's Confidence rating that isn't forbidden 
    let max_animal = "";
    let max_score = 0;
    let is_animal = false;
    
    for (let index in response['Labels']) {
        const name = response['Labels'][index]['Name'];
        const score = parseFloat(response['Labels'][index]['Confidence']);
        //if name isn't forbidden
        if (forbidden.indexOf(name) < 0) {
            if (score > max_score) {
                max_animal = name
                max_score = score
            }
        }
        if (name === 'Animal') {
            is_animal = true;
        }
    }
    //I don't like magic strings but this is the most elegant way to do this
    if (!is_animal) {
        return 'not-animal';
    }
    return max_animal;
}

function rekogPromise(bucket, key, confidence) {
    const rekognition = new AWS.Rekognition();
    const params = {
        Image: {
            S3Object: {
                Bucket: bucket,
                Name: key
            }
        },
        MinConfidence: confidence || 80
    };
    
    return new Promise((resolve, reject) => {        
        rekognition.detectLabels(params, (err, response) => {
            if (err) reject(err);
            else resolve(response);
        });
    });
}






