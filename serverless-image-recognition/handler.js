const Twitter = require('twitter');
const config = require('./config');
const axios = require('axios');

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
