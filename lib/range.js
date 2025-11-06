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
    calculateRange ( contentLength, { strict } = {} ) {
        let start, end;

        try {

            // no content length
            if ( contentLength == null ) {

                // calculate start
                if ( this.start < 0 ) {
                    throw new Error();
                }
                else {
                    start = this.start;
                }

                // calculate end
                if ( this.end == null ) {
                    if ( this.length != null ) {
                        end = start + this.length;
                    }
                }
                else if ( this.end < 0 ) {
                    throw new Error();
                }
                else {
                    end = this.end;
                }

                // check end
                if ( end != null ) {
                    if ( end < start ) {
                        if ( strict ) {
                            throw new Error();
                        }
                        else {
                            end = start;
                        }
                    }
                }

                if ( start === 0 && end === 0 ) {
                    return {
                        start,
                        end,
                        "length": 0,
                        "maxEnd": 0,
                        "maxLength": 0,
                    };
                }
                else {
                    return {
                        start,
                        "end": undefined,
                        "length": undefined,
                        "maxEnd": end ?? undefined,
                        "maxLength": end == null
                            ? undefined
                            : end - start,
                    };
                }
            }

            // has content length
            else {

                // calculate start
                if ( this.start < 0 ) {
                    start = contentLength + this.start;
                }
                else {
                    start = this.start;
                }

                // check start
                if ( start < 0 ) {
                    if ( strict ) {
                        throw new Error();
                    }
                    else {
                        start = 0;
                    }
                }

                if ( start > contentLength ) {
                    if ( strict ) {
                        throw new Error();
                    }
                    else {
                        start = contentLength;
                    }
                }

                // calculate end
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

                // check end
                if ( end < start ) {
                    if ( strict ) {
                        throw new Error();
                    }
                    else {
                        end = start;
                    }
                }
                else if ( end > contentLength ) {
                    if ( strict ) {
                        throw new Error();
                    }
                    else {
                        end = contentLength;
                    }
                }

                end ??= undefined;

                const length = end == null
                    ? undefined
                    : end - start;

                return {
                    start,
                    end,
                    length,
                    "maxEnd": end,
                    "maxLength": length,
                };
            }
        }
        catch {
            throw new Error( "Range can not be satisfied" );
        }
    }

    // XXX
    calculateReadStreamRange ( contentLength, { strict } = {} ) {
        const range = this.calculateRange( contentLength, { strict } );

        console.log( range );

        var start = range.start,
            end = range.end ?? range.maxEnd,
            length = range.length;

        if ( range.maxLength === 0 ) {
            end = -1;
        }
        else if ( range.maxLength === 1 ) {
            end = start;
        }
        else if ( end != null ) {
            end--;
        }

        console.log( {
            start,
            end,
            length,
        } );

        return {
            start,
            end,
            length,
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
