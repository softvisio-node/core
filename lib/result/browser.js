const { isPlainObject } = require( "../util" );
const { OBJECT_IS_RESULT } = require( "../const" );
const { objectIsResult } = require( "../util" );
const STATUS = { ...require( __dirname + "/../../resources/status.json" ), ...require( __dirname + "/../../resources/status-websockets.json" ) };

class Result {
    static [OBJECT_IS_RESULT] = true;

    #status = 0;
    #isProtocolError = false;
    reason = "";
    data = null;

    constructor ( status, data, fields ) {
        this.status = status;

        this.data = data;

        if ( fields ) Object.assign( this, fields );
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

        if ( this.#status < 0 ) {
            this.#status = 0 - this.#status;

            this.#isProtocolError = this.ok ? false : true;
        }
        else {
            this.#isProtocolError = false;
        }

        if ( !this.reason ) this.reason = STATUS[this.#status];

        if ( !this.reason ) {
            if ( this.is1xx ) this.reason = STATUS[100];
            else if ( this.is2xx ) this.reason = STATUS[200];
            else if ( this.is3xx ) this.reason = STATUS[300];
            else if ( this.is4xx ) this.reason = STATUS[400];
            else this.reason = STATUS[500];
        }
    }

    // METHODS
    toString () {
        return `${this.status} ${this.reason}`;
    }

    toJSON () {
        return Object.assign( {
            "status": this.#status,
            "isProtocolError": this.#isProtocolError,
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

    get isProtocolError () {
        return this.#isProtocolError;
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

function result ( status, data, fields ) {

    // Result object, inherit status and reason, override data
    if ( objectIsResult( status ) ) {
        return new Result( [status.status, status.reason], data, fields );
    }

    return new Result( status, data, fields );
}

function convertResult ( res ) {
    if ( isPlainObject( res ) ) {
        const status = [res.isProtocolError ? 0 - res.status : res.status, res.reason];

        delete res.status;
        delete res.reason;
        delete res.isProtocolError;

        try {
            return new Result( status, null, res );
        }
        catch ( e ) {
            console.error( e );

            return new Result( [500, "Invalid api response"] );
        }
    }
    else {
        return new Result( [500, "Invalid api response"] );
    }
}

function tryResult ( res ) {
    try {
        if ( res == null ) {
            return new Result( 500 );
        }
        else if ( Array.isArray( res ) ) {
            return new Result( ...res );
        }
        else if ( objectIsResult( res ) ) {
            return res;
        }
        else {
            return new Result( res );
        }
    }
    catch ( e ) {
        console.error( e );

        return new Result( 500 );
    }
}

function catchResult ( e ) {
    try {
        if ( e == null ) {
            console.log( Error( "Exception" ) );

            return new Result( 500 );
        }
        else if ( Array.isArray( e ) ) {
            return new Result( ...e );
        }
        else if ( objectIsResult( e ) ) {
            return e;
        }
        else if ( e instanceof Error ) {
            console.log( e );

            // return new Result( [500, e.message] );
            return new Result( 500 );
        }
        else if ( typeof e === "string" ) {
            console.log( Error( e ) );

            // return new Result( [500, e] );
            return new Result( 500 );
        }
        else {
            return new Result( e );
        }
    }
    catch ( e ) {
        console.error( e );

        return new Result( 500 );
    }
}

module.exports = result;
module.exports.Result = Result;
module.exports.result = result;
module.exports.convertResult = convertResult;
module.exports.tryResult = tryResult;
module.exports.catchResult = catchResult;
