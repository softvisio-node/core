import CondVar from "#lib/threads/condvar";
import Semaphore from "#lib/threads/semaphore";
import { ansi, Table } from "#lib/text";

const MEM_FIELDS_ALL = ["rss", "heapTotal", "heapUsed", "arrayBuffers", "external"];
const MEM_FIELDS_HEAP = ["rss", "heapTotal", "heapUsed"];

class Test {
    #mem;
    #memIteration = 0;
    #memTime;

    constructor () {
        this.reset();
    }

    async bench ( tests, n, threads ) {
        return this.#bench( tests, n, async test => {

            // 1 thread
            if ( !threads || threads === 1 ) {
                for ( let j = 1; j <= n; j++ ) {
                    await test();
                }
            }

            // infinitt threads
            else if ( threads === Infinity ) {
                const cv = new CondVar().begin();

                for ( let j = 1; j <= n; j++ ) {
                    cv.begin();

                    test().then( () => cv.end() );
                }

                await cv.end().recv();
            }

            // multiple threds
            else {
                const semaphore = new Semaphore( { "maxThreads": threads } );

                const res = result( 200 );

                const wrapper = async () => {
                    await test();

                    return res;
                };

                const cv = new CondVar().begin();

                for ( let j = 1; j <= n; j++ ) {
                    cv.begin();

                    semaphore.runThread( wrapper ).then( () => cv.end() );
                }

                await cv.end().recv();
            }
        } );
    }

    async api ( threads, requestsPerThread, apiUrl, connect, request ) {
        const { "default": Api } = await import( "#lib/api" ),
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
    }

    async #bench ( tests, n, runner ) {
        const table = this.#createBenchTable();

        // warming up
        for ( const test of Object.values( tests ) ) await runner( test );

        var baseSpeed;

        for ( const name in tests ) {
            performance.mark( "A" );

            await runner( tests[name] );

            performance.mark( "B" );

            const measure = performance.measure( name, "A", "B" );

            const duration = measure.duration;

            const speed = ( n / duration ) * 1000;

            let relSpeed;

            if ( baseSpeed == null ) {
                baseSpeed = speed;

                relSpeed = 1;
            }
            else {
                relSpeed = speed > baseSpeed ? speed / baseSpeed : 0 - baseSpeed / speed;
            }

            table.add( {
                name,
                duration,
                speed,
                relSpeed,
            } );

            performance.clearMarks();
        }

        table.end();
    }

    #createBenchTable () {
        return new Table( {
            "console": true,
            "columns": {
                "name": { "title": ansi.hl( "Name" ), "width": 20, "margin": [1, 1] },
                "duration": { "title": ansi.hl( "Duration\n(sec.)" ), "width": 15, "headerAlign": "center", "align": "right", "format": value => ( value / 1000 ).toFixed( 2 ) },
                "speed": { "title": ansi.hl( "Speed\n(iter./sec.)" ), "width": 15, "headerAlign": "center", "align": "right", "format": value => value.toFixed( 0 ) },
                "relSpeed": {
                    "title": ansi.hl( "Relative\nSpeed" ),
                    "width": 15,
                    "headerAlign": "center",
                    "align": "right",
                    format ( value ) {
                        const text = " " + value.toFixed( 2 ) + " ";

                        if ( value > 1 ) return ansi.ok( text );
                        else if ( value < 1 ) return ansi.error( text );
                        else return text;
                    },
                },
            },
        } );
    }

    // MEMORY
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
