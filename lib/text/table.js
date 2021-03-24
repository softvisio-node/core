const DEFAULT_MAX_WIDTH = 80;
const DEFAULT_STYLE = "ascii";

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

module.exports = class Table {
    #maxWidth;
    #lazyHeader;
    #console;

    #topLine;
    #headerRow;
    #headerLine;
    #dataRow;
    #dataLine;
    #bottomLine;

    #columns = {};
    #columnsIndex = [];

    #headerWritten;
    #firstRow = true;
    #text;

    constructor ( options = {} ) {
        const style = STYLES[options.style] ?? STYLES[DEFAULT_STYLE];

        options = { ...style, ...options };

        this.#console = options.console;

        this.#maxWidth = options.maxWidth || ( process.stdout.columns ? process.stdout.columns : null ) || DEFAULT_MAX_WIDTH;

        this.#lazyHeader = options.lazyHeader;

        this.#topLine = options.topLine;
        this.#headerRow = options.headerRow;
        this.#headerLine = options.headerLine;
        this.#dataRow = options.dataRow;
        this.#dataLine = options.dataLine;
        this.#bottomLine = options.bottomLine;

        var totalWidth = 0,
            totalFlex = 0;

        for ( const id in options.columns ) {
            this.#columnsIndex.push( id );

            const column = { ...options.columns[id], id, "index": this.#columnsIndex.length - 1 };

            this.#columns[id] = column;

            if ( column.width ) totalWidth += column.width;
            else totalFlex += column.flex || 1;
        }

        // calculate columns width
        if ( totalFlex ) {
            for ( const column of Object.values( this.#columns ) ) {
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
            this.#columnsIndex.map( id => this.#columns[id].title ),
            true );

        this.#renderLine( this.#headerLine );
    }

    add ( row ) {
        if ( !this.#headerWritten ) this.#writeHeader();

        if ( !this.#firstRow ) this.#renderLine( this.#dataLine );
        else this.#firstRow = false;

        this.#renderRow( this.#dataRow, row, false );

        return this;
    }

    end () {
        this.#renderLine( this.#bottomLine );
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

    #renderLine ( line ) {
        var buf = "";

        if ( line == null ) return;

        buf += line[0] ?? " ";

        buf += this.#columnsIndex.map( id => ( line[1] || " " ).repeat( this.#columns[id].width - 1 ) ).join( line[2] || " " );

        buf += line[3] ?? " ";

        this.#addLine( buf );
    }

    #renderRow ( style, data, isHeader ) {
        var buf = "";

        if ( style != null ) buf += style[0] ?? " ";

        if ( style != null ) buf += style[3] ?? " ";

        this.#addLine( buf );
    }
};
