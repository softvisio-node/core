const { OBJECT_IS_RESULT } = require( "./const" );
const { objectIsResult } = require( "./util" );
const STATUS = { ...require( __dirname + "/../resources/status.json" ), ...require( __dirname + "/../resources/status-websockets.json" ) };

class Result {
    static [OBJECT_IS_RESULT] = true;

    status = 0;
    reason = "";
    isProtocolError = false;
    data = null;

    constructor ( status, data, fields ) {
        this._setStatus( status );

        this.data = data;

        if ( fields ) Object.assign( this, fields );
    }

    toString () {
        return `${this.status} ${this.reason}`;
    }

    _setStatus ( status ) {
        if ( Array.isArray( status ) ) {
            if ( typeof status[0] != "number" ) throw Error( `Result status "${status}" is not a number` );

            this.status = status[0];

            this.reason = status[1];
        }
        else {
            if ( typeof status != "number" ) throw Error( `Result status "${status}" is not a number` );

            this.status = status;
        }

        if ( this.status < 0 ) {
            this.status = 0 - this.status;

            this.isProtocolError = true;
        }
        else {
            this.isProtocolError = false;
        }

        if ( !this.reason ) this.reason = STATUS[this.status];
    }

    _isOk () {
        return this.status >= 200 && this.status < 300;
    }

    // STATUS METHODS
    isInfo () {
        return this.status < 200;
    }

    isRedirect () {
        return this.status >= 300 && this.status < 400;
    }

    isError () {
        return this.status >= 400;
    }

    isClientError () {
        return this.status >= 400 && this.status < 500;
    }

    isServerError () {
        return this.status >= 500;
    }
}

const PROXY = {
    get ( target, name ) {
        if ( name === "ok" ) {
            return target._isOk();
        }
        else {
            return target[name];
        }
    },

    set ( target, name, value ) {
        if ( name === "status" ) {
            target._setStatus( value );
        }
        else if ( name === "isProtocolError" ) {
            target.isProtocolError = !!value;
        }
        else {
            target[name] = value;
        }

        return true;
    },
};

function result () {

    // object
    if ( typeof arguments[0] === "object" ) {

        // plain object, convert to Result class
        if ( arguments[0].constructor === Object ) {
            return new Proxy( Object.assign( new Result( 0 ), arguments[0] ), PROXY );
        }

        // Result object, inherit status and reason, override data
        else if ( objectIsResult( arguments[0] ) ) {
            return new Proxy( new Result( [arguments[0].status, arguments[0].reason], arguments[1], arguments[2] ), PROXY );
        }
    }

    return new Proxy( new Result( arguments[0], arguments[1], arguments[2] ), PROXY );
}

function parseResult ( result ) {
    try {
        if ( Array.isArray( result ) ) {
            return new Proxy( new Result( ...result ), PROXY );
        }
        else if ( objectIsResult( result ) ) {
            return result;
        }
        else {
            return new Proxy( new Result( result ), PROXY );
        }
    }
    catch ( e ) {
        console.error( e );

        return new Proxy( new Result( 500 ), PROXY );
    }
}

function parseError ( result ) {
    try {
        if ( result == null ) {
            return new Proxy( new Result( 500 ), PROXY );
        }
        if ( Array.isArray( result ) ) {
            return new Proxy( new Result( ...result ), PROXY );
        }
        else if ( typeof result === "object" ) {
            if ( objectIsResult( result ) ) {
                return result;
            }
            else {
                return new Proxy( new Result( [500, result.message] ), PROXY );
            }
        }
        else {
            return new Result( typeof result === "number" ? result : [500, result] );
        }
    }
    catch ( e ) {
        console.error( e );

        return new Proxy( new Result( 500 ), PROXY );
    }
}

module.exports = result;
module.exports.result = result;
module.exports.parseResult = parseResult;
module.exports.parseError = parseError;
