var logs = [];
var unloggableTogglEntries = 0;
var config = {};
var myIdentity = {};

$(document).ready(function () {
    // Retrieve the stored options
    chrome.storage.sync.get({
        url: 'https://jira.atlassian.net',
        comment: 'Updated via toggl-to-jira https://github.com/maros136/Toggl-to-Jira-Chrome-Extension',
        togglApiToken: '',
        mergeEntriesBy: 'no-merge',
        useTogglDescription: true,
        comment: 'Updated via toggl-to-jira http://tiny.cc/t2j',
        jumpToToday: false,
        roundMinutes: 0,
    }, function (items) {
        config = items;
        console.log('Fetching toggl entries for today.', 'Jira url: ', config.url, config);

        // Configure AJAX for Jira requests that we are intercepting
        $.ajaxSetup({
            contentType: 'application/json',
            headers: {
                'forgeJira': 'true',
                'X-Atlassian-Token': 'nocheck',
                'Access-Control-Allow-Origin': '*'
            },
            xhrFields: {
                withCredentials: true
            }
        });

        var startString = localStorage.getItem('toggl-to-jira.last-date');
        var startDate = config.jumpToToday || !startString ? new Date() : new Date(startString);
        document.getElementById('start-picker').valueAsDate = startDate;

        var endString = localStorage.getItem('toggl-to-jira.last-end-date');
        var endDate = config.jumpToToday || !endString ? new Date(Date.now() + (3600 * 24 * 1000)) : new Date(endString);
        document.getElementById('end-picker').valueAsDate = endDate;

        $('#start-picker').on('change', fetchEntries);
        $('#end-picker').on('change', fetchEntries);
        $('#submit').on('click', submitEntries);

        // Try to connect to both services first - from identity.js
        identity.Connect(config.url, config.togglApiToken).done(function (res) {
            myIdentity = res;
            $('#connectionDetails').addClass('success').removeClass('error')
                .html('Toggl: ' + res.togglUserName + ' (' + res.togglEmailAddress + ') << connected >> JIRA: ' + res.jiraUserName + ' (' + res.jiraEmailAddress + ')');
            // Finally fetch the Toggl entries
            fetchEntries();
        }).fail(function () {
            $('#connectionDetails').addClass('error').removeClass('success')
                .html('Connecting to Toggl or JIRA failed. Check your configuration options.');
        });

    });
});

function submitEntries() {

    // log time for each jira ticket
    var timeout = 500;
    logs.forEach(function (log) {
        if (!log.submit) return;
        $('#result-' + log.id).text('Pending...').addClass('info');
        setTimeout(() => {

            // comment to go with work log (this is called Work Description in Jira UI)
            var comment = $("#comment-" + log.id).val() || '';
            var workDescription = "";
            if(config.useTogglDescription) {
                workDescription = (comment.length > 0) ? (log.description + ' - ' + comment) : log.description;
            } else {
                workDescription = comment;
            }

            // Api body to send
            var body = JSON.stringify({
                timeSpent: log.timeSpent,
                comment: workDescription,
                started: log.started
            });

            // Post to the Api
            $.post(config.url + '/rest/api/latest/issue/' + log.issue + '/worklog', body,
                function success(response) {
                    console.log('success', response);
                    log.submit = false;
                    $('#result-' + log.id).text('OK').addClass('success').removeClass('info');
                    $('#input-' + log.id).removeAttr('checked').attr('disabled', 'disabled');
                    $("#comment-" + log.id).attr('disabled', 'disabled');

                }).fail(function error(error, message) {
                    console.log(error, message);
                    var e = error.responseText || JSON.stringify(error);
                    console.log(e);
                    $('p#error').text(e + "\n" + message).addClass('error');
                })
        }, timeout);
        timeout += 500;
    });
}

// log entry checkbox toggled
function selectEntry() {
    var id = this.id.split('input-')[1];

    logs.forEach(function (log) {
        if (log.id === id) {
            log.submit = this.checked;
        }
    }.bind(this));
}

function fetchEntries() {
    // toISOString gives us UTC midnight of the selected date
    // eg; "2020-05-19T00:00:00.000Z" 
    var startDate = document.getElementById('start-picker').valueAsDate.toISOString();
    var endDate = document.getElementById('end-picker').valueAsDate.toISOString();
    // We will store these as simple ISO dates to easily retrieve and set
    localStorage.setItem('toggl-to-jira.last-date', startDate);
    localStorage.setItem('toggl-to-jira.last-end-date', endDate);

    // Toggl is expecting dates in ISO 8601 https://en.wikipedia.org/wiki/ISO_8601 with timezone offset
    // eg; "2020-05-20T04:51:50+00:00"
    // Because of timezones we want to slice off the Z from the ISO string and add the local offset
    // This gives us an offset from midnight of the date (eg in NZ a date of 20/05/20 should actually be to 12pm on the 19th UTC)
    var startDateWithTimezoneOffset = startDate.slice(0, -1) + dateTimeHelpers.timeZoneOffset();
    var endDateWithTimezoneOffset = endDate.slice(0, -1) + dateTimeHelpers.timeZoneOffset();
    $('p#error').text("").removeClass('error');

    // Encode the start and end times
    var dateQuery = '?start_date=' + encodeURIComponent(startDateWithTimezoneOffset) + '&end_date=' + encodeURIComponent(endDateWithTimezoneOffset);

    $.get('https://track.toggl.com/api/v8/time_entries' + dateQuery, function (entries) {
        console.log('entries', entries);
        logs = [];
        unloggableTogglEntries = 0;

        entries.reverse();
        entries.forEach(function (entry) {
            entry.description = entry.description || 'no-description';
            var issue = entry.description.split(' ')[0];
            var entryDescTemp = entry.description;
            var issueDescription = entryDescTemp.substr(entryDescTemp.indexOf(' ') + 1);//https://stackoverflow.com/questions/10272773/split-string-on-the-first-white-space-occurrence
            var togglTime = entry.duration;

            entry.description = entry.description.slice(issue.length + 1); // slice off the JIRA issue identifier
            // from dateTimeHelpers.js
            var togglTime = dateTimeHelpers.roundUpTogglDuration(entry.duration, config.roundMinutes);
            var dateString = dateTimeHelpers.toJiraWhateverDateTime(entry.start); // this means the Jira work log entry will have a matching start time to the Toggl entry
            var dateKey = dateTimeHelpers.createDateKey(entry.start);

            var log = _.find(logs, function (log) {
                if (config.mergeEntriesBy === 'issue-and-date') {
                    return log.issue === issue && log.dateKey === dateKey;
                } else {
                    return log.issue === issue;
                }
            });

            // merge toggl entries by ticket ?
            if (log && config.mergeEntriesBy !== 'no-merge') {
                log.timeSpentInt = log.timeSpentInt + togglTime;
                log.timeSpent = log.timeSpentInt > 0 ? log.timeSpentInt.toString().toHHMM() : 'still running...';
            } else {
                log = {
                    id: entry.id.toString(),
                    issue: issue,
                    description: entry.description,
                    submit: (togglTime > 0),
                    timeSpentInt: togglTime,
                    timeSpent: togglTime > 0 ? togglTime.toString().toHHMM() : 'still running...',
                    //comment: config.comment,
                    comment: issueDescription,
                    started: dateString,
                    dateKey: dateKey,
                };

                logs.push(log);
            }
        });

        renderList();
    });
}

function renderList() {
    var list = $('#toggle-entries');
    list.children().remove();
    var totalTime = 0;

    logs.forEach(function (log) {
        var url = config.url + '/browse/' + log.issue;
        var dom = '<tr><td>';

        // checkbox
        if (log.timeSpentInt > 0) dom += '<input id="input-' + log.id + '"  type="checkbox" checked/>';

        dom += '</td>';

        // link to jira ticket
        dom += '<td><a href="' + url + '" target="_blank">' + log.issue + '</a></td>';

        dom += '<td>' + log.description.limit(35) + '</td>';
        dom += '<td>' + log.started.toDDMM() + '</td>';

        if (log.timeSpentInt > 0) {
            dom += '<td>' + log.timeSpentInt.toString().toHH_MM() + '</td>';
            dom += '<td><input id="comment-' + log.id + '" type="text" value="' + log.comment + '" /></td>';
            dom += '<td  id="result-' + log.id + '"></td>';
        } else {
            dom += '<td colspan="3" style="text-align:center;">still running...</td>'
        }
        dom += '</tr>';

        totalTime += (log.timeSpentInt > 0 && log.timeSpentInt) || 0;

        list.append(dom);

        if (log.timeSpentInt > 0) {
            $('#input-' + log.id).on('click', selectEntry);
        }

    })
    // Total Time for displayed tickets and count of unloggable Toggl entries
    var totalRow = '<tr><td></td><td></td><td>';
    if(unloggableTogglEntries > 0) totalRow += '<i class="warning">+' + unloggableTogglEntries + ' Toggl entries with no valid Jira issues</i>';
    totalRow += '</td><td><b>TOTAL</b></td><td>' + totalTime.toString().toHHMM() + '</td></tr>';
    list.append(totalRow);

    // check if entry was already logged
    logs.forEach(function (log) {
        $.get(config.url + '/rest/api/latest/issue/' + log.issue + '/worklog',
            function success(response) {
                var worklogs = response.worklogs;
                worklogs.forEach(function (worklog) {
                    if (!!myIdentity.jiraEmailAddress && !!worklog.author && worklog.author.emailAddress !== myIdentity.jiraEmailAddress) { return; }

                    var diff = Math.floor(worklog.timeSpentSeconds / 60) - Math.floor(log.timeSpentInt / 60);
                    if (
                        // if date and month matches
                        worklog.started.toDDMM() === log.started.toDDMM() &&
                        !worklog.comment.localeCompare(log.comment) &&
                        // if duration is within 4 minutes because JIRA is rounding worklog minutes :facepalm:
                        diff < 1 && diff > -1
                    ) {
                        $('#result-' + log.id).text('OK').addClass('success').removeClass('info');
                        $('#input-' + log.id).removeAttr('checked').attr('disabled', 'disabled');
                        $("#comment-" + log.id).val(worklog.comment || '').attr('disabled', 'disabled');
                        log.submit = false;
                    }
                })
            });
    });

}
