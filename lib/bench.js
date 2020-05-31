const { PerformanceObserver, performance } = require( "perf_hooks" );
const Cv = require( "./threads/condvar" );
const Semaphore = require( "./threads/semaphore" );

module.exports.benchSync = function ( n, tests ) {
    for ( const name in tests ) {
        const obs = new PerformanceObserver( function ( list ) {
            const duration = list.getEntries()[0].duration;

            console.log( `${name + " ".repeat( 15 - name.length )} - ${( ( n / duration ) * 1000 ).toFixed( 2 )} iterations / second (${n} / ${( duration / 1000 ).toFixed( 2 )} sec.)` );

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

module.exports.benchAsync = async function ( n, threads, tests ) {
    for ( const name in tests ) {
        const obs = new PerformanceObserver( function ( list ) {
            const duration = list.getEntries()[0].duration;

            console.log( `${name + " ".repeat( 15 - name.length )} - ${( ( n / duration ) * 1000 ).toFixed( 2 )} iterations / second (${n} / ${( duration / 1000 ).toFixed( 2 )} sec.)` );

            performance.clearMarks();

            obs.disconnect();
        } );

        obs.observe( { "entryTypes": ["measure"] } );

        const func = tests[name];

        const cv = new Cv().begin(),
            wrapper = async () => {
                await func();

                cv.end();
            },
            semaphore = threads ? new Semaphore( threads ) : null;

        performance.mark( "A" );

        for ( let j = 1; j <= n; j++ ) {
            cv.begin();

            if ( threads ) {
                semaphore.runThread( wrapper );
            }
            else {
                wrapper();
            }
        }

        await cv.end().recv();

        performance.mark( "B" );

        performance.measure( name, "A", "B" );
    }
};
