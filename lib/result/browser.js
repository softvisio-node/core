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
    }

    get isProtocolError () {
        return this.#isProtocolError;
    }

    get ok () {
        return this.#status >= 200 && this.#status < 300;
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
    get isInfo () {
        return this.#status < 200;
    }

    get isRedirect () {
        return this.#status >= 300 && this.#status < 400;
    }

    get isError () {
        return this.#status >= 400;
    }

    get isClientError () {
        return this.#status >= 400 && this.#status < 500;
    }

    get isServerError () {
        return this.#status >= 500;
    }
}

function result () {

    // object
    if ( typeof arguments[0] === "object" ) {

        // plain object, convert to Result class
        if ( arguments[0].constructor === Object ) {
            return Object.assign( new Result( 0 ), arguments[0] );
        }

        // Result object, inherit status and reason, override data
        else if ( objectIsResult( arguments[0] ) ) {
            return new Result( [arguments[0].status, arguments[0].reason], arguments[1], arguments[2] );
        }
    }

    return new Result( arguments[0], arguments[1], arguments[2] );
}

function convertResult ( res ) {
    if ( typeof res === "object" && res.constructor === Object ) {
        const status = [res.isProtocolError ? 0 - res.status : res.status, res.reason];

        delete res.status;
        delete res.reason;
        delete res.isProtocolError;

        try {
            return new Result( status, null, res );
        }
        catch ( e ) {
            return new Result( [500, "Invalid api response"] );
        }
    }
    else {
        return new Result( [500, "Invalid api response"] );
    }
}

function parseResult ( result ) {
    try {
        if ( Array.isArray( result ) ) {
            return new Result( ...result );
        }
        else if ( objectIsResult( result ) ) {
            return result;
        }
        else {
            return new Result( result );
        }
    }
    catch ( e ) {
        console.error( e );

        return new Result( 500 );
    }
}

function parseError ( result ) {
    try {
        if ( result == null ) {
            return new Result( 500 );
        }
        if ( Array.isArray( result ) ) {
            return new Result( ...result );
        }
        else if ( typeof result === "object" ) {
            if ( objectIsResult( result ) ) {
                return result;
            }
            else {
                return new Result( [500, result.message] );
            }
        }
        else {
            return new Result( typeof result === "number" ? result : [500, result] );
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
module.exports.parseResult = parseResult;
module.exports.parseError = parseError;
