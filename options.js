// Saves options to chrome.storage
function saveOptions() {
    // Required config
    var url = $('#jira-url').val();
    if (url.endsWith('/')) url = url.slice(0, -1); // remove the trailing slash if it has one
    var togglApiToken = $('#toggl-api-token').val();
    // Optional settings
    var mergeEntriesBy = $('#merge-entries-by').val();
    var useTogglDescription = $('#use-toggl-description').prop('checked');
    var comment = $('#log-comment').val();
    var jumpToToday = $('#jump-to-today').prop('checked');
    var roundMinutes = $('#round_minutes').val();
    chrome.storage.sync.set({
        url: url,
        togglApiToken: togglApiToken,
        mergeEntriesBy: mergeEntriesBy,
        useTogglDescription: useTogglDescription,
        comment: comment,
        jumpToToday: jumpToToday,
        roundMinutes: roundMinutes
    }, function () {
        // Update status to let user know options were saved.
        var status = $('#status');
        status.fadeTo(100, 1).text('Options saved.').delay(750).fadeTo(500, 0);
        // Also run the configuration test on save
        testConfiguration();
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    // Use default values
    chrome.storage.sync.get({
        url: 'https://jira.atlassian.net',
        comment: 'Updated via toggl-to-jira https://github.com/maros136/Toggl-to-Jira-Chrome-Extension',
        mergeEntriesBy: 'no-merge',
        useTogglDescription: true,
        comment: 'Updated via toggl-to-jira http://tiny.cc/t2j',
        jumpToToday: false,
        togglApiToken: '',
        roundMinutes: 0,
    }, function (items) {
        $('#jira-url').val(items.url);
        $('#toggl-api-token').val(items.togglApiToken);
        $('#merge-entries-by').val(items.mergeEntriesBy);
        $('#use-toggl-description').prop('checked', items.useTogglDescription);
        $('#log-comment').val(items.comment);
        $('#jump-to-today').prop('checked', items.jumpToToday);
        $('#round_minutes').val(items.roundMinutes);
    });
}

// Test connections to both Jira and Toggl
function testConfiguration() {

    var url = $('#jira-url').val();
    var togglApiToken = $('#toggl-api-token').val();

    // From identity.js this will try to connect to both services

    // Display the Jira result
    var jiraTestResult = $('#jiraTestResult');
    identity.ConnectToJira(url).done(function (res) {
        jiraTestResult.removeClass('error').addClass('success');
        jiraTestResult.fadeTo(100, 1).text('Connected to Jira as ' + res.jiraUserName + ' (' + res.jiraEmailAddress + ')').delay(1500).fadeTo(500, 0);
    })
    .fail(function () {
        jiraTestResult.removeClass('success').addClass('error');
        jiraTestResult.fadeTo(100, 1).text('There was a problem with connecting to Jira. Have you got the right URL and are you logged in?');
    });

    // Display the Toggl result
    var togglTestResult = $('#togglTestResult');
    identity.ConnectToToggl(togglApiToken).done(function (res) {
        togglTestResult.removeClass('error').addClass('success');
        togglTestResult.fadeTo(100, 1).text('Connected to Toggl as ' + res.togglUserName + ' (' + res.togglEmailAddress + ')').delay(1500).fadeTo(500, 0);
    })
    .fail(function () {
        togglTestResult.removeClass('success').addClass('error');
        togglTestResult.fadeTo(100, 1).text('There was a problem with connecting to Toggl. Have you provided the right API key?');
    });

}

// Add handlers on page load
$(function () {
    restoreOptions();
    $('#save').on('click', saveOptions);
    // Take you back to the popup on close
    $('#close').on('click', function () {
        window.location = "popup.html"
    });
    // only no-merge can be used with useTogglDescription    
    $('#merge-entries-by').on('change', function () {
        if ($(this).val() != "no-merge") {
            $('#use-toggl-description').prop('checked', false).prop('disabled', true);
        } else {
            $('#use-toggl-description').prop('disabled', false);
        }
    });


});


