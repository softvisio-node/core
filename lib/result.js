const STATUS = { ...require( __dirname + "/../resources/status.json" ), ...require( __dirname + "/../resources/status-websockets.json" ) };

const RESERVED_PROPERTIES = new Set( ["status", "reason", "exception", "toString", "toJSON"] );

class Result {
    static result ( status, data, props ) {
        var res;

        // Result object, inherit status and reason, override data
        if ( status instanceof Result ) res = new this( [status.status, status.reason], data, props );
        else res = new this( status, data, props );

        return res;
    }

    static exception ( status, data, props ) {
        var res;

        // Result object, inherit status and reason, override data
        if ( status instanceof Result ) res = new this( [status.status, status.reason], data, props );
        else res = new this( status, data, props );

        res.exception = true;

        return res;
    }

    static tryResult ( res ) {
        if ( res == null ) {
            return new this( 200 );
        }
        else if ( res instanceof Result ) {
            return res;
        }
        else {
            console.log( Error( `Invalid return value, "Result" object is expected` ) );

            return new Result( 500 );
        }
    }

    static catchResult ( e ) {
        var res;

        if ( e instanceof Result ) {
            res = e;
        }
        else {
            console.log( e instanceof Error ? e : Error( e ) );

            res = new this( 500 );
        }

        res.exception = true;

        return res;
    }

    static parseResult ( res ) {
        var _res;

        if ( Object.isPlain( res ) ) {
            try {
                _res = new this( [res.status, res.reason] );

                for ( const prop in res ) {

                    // silently ignore reserved properties
                    if ( !RESERVED_PROPERTIES.has( prop ) ) _res[prop] = res[prop];
                }

                _res.exception = res.exception;
            }
            catch ( e ) {
                console.error( e );

                _res = this.exception( [500, "Invalid API response"] );
            }
        }
        else {
            _res = this.exception( [500, "Invalid API response"] );
        }

        return _res;
    }

    static getReason ( status ) {
        return STATUS[status];
    }

    #status = 0;
    #exception = false;
    reason = "";

    constructor ( status, data, props ) {
        this.status = status;

        this.data = data;

        if ( props ) {
            for ( const prop in props ) {
                if ( RESERVED_PROPERTIES.has( prop ) ) throw Error( `Reserved property "${prop}" is used in result constructor` );

                this[prop] = props[prop];
            }
        }
    }

    // PROPS
    get status () {
        return this.#status;
    }

    set status ( status ) {
        if ( Array.isArray( status ) ) {
            if ( typeof status[0] != "number" ) throw Error( `Result status "${status}" is not a number` );

            this.#status = status[0];

            this.reason = status[1];
        }
        else {
            if ( typeof status != "number" ) throw Error( `Result status "${status}" is not a number` );

            this.#status = status;
        }

        // drop exception property
        if ( this.ok ) this.exception = false;

        if ( !this.reason ) this.reason = STATUS[this.#status];

        if ( !this.reason ) {
            if ( this.is1xx ) this.reason = STATUS[100];
            else if ( this.is2xx ) this.reason = STATUS[200];
            else if ( this.is3xx ) this.reason = STATUS[300];
            else if ( this.is4xx ) this.reason = STATUS[400];
            else this.reason = STATUS[500];
        }
    }

    get exception () {
        return this.#exception;
    }

    set exception ( exception ) {
        if ( this.ok ) {
            this.#exception = false;
        }
        else {
            this.#exception = !!exception;
        }
    }

    // METHODS
    toString () {
        return `${this.status} ${this.reason}`;
    }

    toJSON () {
        return Object.assign( {
            "status": this.#status,
            "exception": this.#exception,
        },
        this );
    }

    // STATUS PROPS
    get ok () {
        return this.#status >= 200 && this.#status < 300;
    }

    get error () {
        return this.#status >= 400;
    }

    get is1xx () {
        return this.#status >= 300 && this.#status < 400;
    }

    get is2xx () {
        return this.#status >= 200 && this.#status < 300;
    }

    get is3xx () {
        return this.#status >= 300 && this.#status < 400;
    }

    get is4xx () {
        return this.#status >= 400 && this.#status < 500;
    }

    get is5xx () {
        return this.#status >= 500;
    }
}

module.exports = Result.result.bind( Result );
module.exports.Result = Result;
module.exports.exception = Result.exception.bind( Result );
module.exports.tryResult = Result.tryResult.bind( Result );
module.exports.catchResult = Result.catchResult.bind( Result );
module.exports.parseResult = Result.parseResult.bind( Result );
