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
    calculate ( length, { strict } = {} ) {
        let start, end;

        if ( length == null ) {

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
                start = length + this.start;
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

            if ( start < length ) {
                if ( strict ) {
                    return;
                }
                else {
                    start = length;
                }
            }

            if ( this.end == null ) {
                if ( this.length == null ) {
                    end = length;
                }
                else {
                    end = start + this.length;
                }
            }
            else if ( this.end < 0 ) {
                end = length + this.end;
            }
            else {
                end = this.end;
            }

            if ( end < start ) {
                return;
            }
            else if ( end > length ) {
                if ( strict ) {
                    return;
                }
                else {
                    end = length;
                }
            }
        }

        return {
            start,
            end,
            "length": end - start,
        };
    }
}
