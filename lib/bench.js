const { PerformanceObserver, performance } = require( "perf_hooks" );

module.exports = function ( n, tests ) {
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

        for ( let j = 0; j <= n; j++ ) {
            func();
        }

        performance.mark( "B" );

        performance.measure( name, "A", "B" );
    }
};
