import Counter from "#lib/threads/counter";
import ThreadsPool from "#lib/threads/pool";
import { ansi, Table } from "#lib/text";
import Monitoring from "#lib/devel/monitoring";

const WARMING_UP_ITERATIONS = 100;

class Benchmark {
    #tests;
    #warmingUpIterations;
    #iterations;
    #time;
    #threads;

    constructor ( tests, { warmingUpIterations, iterations, time, threads } = {} ) {
        this.#tests = tests;
        this.#warmingUpIterations = warmingUpIterations || WARMING_UP_ITERATIONS;
        this.#iterations = iterations;
        this.#time = time;
        this.#threads = threads;

        if ( !this.iterations && !this.time ) throw `Iterations or time is required`;
    }

    get warmingUpIterations () {
        return this.#warmingUpIterations;
    }

    get iterations () {
        return this.#iterations;
    }

    get time () {
        return this.#time;
    }

    get threads () {
        return this.#threads;
    }

    // public
    async run ( options, parent ) {
        console.log( `Iterations: ${ this.iterations }, time (seconds): ${ this.time }, threads: ${ this.threads }` );

        const meta = {};

        // detect async tests
        for ( const name of Object.keys( this.#tests ) ) {

            // skip disabled test
            if ( name.charAt( 0 ) === "_" ) continue;

            meta[ name ] = {
                name,
                "test": this.#tests[ name ],
                "iterations": this.warmingUpIterations,
                "maxDuration": null,
                "threads": 1,
                "async": false,
                "totalDuration": 0, // ms
                "avgDuration": 0, // ms / iteration
                "avgSpeed": 0, // iterations / ms
            };
        }

        // warming up
        for ( const name in meta ) {
            process.stdout.write( `Warming up "${ name }" (${ meta[ name ].async ? "async" : "sync" }, ${ this.warmingUpIterations } iterations) ... ` );

            await this.#bench( meta[ name ] );

            console.log( result( 200 ) + "" );

            meta[ name ].iterations = this.iterations;

            if ( this.time ) {
                meta[ name ].maxDuration = this.time * 1_000;
            }

            meta[ name ].threads = this.threads;
        }

        const table = this.#createBenchTable();

        var baseSpeed;

        // main tests cycle
        for ( const name in meta ) {
            await this.#bench( meta[ name ] );

            let relSpeed;

            if ( baseSpeed == null ) {
                baseSpeed = meta[ name ].avgSpeed;
            }
            else {
                relSpeed = meta[ name ].avgSpeed / baseSpeed;
            }

            table.add( {
                name,
                "iterations": meta[ name ].iterations,
                "duration": meta[ name ].totalDuration,
                "speed": meta[ name ].avgSpeed,
                relSpeed,
            } );
        }

        table.end();

        // matrix
        // this.#speedMatrix( meta );
    }

    printStatus ( options, parent ) {
        if ( !options.benchmarks ) return;

        const indent = parent.isModule ? " ".repeat( 3 ) : " ".repeat( 5 );

        if ( this.isSkipped ) {
            if ( options.showSkipped ) console.log( `${ indent }○ ${ this.name } ${ this._formatStatusText( this.result.statusText ) }` );
        }
        else if ( this.result.ok ) {
            console.log( `${ indent }${ ansi.brightGreen( "√" ) } ${ this.name }` );
        }
        else if ( !this.result.ok ) {
            console.log( `${ indent }${ ansi.brightRed( "×" ) } ${ this.name }` );
        }
    }

    // private
    async #bench ( meta ) {
        meta.totalDuration = 0; // ms
        meta.avgDuration = 0; // ms per iterations
        meta.avgSpeed = 0; // iterations per ms

        const test = meta.test;

        let iterations = 0,
            totalDuration = 0; // ms

        // test async
        if ( meta.async == null ) {
            const res = this.#tests[ name ]();

            if ( res instanceof Promise ) {
                await res;

                meta.async = true;
            }
            else {
                meta.async = false;
            }
        }

        // sync
        if ( !meta.async ) {
            while ( true ) {
                iterations++;

                const monitoring = new Monitoring();

                test();

                totalDuration += monitoring.mark().duration;

                if ( meta.iterations && iterations >= meta.iterations ) {
                    break;
                }
                else if ( meta.maxDuration && totalDuration >= meta.maxDuration ) {
                    break;
                }
            }
        }

        // async, 1 thread
        else if ( !meta.threads || meta.threads === 1 ) {
            while ( true ) {
                iterations++;

                const monitoring = new Monitoring();

                await test();

                totalDuration += monitoring.mark().duration;

                if ( meta.iterations && iterations >= meta.iterations ) {
                    break;
                }
                else if ( meta.maxDuration && totalDuration >= meta.maxDuration ) {
                    break;
                }
            }
        }

        // async, infinity threads
        else if ( meta.threads === Infinity ) {
            if ( meta.iterations <= 0 ) throw `Iterations must be > 0`;

            iterations = meta.iterations;

            const counter = new Counter();

            const monitoring = new Monitoring();

            for ( let j = 1; j <= iterations; j++ ) {
                counter.value++;

                test().then( () => counter.value-- );
            }

            await counter.wait();

            totalDuration = monitoring.mark().duration;
        }

        // async, multiple threds
        else {
            if ( meta.iterations <= 0 ) throw `Iterations must be > 0`;

            iterations = meta.iterations;

            const threadsPool = new ThreadsPool( { "maxRunningThreads": meta.threads, "maxWaitingThreads": Infinity } ).pause();

            const counter = new Counter();

            // create threads pool
            for ( let j = 1; j <= iterations; j++ ) {
                counter.value++;

                threadsPool.runThread( test ).then( () => counter.value-- );
            }

            const monitoring = new Monitoring();

            // run threads
            threadsPool.resume();

            await counter.wait();

            totalDuration = monitoring.mark().duration;
        }

        meta.iterations = iterations;

        meta.totalDuration = totalDuration; // ms
        meta.avgDuration = meta.totalDuration / meta.iterations; // ms / iterations
        meta.avgSpeed = meta.iterations / meta.totalDuration; // iterations / ms
    }

    #createBenchTable () {
        return new Table( {
            "console": true,
            "columns": {
                "name": {
                    "title": ansi.hl( "Name" ),
                    "width": 20,
                    "margin": [ 1, 1 ],
                },
                "iterations": {
                    "title": ansi.hl( "Iterations" ),
                    "width": 14,
                    "headerAlign": "center",
                    "align": "right",
                    "format": value => new Intl.NumberFormat( "en-US" ).format( value ),
                },
                "duration": {
                    "title": ansi.hl( "Duration\n(sec.)" ),
                    "width": 12,
                    "headerAlign": "center",
                    "align": "right",
                    "format": value => new Intl.NumberFormat( "en-US", { "minimumFractionDigits": 3 } ).format( value / 1000 ),
                },
                "speed": {
                    "title": ansi.hl( "Speed\n(iter./sec.)" ),
                    "width": 25,
                    "headerAlign": "center",
                    "align": "right",
                    "format": value => new Intl.NumberFormat( "en-US", { "minimumFractionDigits": 3 } ).format( value * 1000 ),
                },
                "relSpeed": {
                    "title": ansi.hl( "Relative\nSpeed" ),
                    "width": 15,
                    "headerAlign": "center",
                    "align": "right",
                    "format": this.#formatSpeed.bind( this ),
                },
            },
        } );
    }

    #formatSpeed ( value ) {
        if ( value == null ) {
            return "-";
        }
        else {
            if ( value < 1 ) value = 0 - 1 / value;

            const text = new Intl.NumberFormat( "en-US", { "minimumFractionDigits": 2, "maximumFractionDigits": 2 } ).format( value );

            if ( value > 0 ) return ansi.ok( " +" + text + "x " );
            else if ( value < 0 ) return ansi.error( " " + text + "x " );
            else return text + "x ";
        }
    }

    #speedMatrix ( meta ) {
        const width = 15;

        const matrix = new Table( {
            "console": true,
            "columns": {
                "__header__": {
                    width,
                },
                ...Object.fromEntries( Object.values( meta ).map( meta => [
                    meta.name,
                    {
                        "title": ansi.hl( meta.name ),
                        width,
                        "headerAlign": "center",
                        "align": "right",
                        "format": this.#formatSpeed.bind( this ),
                    },
                ] ) ),
            },
        } );

        for ( const test1 in meta ) {
            const row = {
                "__header__": test1,
            };

            for ( const test2 in meta ) {
                if ( test1 === test2 ) row[ test2 ] = null;
                else row[ test2 ] = meta[ test1 ].avgSpeed / meta[ test2 ].avgSpeed;
            }

            matrix.add( row );
        }

        matrix.end();
    }
}

export default async function benchmark ( tests, { warmingUpIterations, iterations, time, threads } = {} ) {
    const bench = new Benchmark( tests, {
        warmingUpIterations,
        iterations,
        time,
        threads,
    } );

    return bench.run();
}
