import { objectIsPlain } from "#lib/utils";

export default class Csv {
    #header;
    #headerRow;
    #encoding;

    #buffer = "";
    #pos = 0;
    #line = 0;
    #firstRow = true;
    #rowLength;
    #row = [];

    constructor ( { header, headerRow = true, encoding } = {} ) {
        this.#header = header;
        this.#headerRow = headerRow;
        this.#encoding = encoding;
    }

    // static
    static stringify ( rows, { header, headerRow } = {} ) {
        const csv = new this( { header, headerRow } );

        const data = csv.stringify( rows );

        return data;
    }

    static parse ( buffer, { header, headerRow, encoding } = {} ) {
        const csv = new this( { header, headerRow, encoding } );

        const data = csv.parse( buffer );

        if ( !csv.isComplete ) throw `CSV is not complete`;

        return data;
    }

    // properties
    get isComplete () {
        return this.#buffer.length === this.#pos;
    }

    // public
    stringify ( rows ) {
        const data = [];

        if ( !Array.isArray( rows ) ) rows = [rows];

        for ( let row of rows ) {
            if ( !row ) continue;

            const rowIsObject = objectIsPlain( row );

            if ( this.#firstRow ) {
                this.#firstRow = false;

                const header = rowIsObject ? Object.keys( row ) : null;

                this.#rowLength = rowIsObject ? header.length : row.length;

                if ( typeof this.#header === "function" ) {
                    this.#header = this.#header( header );
                }
                else {
                    this.#header ??= header;
                }

                // write header row
                if ( this.#header && this.#headerRow ) {
                    const fields = [];

                    for ( let n = 0; n < this.#header.length; n++ ) {
                        if ( this.#header[n] == null ) continue;

                        fields.push( this.#stringifyField( this.#header[n] ) );
                    }

                    data.push( fields.join( "," ) + "\n" );
                }
            }

            const fields = [];

            if ( this.#header ) {
                for ( let n = 0; n < this.#header.length; n++ ) {
                    if ( this.#header[n] == null ) continue;

                    // object
                    if ( rowIsObject ) {
                        fields.push( this.#stringifyField( row[this.#header[n]] ) );
                    }

                    // array
                    else {
                        fields.push( this.#stringifyField( row[n] ) );
                    }
                }
            }
            else {
                if ( rowIsObject ) row = Object.values( row );

                for ( let n = 0; n < this.#rowLength; n++ ) {
                    fields.push( this.#stringifyField( row[n] ) );
                }
            }

            data.push( fields.join( "," ) + "\n" );
        }

        return data.join( "" );
    }

    // XXX
    parse ( buffer ) {
        if ( Buffer.isBuffer( buffer ) ) buffer = buffer.toString( this.#encoding );

        if ( this.#buffer ) {
            this.#buffer += buffer;
        }
        else {
            this.#buffer = buffer;
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
                if ( this.#headerRow ) {
                    if ( typeof this.#header === "function" ) {
                        this.#header = this.#header( row );
                    }
                    else {
                        this.#header ??= row;
                    }

                    continue;
                }
                else if ( typeof this.#header === "function" ) {
                    this.#header = this.#header();
                }
            }

            // object
            if ( this.#header ) {
                const data = {};

                for ( let n = 0; n < this.#header.length; n++ ) {
                    if ( this.#header[n] == null ) continue;

                    data[this.#header[n]] = row[n];
                }

                rows.push( data );
            }

            // array
            else {
                if ( row.length !== this.#rowLength ) {
                    row.length = this.#rowLength;
                }

                rows.push( row );
            }
        }

        if ( this.isComplete ) {
            this.#buffer = "";
        }
        else {
            this.#buffer = this.#buffer.substring( 0, this.#pos );
        }

        this.#pos = 0;

        return rows;
    }

    // private
    #stringifyField ( field ) {
        if ( field == null ) {
            return "";
        }

        field = field + "";

        if ( /[",\r\n]/.test( field ) ) {
            field.replaceAll( '"', '""' );

            field = '"' + field + '"';
        }

        return field;
    }

    // XXX
    #parseRow () {
        while ( true ) {

            // eof
            if ( this.isComplete ) break;

            const field = this.#parseField();

            // incomplete field
            if ( field == null ) return;

            this.#row.push( field );

            // eof
            if ( this.isComplete ) {
                break;
            }

            // ,
            else if ( this.#buffer[this.#pos] === "," ) {
                this.#pos++;
            }

            // \r
            else if ( this.#buffer[this.#pos] === "\r" ) {
                this.#pos++;

                // \r\n
                if ( this.#buffer[this.#pos] === "\r" ) {
                    this.#pos++;
                }

                break;
            }

            // \n
            else if ( this.#buffer[this.#pos] === "\n" ) {
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
            hasDoubleQuotes,
            complete,
            pos;

        if ( this.#buffer[start] === '"' ) {
            quoted = true;
            start++;
        }

        for ( pos = start; pos < this.#buffer.length; pos++ ) {
            const char = this.#buffer[pos];

            if ( char === '"' ) {

                // double quote
                if ( this.#buffer[pos + 1] === '"' ) {
                    pos++;
                    hasDoubleQuotes = true;
                }
                else if ( quoted ) {
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
                    if ( this.#buffer[pos] === "\n" ) {
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

        if ( complete ) {
            var field;

            if ( quoted ) {
                field = this.#buffer.substring( start, pos - 1 );
            }
            else {
                field = this.#buffer.substring( start, pos );
            }

            this.#pos = pos;

            if ( hasDoubleQuotes ) field = field.replaceAll( '""', '"' );

            return field;
        }
    }
}
