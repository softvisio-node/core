module.exports = class Result {
    status = null;

    reason = null;

    data = null;

    constructor ( status ) {
        // if ststus is plain object
        if ( typeof status === "object" && status.constructor === Object ) {
            Object.assign( this, status );
        }
        else {
            this.setStatus( status );
        }
    }

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

            this.reason = "";
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
};
