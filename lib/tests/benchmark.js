import runner from "#lib/tests/runner";
import CondVar from "#lib/threads/condvar";
import Semaphore from "#lib/threads/semaphore";
import { ansi, Table } from "#lib/text";

const OPTIMIZATION_ITERATIONS = 100;

class Benchmark {
    #module;
    #group;
    #name;
    #tests;
    #iterations;
    #threads;
    #skip;

    constructor ( name, tests, iterations, threads, options = {} ) {
        this.#name = name;
        this.#tests = tests;
        this.#iterations = iterations;
        this.#threads = threads;

        this.#skip = !!options.skip;
    }

    get isBenchmark () {
        return true;
    }

    get type () {
        return "benchmark";
    }

    get module () {
        return this.#module;
    }

    set module ( value ) {
        this.#module = value;
    }

    get group () {
        return this.#group;
    }

    set group ( value ) {
        this.#group = value;
    }

    get name () {
        return this.#name;
    }

    get iterations () {
        return this.#iterations;
    }

    get threads () {
        return this.#threads;
    }

    get skip () {
        return this.#skip;
    }

    // public
    async run () {
        var tests = this.#tests,
            iterations = this.#iterations,
            threads = this.#threads;

        console.log( `Iterations: ${iterations}, threads: ${threads}` );

        const meta = {};

        // detect async tests
        for ( const name of Object.keys( tests ) ) {

            // skip disabled test
            if ( name.charAt( 0 ) === "_" ) continue;

            meta[name] = {
                name,
                "test": tests[name],
                "iterations": OPTIMIZATION_ITERATIONS,
                threads,
                "async": false,
                "totalDuration": 0, // ms
                "avgDuration": 0, // ms / iteration
                "avgSpeed": 0, // iterations / ms
            };

            const res = tests[name]();

            if ( res instanceof Promise ) {
                await res;

                meta[name].async = true;
            }
        }

        // optimization
        for ( const name in meta ) {
            process.stdout.write( `Optimization test "${name}" (${meta[name].async ? "async" : "sync"}, ${OPTIMIZATION_ITERATIONS} iterations) ... ` );

            await this.#bench( meta[name] );

            console.log( result( 200 ) + "" );

            meta[name].iterations = iterations;
        }

        const table = this.#createBenchTable();

        var baseSpeed;

        // main tests cycle
        for ( const name in meta ) {
            await this.#bench( meta[name] );

            let relSpeed;

            if ( baseSpeed == null ) {
                baseSpeed = meta[name].avgSpeed;

                relSpeed = 1;
            }
            else {
                relSpeed = meta[name].avgSpeed > baseSpeed ? meta[name].avgSpeed / baseSpeed : 0 - baseSpeed / meta[name].avgSpeed;
            }

            table.add( {
                name,
                "iterations": meta[name].iterations,
                "duration": meta[name].totalDuration,
                "speed": meta[name].avgSpeed,
                relSpeed,
            } );

            performance.clearMarks();
        }

        table.end();
    }

    // private
    async #bench ( meta ) {
        meta.totalDuration = 0; // ms
        meta.avgDuration = 0; // ms / iterations
        meta.avgSpeed = 0; // iterations / ms

        const test = meta.test,
            maxDuration = BigInt( Math.abs( meta.iterations ) * 1000000 );

        let iterations = 0,
            totalDuration = 0n; // ns

        // sync
        if ( !meta.async ) {
            while ( 1 ) {
                iterations++;

                const t0 = process.hrtime.bigint();

                await test();

                const t1 = process.hrtime.bigint();

                totalDuration += t1 - t0;

                if ( meta.iterations > 0 && iterations >= meta.iterations ) break;
                else if ( meta.iterations <= 0 && totalDuration >= maxDuration ) break;
            }
        }

        // 1 thread
        else if ( !meta.threads || meta.threads === 1 ) {
            while ( 1 ) {
                iterations++;

                const t0 = process.hrtime.bigint();

                await test();

                const t1 = process.hrtime.bigint();

                totalDuration += t1 - t0;

                if ( meta.iterations > 0 && iterations >= meta.iterations ) break;
                else if ( meta.iterations <= 0 && totalDuration >= maxDuration ) break;
            }
        }

        // infinity threads
        else if ( meta.threads === Infinity ) {
            if ( meta.iterations <= 0 ) throw `Iterations must be > 0`;

            iterations = meta.iterations;

            const cv = new CondVar().begin();

            const t0 = process.hrtime.bigint();

            for ( let j = 1; j <= iterations; j++ ) {
                cv.begin();

                test().then( () => {
                    cv.end();
                } );
            }

            await cv.end().recv();

            const t1 = process.hrtime.bigint();

            totalDuration += t1 - t0;
        }

        // multiple threds
        else {
            if ( meta.iterations <= 0 ) throw `Iterations must be > 0`;

            iterations = meta.iterations;

            const semaphore = new Semaphore( { "maxThreads": meta.threads } );

            const res = result( 200 );

            const wrapper = async () => {
                await test();

                return res;
            };

            const cv = new CondVar().begin();

            const t0 = process.hrtime.bigint();

            for ( let j = 1; j <= iterations; j++ ) {
                cv.begin();

                semaphore.runThread( wrapper ).then( () => cv.end() );
            }

            await cv.end().recv();

            const t1 = process.hrtime.bigint();

            totalDuration += t1 - t0;
        }

        meta.iterations = iterations;

        meta.totalDuration = Number( totalDuration ) / 1000000; // ms
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
                    "margin": [1, 1],
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
                    format ( value ) {
                        const text = " " + new Intl.NumberFormat( "en-US", { "minimumFractionDigits": 3 } ).format( value ) + " ";

                        if ( value > 1 ) return ansi.ok( text );
                        else if ( value < 1 ) return ansi.error( text );
                        else return text;
                    },
                },
            },
        } );
    }
}

export default function bench ( name, tests, iterations, threads ) {
    runner.add( new Benchmark( name, tests, iterations, threads ) );
}

global.bench = bench;

Object.defineProperty( bench, "skip", {
    value ( name, tests, iterations, threads ) {
        runner.add( new Benchmark( name, tests, iterations, threads, { "skip": true } ) );
    },
} );
