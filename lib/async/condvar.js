class Condvar extends Function {
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
    var cv = function () {
        cv.send( arguments );
    };

    cv.i = 0;
    cv.res = undefined;
    cv.cb = null;
    cv.resolved = null;

    Object.setPrototypeOf( cv, Condvar.prototype );

    return cv;
};
