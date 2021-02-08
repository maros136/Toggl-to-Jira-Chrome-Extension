/*
 *  Copyright (c) 2016 Frank Trigub. All rights reserved.*
    frankyyyy at live com

    Background process that intercepts all web requests.
    Jira requests that we make are then forged as if coming from Jira.
*/

console.log('Starting extension');

// Retrieve the configured Jira URL
var jiraUrl;
chrome.storage.sync.get({
    url: 'https://jira.atlassian.net'
}, function (items) {
    jiraUrl = items.url;
});

// Handler to intercept Jira requests
var requestFilter = { urls: ['<all_urls>'] };
var extraInfoSpec = ['requestHeaders', 'blocking'];
var handler = function (details) {

    // We only need to intercept jira requests
    var jiraRequest = details.url.indexOf(jiraUrl) > -1;
    if(!jiraRequest) return;

    var isRefererSet = false;
    var originSet = false;
    var forge = false;

    var headers = details.requestHeaders;
    var blockingResponse = {};

    // We only need to forge requests that we are making
    // We set an extra header in our requests
    for (var j = 0, k = headers.length; j < k; ++j) {
        if (headers[j].name === 'forgeJira') {
            forge = true;
        }
    }

    if (forge) {
        //  forge this request
        for (var i = 0, l = headers.length; i < l; ++i) {
            if (headers[i].name === 'Referer') {
                headers[i].value = jiraUrl;
                isRefererSet = true;
            }
            if (headers[i].name === 'Origin') {
                headers[i].value = jiraUrl;
                originSet = true;
            }
        }

        if (!isRefererSet) {
            headers.push({
                name: 'Referer',
                value: jiraUrl
            });
        }

        if (!originSet) {
            headers.push({
                name: 'Origin',
                value: jiraUrl
            });
        }
    }

    blockingResponse.requestHeaders = headers;
    return blockingResponse;
};

// Intercept all requests
chrome.webRequest.onBeforeSendHeaders.addListener(handler, requestFilter, extraInfoSpec);


// Called when the user clicks on the browser action.
chrome.browserAction.onClicked.addListener(function () {
    // No tabs or host permissions needed!
    chrome.tabs.executeScript({
        file: 'parser.js'
    });
});
