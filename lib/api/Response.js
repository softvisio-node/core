export default class softvisioApiResponse {
    status = null;

    reason = null;

    data = null;

    static create ( obj ) {
        if ( obj ) {
            Object.setPrototypeOf( obj, this.prototype );

            return obj;
        }

        return Object.create( this.prototype );
    }

    constructor ( status ) {
        if ( Array.isArray( status ) ) {
            this.status = status[0];

            this.reason = status[1];
        }
        else {
            this.status = status;

            this.reason = "";
        }
    }

    toString () {
        return `${this.status} ${this.reason}`;
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
