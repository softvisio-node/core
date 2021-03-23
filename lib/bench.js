/** summary: Benchmark functions.
 * description: '```const bench = require("@softvisio/core/bench");```'
 */

const { PerformanceObserver, performance } = require( "perf_hooks" );
const CondVar = require( "./threads/condvar" );
const Semaphore = require( "./threads/semaphore" );

/** function: benchSync
 * summary: Bench sync.
 * params:
 *   - name: "n"
 *     summary: Number of iterations.
 *     required: true
 *     schema:
 *       type: number
 *       minValue: 1
 *   - name: tests
 *     schema:
 *       type: object
 *       additionalProperties:
 *         type: function
 *       minProperties: 1
 */
module.exports.benchSync = function ( n, tests ) {
    for ( const name in tests ) {
        const obs = new PerformanceObserver( function ( list ) {
            const duration = list.getEntries()[0].duration;

            console.log( `${name.padEnd( 15, " " )} - ${( ( n / duration ) * 1000 ).toFixed( 2 )} iterations / second (${n} / ${( duration / 1000 ).toFixed( 2 )} sec.)` );

            performance.clearMarks();

            obs.disconnect();
        } );

        obs.observe( { "entryTypes": ["measure"] } );

        const func = tests[name];

        performance.mark( "A" );

        for ( let j = 1; j <= n; j++ ) {
            func();
        }

        performance.mark( "B" );

        performance.measure( name, "A", "B" );
    }
};

/** function: benchAsync
 * summary: Bench async.
 * params:
 *   - name: "n"
 *     summary: Number of iterations.
 *     required: true
 *     schema:
 *       type: number
 *       minValue: 1
 *   - name: threads
 *     required: true
 *     schema:
 *       type: number
 *   - name: tests
 *     schema:
 *       type: object
 *       additionalProperties:
 *         type: function
 *       minProperties: 1
 */
module.exports.benchAsync = async function ( n, threads, tests ) {
    for ( const name in tests ) {
        const obs = new PerformanceObserver( function ( list ) {
            const duration = list.getEntries()[0].duration;

            console.log( `${name.padEnd( 15, " " )} - ${( ( n / duration ) * 1000 ).toFixed( 2 )} iterations / second (${n} / ${( duration / 1000 ).toFixed( 2 )} sec.)` );

            performance.clearMarks();

            obs.disconnect();
        } );

        obs.observe( { "entryTypes": ["measure"] } );

        const func = tests[name];

        performance.mark( "A" );

        // no threads
        if ( !threads ) {
            const cv = new CondVar().begin();

            for ( let j = 1; j <= n; j++ ) {
                cv.begin();

                func().then( () => cv.end() );
            }

            await cv.end().recv();
        }

        // 1 thread
        else if ( threads === 1 ) {
            for ( let j = 1; j <= n; j++ ) {
                await func();
            }
        }

        // multiple threds
        else {
            const wrapper = new Semaphore( { "maxThreads": threads } );

            const cv = new CondVar().begin();

            for ( let j = 1; j <= n; j++ ) {
                cv.begin();

                wrapper.runThread( func ).then( () => cv.end() );
            }

            await cv.end().recv();
        }

        performance.mark( "B" );

        performance.measure( name, "A", "B" );
    }
};

module.exports.benchApi = async function benchApi ( threads, requestsPerThread, apiUrl, connect, request ) {
    const Api = require( "./api" ),
        connections = [],
        stat = {};

    var t0 = new Date(),
        cv = new CondVar().begin();

    for ( let n = 0; n < threads; n++ ) {
        cv.begin();

        const api = new Api( apiUrl );

        connections.push( api );

        if ( connect ) await connect( api );

        cv.end();
    }

    cv.end().recv();

    var duration = ( new Date() - t0 ) / 1000;

    console.log( `Connections: ${duration.toFixed( 2 )} seconds, ${( threads / duration ).toFixed( 2 )} connections / second` );

    if ( !request ) return;

    cv = new CondVar().begin();
    duration = 0;

    for ( let n = 0; n < threads; n++ ) {
        cv.begin();

        const api = connections.shift();

        for ( let r = 0; r < requestsPerThread; r++ ) {
            t0 = new Date();

            const res = await request( api );

            duration += new Date() - t0;

            if ( !stat[res.status] ) stat[res.status] = 0;
            stat[res.status]++;
        }

        cv.end();
    }

    cv.end().recv();

    const totalRequests = threads * requestsPerThread;
    duration = duration / 1000;

    console.log( `Total requests: ${totalRequests}` );
    console.log( `Total duration: ${duration.toFixed( 2 )} seconds` );
    console.log( `Performance: ${( totalRequests / duration ).toFixed( 2 )} requests / second` );

    console.log( stat );
};
