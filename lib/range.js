export default class Range {
    #start;
    #end;
    #length;

    constructor ( { start, end, length, inclusive } = {} ) {
        if ( start < 0 || start > 0 ) {
            this.#start = start;
        }
        else {
            this.#start = 0;
        }

        this.#end = end;
        this.#length = length;

        if ( inclusive ) {
            if ( this.#end != null ) this.#end++;
        }
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
                else if ( start === end ) {
                    return {
                        start,
                        "end": undefined,
                        "length": 0,
                        "maxEnd": end ?? undefined,
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

    calculateReadStreamRange ( contentLength ) {
        const range = this.calculateRange( contentLength );

        var start = range.start,
            end = range.end ?? range.maxEnd,
            length = range.length;

        if ( range.maxLength === 0 ) {
            end = -1;
            length = 0;
        }
        else if ( range.maxLength === 1 ) {
            end = start;
        }
        else if ( end != null ) {
            end--;
        }

        return {
            start,
            end,
            length,
        };
    }

    // XXX
    calculateHttpRange ( contentLength ) {
        if ( contentLength == null ) {
            return result( 200, {
                "headers": {
                    "accept-ranges": "none",
                },
            } );
        }

        try {
            const range = this.calculateRange( contentLength, { "strict": true } );

            return result( 206, {
                range,
                "headers": {
                    "accept-ranges": "bytes",
                    "content-length": range.length,
                    "content-range": `bytes ${ range.start }-${ range.end - 1 }/${ contentLength }`,
                },
            } );
        }
        catch {
            return result( 416, {
                "headers": {
                    "accept-ranges": "bytes",
                    "content-range": `bytes */${ contentLength }`,
                },
            } );
        }
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
