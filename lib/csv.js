export class Csv {
    #header;

    #string = "";
    #pos = 0;
    #line = 0;
    #firstRow = true;
    #rowLength;
    #fields;
    #quoteStarted = false;
    #row = [];

    constructor ( { header = true } = {} ) {
        this.#header = header;
    }

    // properties
    get isComplete () {
        return this.#string.length === this.#pos;
    }

    // public
    parse ( string ) {
        if ( this.#string ) {
            this.#string += string;
        }
        else {
            this.#string = string;
        }

        const rows = [];

        while ( true ) {
            if ( this.isComplete ) break;

            this.#line++;

            const row = this.#parseRow();

            if ( !row ) break;

            // first row
            if ( this.#firstRow ) {
                this.#firstRow = false;
                this.#rowLength = row.length;

                // header row
                if ( this.#header ) {
                    this.#fields = row;

                    continue;
                }
            }

            if ( this.#rowLength !== row.length ) throw `CSV number of the fields is invalid in the lime: ${this.#line}`;

            if ( this.#fields ) {
                const data = {};

                for ( let n = 0; n < this.#rowLength; n++ ) {
                    data[this.#fields[n]] = row[n];
                }

                rows.push( data );
            }
            else {
                rows.push( row );
            }
        }

        if ( this.isComplete ) {
            this.#string = "";
        }
        else {
            this.#string = this.#string.substring( 0, this.#pos );
        }

        this.#pos = 0;

        return rows;
    }

    // private
    #parseRow () {
        while ( true ) {
            if ( this.isComplete ) break;

            const field = this.#parseField();

            // incomplete field
            if ( field == null ) return;

            this.#row.push( field );

            // eof
            if ( this.#pos === this.#string.length ) {
                break;
            }

            // ,
            else if ( this.#string[this.#pos] === "," ) {
                this.#pos++;
            }

            // \r
            else if ( this.#string[this.#pos] === "\r" ) {
                this.#pos++;

                // \r\n
                if ( this.#string[this.#pos] === "\r" ) {
                    this.#pos++;
                }

                break;
            }

            // \n
            else if ( this.#string[this.#pos] === "\n" ) {
                this.#pos++;

                break;
            }
            else {
                throw `CSV invalid character at line: ${this.#line}`;
            }
        }

        const row = this.#row;

        this.#row = [];

        return row;
    }

    #parseField () {
        var start = this.#pos,
            quoted,
            quoteClosed = true,
            hasDoubleQuotes,
            complete,
            pos;

        if ( this.#string[start] === '"' ) {
            quoted = true;
            quoteClosed = false;
            start++;
        }

        for ( pos = start; pos < this.#string.length; pos++ ) {
            const char = this.#string[pos];

            if ( char === '"' ) {

                // double quote
                if ( this.#string[pos + 1] === '"' ) {
                    pos++;
                    hasDoubleQuotes = true;
                }
                else if ( quoted ) {
                    quoteClosed = true;
                    pos++;
                    complete = true;
                    break;
                }
                else {
                    throw `CSV invalid quote at line: ${this.#line}`;
                }
            }
            else if ( char === "," ) {
                if ( !quoted ) {
                    complete = true;
                    break;
                }
            }
            else if ( char === "\r" ) {
                if ( !quoted ) {

                    // \r\n
                    if ( this.#string[pos] === "\n" ) {
                        pos++;
                    }

                    complete = true;
                    break;
                }
            }
            else if ( char === "\n" ) {
                if ( !quoted ) {
                    complete = true;
                    break;
                }
            }
        }

        // complete on eof
        // XXX do not use in stream
        if ( !complete && quoteClosed && this.#string.length === pos ) {
            complete = true;
        }

        if ( complete ) {
            var field;

            if ( quoted ) {
                field = this.#string.substring( start, pos - 1 );
            }
            else {
                field = this.#string.substring( start, pos );
            }

            this.#pos = pos;

            if ( hasDoubleQuotes ) field = field.replaceAll( '""', '"' );

            return field;
        }
    }
}

export function parse ( string, { encoding } = {} ) {
    if ( Buffer.isBuffer( string ) ) string = string.toString( encoding );

    const csv = new Csv();

    const data = csv.parse( string );

    if ( !csv.isComplete ) throw `CSV is not complete`;

    return data;
}
