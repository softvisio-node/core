const wrapAnsi = require( "wrap-ansi" );

const DEFAULT_MAX_WIDTH = 80;
const DEFAULT_STYLE = "ascii";
const DEFAULT_ANSI = true;
const DEFAULT_MARGIN = [1, 1];

const STYLES = {
    "ascii": {
        "topLine": "+-++",
        "headerRow": "| ||",
        "headerLine": "|=+|",
        "dataRow": "| ||",
        "dataLine": "|-+|",
        "bottomLine": "+-++",
    },
    "unicode": {
        "topLine": "┌─┬┐",
        "headerRow": "│ ││",
        "headerLine": "╞═╪╡",
        "dataRow": "│ ││",
        "dataLine": "├─┼┤",
        "bottomLine": "└─┴┘",
    },
    "noborder": {
        "topLine": null,
        "headerRow": null,
        "headerLine": null,
        "dataRow": null,
        "dataLine": null,
        "bottomLine": null,
    },
    "compact": {
        "topLine": null,
        "headerRow": null,
        "headerLine": "|=+|",
        "dataRow": "  | ",
        "dataLine": null,
        "bottomLine": null,
    },
    "markdown": {
        "topLine": null,
        "headerRow": null,
        "headerLine": " -| ",
        "dataRow": "  | ",
        "dataLine": null,
        "bottomLine": null,
    },
};

// eslint-disable-next-line no-control-regex
const ANSI = new RegExp( /\u001b\[.*?m/, "g" );

module.exports = class Table {
    #console;
    #maxWidth;
    #lazyHeader;
    #ansi;
    #margin;

    #topLine;
    #headerRow;
    #headerLine;
    #dataRow;
    #dataLine;
    #bottomLine;

    #columns = [];

    #headerWritten;
    #firstRow = true;
    #text;

    constructor ( options = {} ) {
        const style = STYLES[options.style] ?? STYLES[DEFAULT_STYLE];

        options = { ...style, ...options };

        this.#topLine = options.topLine;
        this.#headerRow = options.headerRow;
        this.#headerLine = options.headerLine;
        this.#dataRow = options.dataRow;
        this.#dataLine = options.dataLine;
        this.#bottomLine = options.bottomLine;

        const leftBorderWidth = this.#topLine[0] || this.#headerRow[0] || this.#headerLine[0] || this.#dataRow[0] || this.#dataLine[0] || this.#bottomLine[0] ? 1 : 0,
            rightBorderWidth = this.#topLine[3] || this.#headerRow[3] || this.#headerLine[3] || this.#dataRow[3] || this.#dataLine[3] || this.#bottomLine[3] ? 1 : 0,
            internalBorderWidth = this.#topLine[2] || this.#headerRow[2] || this.#headerLine[2] || this.#dataRow[2] || this.#dataLine[2] || this.#bottomLine[2] ? 1 : 0;

        if ( options.console ) {
            this.#console = true;

            this.#maxWidth = options.maxWidth || ( process.stdout.columns ? process.stdout.columns : null ) || DEFAULT_MAX_WIDTH;
        }
        else {
            this.#maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH;
        }

        this.#maxWidth -= leftBorderWidth + rightBorderWidth + internalBorderWidth * Object.values( options.columns ).length;

        this.#lazyHeader = options.lazyHeader;
        this.#ansi = options.ansi ?? DEFAULT_ANSI;
        this.#margin = options.margin ?? DEFAULT_MARGIN;

        var totalWidth = 0,
            totalFlex = 0;

        for ( const id in options.columns ) {
            const column = { ...options.columns[id], id };

            this.#columns.push( column );

            if ( column.width ) totalWidth += column.width;
            else totalFlex += column.flex || 1;
        }

        // calculate columns width
        if ( totalFlex ) {
            for ( const column of this.#columns ) {
                if ( column.width ) continue;

                column.width = Math.floor( ( this.#maxWidth - totalWidth ) * ( ( column.flex || 1 ) / totalFlex ) );
            }
        }

        if ( !this.#lazyHeader ) this.#writeHeader();
    }

    get text () {
        return this.#text;
    }

    #writeHeader () {
        if ( this.#headerWritten ) return;

        this.#headerWritten = true;

        this.#renderLine( this.#topLine );

        this.#renderRow( this.#headerRow,
            this.#columns.map( column => column.title ),
            true );

        this.#renderLine( this.#headerLine );
    }

    add ( ...rows ) {
        if ( !this.#headerWritten ) this.#writeHeader();

        for ( const row of rows ) {
            if ( !this.#firstRow ) this.#renderLine( this.#dataLine );
            else this.#firstRow = false;

            this.#renderRow( this.#dataRow, row, false );
        }

        return this;
    }

    end () {
        this.#renderLine( this.#bottomLine );

        return this.text;
    }

    #addLine ( line ) {
        if ( line == null ) return;

        if ( this.#console ) {
            console.log( line );
        }
        else {
            if ( this.#text == null ) this.#text = "";
            else this.#text += "\n";

            this.#text += line;
        }
    }

    #renderLine ( style ) {
        var buf = "";

        if ( style == null ) return;

        buf += style[0] ?? " ";

        buf += this.#columns.map( column => ( style[1] || " " ).repeat( column.width ) ).join( style[2] || " " );

        buf += style[3] ?? " ";

        this.#addLine( buf );
    }

    // XXX center
    #renderRow ( style, data, isHeader ) {
        const cells = [];
        let index = -1,
            height = 0;

        for ( const column of this.#columns ) {
            index++;

            let value = Array.isArray( data ) ? data[index] : data[column.id];

            if ( column.filter && !isHeader ) value = column.filter( value );

            const lines = this.#wrapColumn( column, value );

            if ( lines.length > height ) height = lines.length;

            cells.push( {
                lines,
                column,
                "height": lines.length,
            } );
        }

        // valign cells
        for ( const cell of cells ) {
            if ( cell.height < height ) {
                const line = " ".repeat( cell.column.width );

                if ( cell.column.valign === "center" ) {

                    // XXX
                }
                else if ( cell.column.valign === "bottom" ) {
                    for ( let n = 0; n < height - cell.height; n++ ) cell.lines.unshift( line );
                }
                else {
                    for ( let n = 0; n < height - cell.height; n++ ) cell.lines.push( line );
                }
            }
        }

        for ( let n = 0; n < height; n++ ) {
            let buf = "";

            buf += style?.[0] ?? " ";

            buf += cells.map( cell => cell.lines.shift() ).join( style?.[2] ?? " " );

            buf += style?.[3] ?? " ";

            this.#addLine( buf );
        }
    }

    // XXX center
    #wrapColumn ( column, value ) {
        value ??= "";

        const margin = column.margin || this.#margin;

        var maxWidth = column.width - ( margin[0] || 0 ) - ( margin[1] || 0 );

        if ( !this.#ansi ) value = value.replaceAll( ANSI, "" );

        value = wrapAnsi( value, maxWidth );

        const lines = [];

        for ( let line of value.split( "\n" ) ) {
            const length = this.#ansi ? line.replaceAll( ANSI, "" ).length : line.length;

            // padding and align
            if ( length < maxWidth ) {

                // align right
                if ( column.align === "right" ) {
                    line = " ".repeat( maxWidth - length ) + line;
                }

                // align center
                else if ( column.align === "center" ) {

                    // xxx
                }

                // align left
                else {
                    line = line + " ".repeat( maxWidth - length );
                }
            }

            // add margin
            if ( margin[0] ) line = " ".repeat( margin[0] ) + line;
            if ( margin[1] ) line = line + " ".repeat( margin[0] );

            lines.push( line );
        }

        return lines;
    }
};
