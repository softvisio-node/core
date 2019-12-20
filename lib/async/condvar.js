const CallableInstance = require( "callable-instance" );

class Condvar extends CallableInstance {
    constructor () {
        super( "send" );

        this.i = 0;
        this.res = undefined;
        this.cb = null;
        this.resolved = null;
    }

    begin () {
        this.i++;

        return this;
    }

    end () {
        this.i--;

        if ( this.i === 0 ) this.send();

        return this;
    }

    send () {
        this.res = arguments;

        if ( !this.resolved ) {
            this.resolved = 1;

            var cb = this.cb;

            if ( cb ) {
                delete this.cb;

                cb( this.res );
            }
        }
    }

    async recv () {
        if ( this.resolved ) {
            return this.res;
        }
        else {
            var promise = new Promise( ( resolve ) => {
                this.cb = resolve;
            } );

            return promise;
        }
    }
}

module.exports = function () {
    return new Condvar();
};
