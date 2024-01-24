import _Test from "#lib/tests/test";
import runner from "#lib/tests/runner";
import ansi from "#lib/text/ansi";

class Test extends _Test {
    #callback;
    #timeout;

    #results = [];
    #consoleLog = [];
    #duration;

    constructor ( name, callback, timeout, options = {} ) {
        super( name, options );

        this.#callback = callback;
        this.#timeout = timeout;
    }

    get isTest () {
        return true;
    }

    get duration () {
        return this.#duration;
    }

    get durationText () {
        var duration = this.#duration / 1000000;

        // < 1 ms
        if ( duration < 1 ) return duration.toFixed( 2 ) + " ms";

        // < 1 sec
        else if ( duration < 1000 ) return duration.toFixed( 0 ) + " ms";

        // < 1 minute
        else if ( duration < 60000 ) return ( duration / 1000 ).toFixed( 2 ) + " sec";

        // >= 1 min.
        else return ( duration / 60000 ).toFixed( 2 ) + " min";
    }

    plan ( options, parent ) {

        // filter
        if ( this.skip ) return;
        else if ( options.benchmarks ) return;
        else if ( parent.isModule && options.firstLevelPattern && !options.firstLevelPattern.test( this.name ) ) return this._skip( "filtered" );
        else if ( parent.isGroup && options.secondLevelPattern && !options.secondLevelPattern.test( this.name ) ) return this._skip( "filtered" );

        return { "name": this.name };
    }

    async run ( options, parent ) {
        if ( this.isTested ) throw Error( `Test is already tested` );

        this._setIsTested();

        // filter
        if ( parent.isSkipped ) return this._skip( "parent skipped" );
        else if ( this.skip ) return this._skip( "filtered" );
        else if ( options.benchmarks ) return this._skip( "filtered" );
        else if ( parent.isModule && options.firstLevelPattern && !options.firstLevelPattern.test( this.name ) ) return this._skip( "filtered" );
        else if ( parent.isGroup && options.secondLevelPattern && !options.secondLevelPattern.test( this.name ) ) return this._skip( "filtered" );

        // hook console.log
        const origConsoleLog = console.log;
        console.log = ( ...args ) => this.#consoleLog.push( args.join( " " ) );

        const t0 = process.hrtime.bigint();

        try {
            await this.#callback();
        }
        catch ( e ) {
            this.addTestResult( result( 500, {
                "message": "Unhandled exception: " + ( e.message || e + "" ),
                "stack": ( e.stack || new Error().stack )
                    .split( "\n" )
                    .slice( 1 )
                    .map( line => line.trim() )
                    .join( "\n" ),
            } ) );
        }

        this.#duration = Number( process.hrtime.bigint() - t0 );

        this.#callback = null;

        // restore console.log
        console.log = origConsoleLog;

        // no expect function was called in the test body
        if ( !this.result ) {
            this.addTestResult( result( 500, {
                "message": `No expect was called`,
            } ) );
        }
    }

    addTestResult ( res ) {
        this.#results.push( res );

        if ( res.ok ) this._setResult( result( 200 ) );
        else this._setResult( result( 500 ) );
    }

    printStatus ( options, parent ) {
        if ( options.benchmarks ) return;

        const indent = parent.isModule ? " ".repeat( 1 ) : " ".repeat( 3 );

        if ( this.isSkipped ) {
            if ( options.showSkipped ) console.log( `${ indent }○ ${ this.name } ${ this._formatStatusText( this.result.statusText ) }` );
        }
        else if ( this.result.ok ) {
            if ( options.showPassed ) console.log( `${ indent }${ ansi.brightGreen( "√" ) } ${ this.name } ${ this._formatStatusText( this.durationText ) }` );
        }
        else if ( !this.result.ok ) {
            console.log( `${ indent }${ ansi.brightRed( "×" ) } ${ this.name } ${ this._formatStatusText( this.durationText ) }` );
        }
    }

    printReport ( options, parent ) {
        if ( this.isSkipped || this.result.ok ) return;

        if ( !options.verbose ) return;

        for ( const res of this.#results ) {
            if ( res.ok ) continue;

            // report header
            console.log( `\n${ ansi.error( " ● Error Report: " ) } ${ ansi.brightRed( ( parent ? parent + " › " : "" ) + this.name ) }` );

            // error message
            console.log( res.data.message );

            // stack trace
            if ( options.showStackTrace && res.data.stack ) {
                console.log( `\n${ ansi.dark( " STACK TRACE " ) }` );
                console.log( ansi.dim( res.data.stack ) );
            }

            // console output
            if ( options.showConsoleLog ) {
                console.log( `\n${ ansi.dark( " CONSOLE OUTPUT " ) }` );
                console.log( this.#consoleLog.join( "\n" ) );
            }
        }
    }
}

export default function test ( name, callback, timeout ) {
    runner.addTest( new Test( name, callback, timeout ) );
}

Object.defineProperty( test, "skip", {
    value ( name, callback, timeout ) {
        test( name, callback, timeout, { "skip": true } );
    },
} );
