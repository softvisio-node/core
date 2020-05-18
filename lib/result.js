// const process = require("process");
var STATUS = {};

if ( !process.browser ) {
    const fs = require( "./fs" );

    STATUS = { ...fs.config.read( __dirname + "/../resources/status.json" ), ...fs.config.read( __dirname + "/../resources/status-websockets.json" ) };
}

class Result {
    status = 0;
    reason = "";
    data = null;

    static IS_RESULT = 1;

    toString () {
        return `${this.status} ${this.reason}`;
    }

    setStatus ( status ) {
        if ( Array.isArray( status ) ) {
            this.status = status[0];

            this.reason = status[1];
        }
        else {
            this.status = status;
        }

        if ( !this.reason ) {
            this.reason = STATUS[this.status];
        }
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

module.exports = function () {
    if ( arguments[0] == null ) {
        return new Result( 500 );
    }

    // object
    if ( typeof arguments[0] === "object" ) {
        // plain object, convert to Result class
        if ( arguments[0].constructor === Object ) {
            return Object.assign( new Result(), arguments[0] );
        }

        // Result object, inherit status and reason, override data
        else if ( arguments[0].constructor.IS_RESULT ) {
            const res = new Result();

            res.status = arguments[0].status;
            res.reason = arguments[0].reason;
            res.data = arguments[1];

            return res;
        }
    }

    const res = new Result();

    res.setStatus( arguments[0] );

    res.data = arguments[1];

    return res;
};
