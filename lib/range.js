export default class Range {
    #start;
    #end;
    #length;

    constructor ( { start, end, length } = {} ) {
        if ( start < 0 || start > 0 ) {
            this.#start = start;
        }
        else {
            this.#start = 0;
        }

        this.#end = end;
        this.#length = length;
    }

    // properties
    get start () {
        return this.#start;
    }

    get end () {
        return this.#end;
    }

    get length () {
        return this.#length;
    }

    // public
    calculate ( contentLength, { strict } = {} ) {
        let start, end;

        if ( contentLength == null ) {

            // XXX
            // if ( this.start < 0 ) {
            //     return;
            // }
            // else {
            //     start = this.start;
            // }

            return;
        }
        else {
            if ( this.start < 0 ) {
                start = contentLength + this.start;
            }
            else {
                start = this.start;
            }

            if ( start < 0 ) {
                if ( strict ) {
                    return;
                }
                else {
                    start = 0;
                }
            }

            if ( start > contentLength ) {
                if ( strict ) {
                    return;
                }
                else {
                    start = contentLength;
                }
            }

            if ( this.end == null ) {
                if ( this.length == null ) {
                    end = contentLength;
                }
                else {
                    end = start + this.length;
                }
            }
            else if ( this.end < 0 ) {
                end = contentLength + this.end;
            }
            else {
                end = this.end;
            }

            if ( end < start ) {
                return;
            }
            else if ( end > contentLength ) {
                if ( strict ) {
                    return;
                }
                else {
                    end = contentLength;
                }
            }
        }

        return {
            start,
            end,
            "length": end - start,
        };
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "start": this.start,
        };

        if ( this.end != null ) {
            spec.end = this.end;
        }
        else if ( this.length != null ) {
            spec.end = this.length;
        }

        return "Range: " + inspect( spec );
    }
}
