export default class StreamSearch {
    #eol;
    #eolBuffer;
    #buffer = Buffer.from( "" );
    #isEnded = false;

    constructor ( eol ) {
        this.#eol = eol;

        this.#eolBuffer = Buffer.from( this.#eol );
    }

    // properties
    get eol () {
        return this.#eol;
    }

    get buffer () {
        return this.#buffer;
    }

    get isEnded () {
        return this.#isEnded;
    }

    // public
    push ( chunk, encoding ) {
        if ( typeof chunk === "string" ) chunk = Buffer.from( chunk, encoding );

        if ( this.#buffer.length ) {
            this.#buffer = Buffer.concat( [ this.#buffer, chunk ] );
        }
        else {
            this.#buffer = chunk;
        }

        const data = [];

        var start = 0,
            end = 0;

        while ( true ) {
            if ( end >= this.#buffer.length ) {
                if ( start < end ) data.push( this.#buffer.subarray( start, end ) );

                break;
            }
            else {
                if ( this.#buffer[ end ] === this.#eolBuffer[ 0 ] ) {
                    const match = this.#match( end );

                    // full match
                    if ( match === 1 ) {
                        if ( start < end ) data.push( this.#buffer.subarray( start, end ) );
                        data.push( null );

                        start = end += this.#eolBuffer.length;

                        continue;
                    }

                    // partial match
                    else if ( match === 2 ) {
                        if ( start < end ) data.push( this.#buffer.subarray( start, end ) );

                        break;
                    }
                }
            }

            end++;
        }

        // cut processed data
        if ( end ) this.#buffer = this.#buffer.subarray( end );

        if ( data.length ) {
            if ( data.at( -1 ) === null ) {
                this.#isEnded = true;
            }
            else {
                this.#isEnded = false;
            }
        }

        return data;
    }

    end () {
        const data = this.flush();

        if ( !this.#isEnded ) {
            this.#isEnded = true;

            data.push( null );
        }

        return data;
    }

    flush () {
        if ( this.#buffer.length ) {
            const buffer = this.#buffer;
            this.#buffer = Buffer.from( "" );

            this.#isEnded = false;

            return [ buffer ];
        }
        else {
            return [];
        }
    }

    // private
    #match ( start ) {
        for ( let n = 0; n < this.#eolBuffer.length; n++ ) {

            // partial match
            if ( start + n >= this.#buffer.length ) {
                return 2;
            }

            // not match
            else if ( this.#eolBuffer[ n ] !== this.#buffer[ start + n ] ) {
                return;
            }
        }

        // match
        return 1;
    }
}
