import "#index";

import CondVar from "#lib/threads/condvar";
import Semaphore from "#lib/threads/semaphore";
import { ansi, Table } from "#lib/text";

const OPTIMIZATION_ITERATIONS = 25;
const MEM_FIELDS_ALL = ["rss", "heapTotal", "heapUsed", "arrayBuffers", "external"];
const MEM_FIELDS_HEAP = ["rss", "heapTotal", "heapUsed"];

class Test {
    #mem;
    #memIteration = 0;
    #memTime;

    constructor () {
        this.reset();
    }

    async bench ( tests, iterations, threads ) {
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

    // memory
    reset () {
        this.#mem = process.memoryUsage();

        this.#memIteration = 0;

        this.#memTime = new Date().getTime();
    }

    compare ( title ) {
        this.#compare( ["rss"], title );
    }

    compareAll ( title ) {
        this.#compare( MEM_FIELDS_ALL, title );
    }

    compareHeap ( title ) {
        this.#compare( MEM_FIELDS_HEAP, title );
    }

    #compare ( fields, title ) {
        const mem = process.memoryUsage();
        const time = new Date().getTime();
        this.#memIteration++;

        console.log( `Iteration: ${this.#memIteration}, delay: ${( ( time - this.#memTime ) / 1000 ).toFixed( 2 )} sec.${title ? ", " + title : ""}:` );

        const table = new Table( {
            "console": true,
            "columns": {
                "name": { "title": ansi.hl( "Name" ), "width": 14, "margin": [1, 1] },
                "value": { "title": ansi.hl( "Value (MB)" ), "width": 12, "align": "right" },
                "delta": { "title": ansi.hl( "Delta (MB)" ), "width": 12, "align": "right" },
            },
        } );

        for ( const name of fields ) {
            const value = ( mem[name] / 1000000 ).toFixed( 2 );
            const delta = ( ( mem[name] - this.#mem[name] ) / 1000000 ).toFixed( 2 );

            table.add( {
                name,
                value,
                "delta": delta > 0 ? ansi.error( " +" + delta + " " ) : ansi.ok( " " + delta + " " ),
            } );
        }

        table.end();

        this.#mem = mem;
        this.#memTime = time;
    }
}

export default new Test();
