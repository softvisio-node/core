const { isPlainObject } = require( "../util" );
const { OBJECT_IS_RESULT } = require( "../const" );
const { objectIsResult } = require( "../util" );
const STATUS = { ...require( __dirname + "/../../resources/status.json" ), ...require( __dirname + "/../../resources/status-websockets.json" ) };

const RESERVED_PROPERTIES = {
    "status": true,
    "reason": true,
    "isException": true,
    "toJSON": true,
};

class Result {
    static [OBJECT_IS_RESULT] = true;

    #status = 0;
    #isException = false;
    reason = "";
    data;

    constructor ( status, data, props ) {
        this.status = status;

        this.data = data;

        if ( props ) {
            for ( const prop in props ) {
                if ( RESERVED_PROPERTIES[prop] ) throw Error( `Reserved property "${prop}" used in result` );

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

        // drop isException property
        if ( this.ok ) this.isException = false;

        if ( !this.reason ) this.reason = STATUS[this.#status];

        if ( !this.reason ) {
            if ( this.is1xx ) this.reason = STATUS[100];
            else if ( this.is2xx ) this.reason = STATUS[200];
            else if ( this.is3xx ) this.reason = STATUS[300];
            else if ( this.is4xx ) this.reason = STATUS[400];
            else this.reason = STATUS[500];
        }
    }

    get isException () {
        return this.#isException;
    }

    set isException ( isException ) {
        if ( this.ok ) {
            this.#isException = false;
        }
        else {
            this.#isException = !!isException;
        }
    }

    // METHODS
    toString () {
        return `${this.status} ${this.reason}`;
    }

    toJSON () {
        return Object.assign( {
            "status": this.#status,
            "isException": this.#isException,
        },
        this );
    }

    // STATUS PROPS
    get ok () {
        return this.#status >= 200 && this.#status < 300;
    }

    get isError () {
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

function result ( status, data, props ) {
    var res;

    // Result object, inherit status and reason, override data
    if ( objectIsResult( status ) ) res = new Result( [status.status, status.reason], data, props );
    else res = new Result( status, data, props );

    return res;
}

function exception ( status, data, props ) {
    var res;

    // Result object, inherit status and reason, override data
    if ( objectIsResult( status ) ) res = new Result( [status.status, status.reason], data, props );
    else res = new Result( status, data, props );

    res.isException = true;

    return res;
}

function tryResult ( res ) {
    try {
        if ( res == null ) {
            return new Result( 200 );
        }
        else if ( objectIsResult( res ) ) {
            return res;
        }
        else if ( Array.isArray( res ) ) {
            return new Result( ...res );
        }
        else {
            return new Result( res );
        }
    }
    catch ( e ) {
        console.error( e );

        return exception( 500 );
    }
}

function catchResult ( e ) {
    var res;

    try {
        if ( e == null ) {
            console.log( Error( "Exception" ) );

            res = new Result( 500 );
        }
        else if ( objectIsResult( e ) ) {
            res = e;
        }
        else if ( Array.isArray( e ) ) {
            res = new Result( ...e );
        }
        else if ( e instanceof Error ) {
            console.log( e );

            // res = new Result( [500, e.message] );
            res = new Result( 500 );
        }
        else if ( typeof e === "string" ) {
            console.log( Error( e ) );

            // res = new Result( [500, e] );
            res = new Result( 500 );
        }
        else {
            res = new Result( e );
        }
    }
    catch ( e ) {
        console.error( e );

        res = new Result( 500 );
    }

    res.isException = true;

    return res;
}

function parseResult ( res ) {
    var _res;

    if ( isPlainObject( res ) ) {
        try {
            _res = new Result( [res.status, res.reason], null, res );

            _res.isException = res.isException;
        }
        catch ( e ) {
            console.error( e );

            _res = exception( [500, "Invalid API response"] );
        }
    }
    else {
        _res = exception( [500, "Invalid API response"] );
    }

    return _res;
}

module.exports = result;
module.exports.Result = Result;
module.exports.result = result;
module.exports.exception = exception;
module.exports.tryResult = tryResult;
module.exports.catchResult = catchResult;
module.exports.parseResult = parseResult;
