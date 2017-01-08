// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var util = require('util');


// variables
var configFile = require('./config.js');
var srcLogBucket = configFile.sourceLogBucket;
var srcLogBucketPath = configFile.sourceLogFolderPath;
var destLogCopyBucket = configFile.destinationBucket;
var destPrefixKey = configFile.destinationKeyPrefix;
var incLogBucketLogs = configFile.includeLogBucketLogs;


// get reference to S3 client 
var s3 = new AWS.S3();
 
exports.handler = function(event, context, callback) {


    var eventSrcBucket = event.Records[0].s3.bucket.name;

    // Read options from the event.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));

    // Object key may have spaces or unicode non-ASCII characters.
    var eventSrcKey    =
    decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    // If not a S3 log, then skip
    if (eventSrcKey.startsWith(srcLogBucketPath) == false){
        console.log("Not S3 Log...");
        return;
    }

    var eventSrcKeyName = path.basename(eventSrcKey);

    // Sanity check: validate that source and destination are different buckets.
    if (srcLogBucket == destLogCopyBucket) {
        callback("Source and destination buckets are the same.");
        return;
    }

    // Download the S3 log from S3, check, and upload to a different S3 bucket.
    async.waterfall([
        function download(next) {
            // Download the image from S3 into a buffer.
            s3.getObject({
                    Bucket: eventSrcBucket,
                    Key: eventSrcKey
                },
                next);
            },


        function check(response, next) {


            var logTxt = response.Body;
            var logTxtArray = logTxt.split(" ");
            var logSrcBucket = logTxtArray[1];

            // if we dont want to include source bucket logs
            if (incLogBucketLogs == "false"){
                if (logSrcBucket == srcLogBucket){
                    callback("Logging bucket log...");
                    return;

                }
            }

            next(null, response.ContentType, response.Body);

        },
        function upload(contentType, data, next) {
            // Send the log to a different S3 bucket.
            s3.putObject({
                    Bucket: destLogCopyBucket,
                    Key: destPrefixKey + eventSrcKeyName,
                    Body: data,
                    ContentType: contentType
                },
                next);
            }
        ], function (err) {
            if (err) {
                console.error(
                    'Unable to copy log ' + eventSrcKey + ' from ' + eventSrcBucket + ' to  ' + destLogCopyBucket + '/' + destPrefixKey
                );
            } else {
                console.log(
                    'Successfully copied log ' + eventSrcKey + ' from ' + eventSrcBucket + ' to  ' + destLogCopyBucket + '/' + destPrefixKey
                );
            }

            callback(null, "message");
        }
    );
};