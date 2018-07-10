'use strict'

let JUnitReportsManager = require('./jUnitReports')
let CaseRunMapManager   = require('./caseRunMap')
let TestRailManager     = require('./testRail')
let ReportDispatcher    = require('./reportDispatcher')

/**
 * Instantiates a "core" object with given dependencies. The object consists of
 * properties that represent methods to be run on corresponding commands.
 *
 * @param {object} configs
 * @returns {{report: Function}}
 */
function Core({testRailUrl, testRailUser, testRailPassword, console, debugMode}) {
    let debug = function (message) {
        if (debugMode) {
            console.error(message)
        }
    }

    /**
     * Given a junit XML file (or a directory of files), processes all test
     * results, maps them to cases, and pushes the results to testRailClient.
     *
     * @param {int} runId
     *   The ID of the run with which to associate the cases.
     * @param {int} planId
     *   The ID of the test plan which should be analyzed to associate results with single case runs.
     * @param {string} reportsPath
     *   The path to the junit XML file or directory of files.
     * @param {boolean} logCoverage
     *   whether to log coverage info into console
     */
    this.report = async function({runId, planId, reportsPath, logCoverage}) {

        debug('Attempting to report runs for test cases.')

        let testRailManager = new TestRailManager({testRailUrl, testRailUser, testRailPassword, debug})
        await testRailManager.setup({runId, planId})

        let caseRunMapManager = new CaseRunMapManager({debug})
        caseRunMapManager.loadMapFromFile('./testrail-cli.json')

        let jUnitReportsManager = new JUnitReportsManager({debug})
        let caseRuns = jUnitReportsManager.loadCasesFromReportsPath(reportsPath)

        let reportDispatcher = new ReportDispatcher({debug})
        let planResults = reportDispatcher.dispatch({
            caseRuns,
            resolveCaseIdsFromCaseRun: caseRunMapManager.resolveCaseIdsFromCaseRun,
            resolveTestRunsFromCasId : testRailManager  .resolveTestRunsFromCasId,
        })

        if (logCoverage) {
            caseRunMapManager.logCoverage()
        }

        // Post results if we had any.
        if (planResults.length > 0) {
            for (let runId of Object.keys(planResults)) {
                let testResults = planResults[runId]
                await testRailManager.sendReport({runId, testResults, attempts: 3})
            }
        }
        else {
            console.log('Could not map any result')
        }
    }
}

module.exports = Core