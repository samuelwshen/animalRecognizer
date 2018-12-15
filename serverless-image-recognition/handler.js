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
	crc_token = String(event.crc_token)
	var consumer_secret = 'V5a2slYwndbirf25ng2gtDq5vAPk2yW2mLdxKX5pWW27tkwFBi';

	hmac = crypto.createHmac('sha256', consumer_secret).update(crc_token).digest('base64')

	return {
		statusCode: 200,
		response_token: hmac,
	};
}



