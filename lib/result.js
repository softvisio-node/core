const { IS_RESULT } = require( "./const" );

var STATUS = {};

if ( !process.browser ) {
    const fs = require( "./fs" );

    STATUS = { ...fs.config.read( __dirname + "/../resources/status.json" ), ...fs.config.read( __dirname + "/../resources/status-websockets.json" ) };
}

class Result {
    static [IS_RESULT] = true;

    status = 0;
    reason = "";
    data = null;

    constructor ( status, data ) {
        this.setStatus( status );

        this.data = data;
    }

    toString () {
        return `${this.status} ${this.reason}`;
    }

    setStatus ( status ) {
        if ( Array.isArray( status ) ) {
            if ( typeof status[0] != "number" ) throw Error( `Result status "${status}" is not a number` );

            this.status = status[0];

            this.reason = status[1];
        }
        else {
            if ( typeof status != "number" ) throw Error( `Result status "${status}" is not a number` );

            this.status = status;
        }

        if ( !this.reason ) this.reason = STATUS[this.status];
    }

    isInfo () {
        return this.status < 200;
    }

    isSuccess () {
        return this.status >= 200 && this.status < 300;
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

function res () {
    // object
    if ( typeof arguments[0] === "object" ) {
        // plain object, convert to Result class
        if ( arguments[0].constructor === Object ) {
            return Object.assign( new Result( 0 ), arguments[0] );
        }

        // Result object, inherit status and reason, override data
        else if ( arguments[0].constructor[IS_RESULT] ) {
            return new Result( [arguments[0].status, arguments[0].reason], arguments[1] );
        }
    }

    return new Result( arguments[0], arguments[1] );
}

module.exports = res;
module.exports.res = res;

module.exports.parseRes = function ( result ) {
    try {
        if ( Array.isArray( result ) ) {
            return new Result( ...result );
        }
        else if ( typeof result === "object" && result.constructor[IS_RESULT] ) {
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
};
