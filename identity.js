/*
    Identity Management

    Let's us test and get identities for Jira and Toggl
*/

var identity = {
    // Attempt to connect to Jira
    ConnectToJira: function (jiraURL) {
        // https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-myself-get
        return $.get(jiraURL + '/rest/api/2/myself').then(function (jiraResult) {
            return result = { // transform the result
                jiraUserName: jiraResult.displayName,
                jiraEmailAddress: jiraResult.emailAddress
            }
        });
    },

    // Attempt to connect to Toggl
    ConnectToToggl: function (togglApiToken) {
        // https://github.com/toggl/toggl_api_docs/blob/master/chapters/users.md
        return $.get({
            url: 'https://www.toggl.com/api/v8/me',
            headers: {
                "Authorization": "Basic " + btoa(togglApiToken + ':api_token')
            }
        }).then(function (togglResult) {
            return result = { // transform the result
                togglUserName: togglResult.data.fullname,
                togglEmailAddress: togglResult.data.email
            }
        });
    },

    // Attempt to connect to both
    Connect: function (jiraURL, togglApiToken) {
        return $.when( // Wait until both have completed
            this.ConnectToJira(jiraURL),
            this.ConnectToToggl(togglApiToken)
        ).then(function (jiraResult, togglResult) {
            return result = { // transform the result, merge the other results
                ...jiraResult,
                ...togglResult
            }
        });
    }
}
