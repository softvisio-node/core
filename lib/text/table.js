import ansi from "#lib/text/ansi";

const DEFAULT_WIDTH = 140;
const DEFAULT_STYLE = "ascii";
const DEFAULT_MARGIN = [0, 0];
const DEFAULT_TRIM = false;
const DEFAULT_WORD_WRAP = true;
const DEFAULT_MIN_WIDTH = 10;

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
    "borderless": {
        "topLine": null,
        "headerRow": null,
        "headerLine": null,
        "dataRow": null,
        "dataLine": null,
        "bottomLine": null,
    },
    "compact": {
        "topLine": null,
        "headerRow": "  | ",
        "headerLine": " =+ ",
        "dataRow": "  | ",
        "dataLine": null,
        "bottomLine": null,
    },
    "markdown": {
        "topLine": null,
        "headerRow": "|-||",
        "headerLine": "|-||",
        "dataRow": "|-||",
        "dataLine": null,
        "bottomLine": null,
    },
};

export default class Table {
    #console;
    #header;
    #lazy;
    #ansi;
    #style;

    #columns = [];

    #headerWritten;
    #firstRow = true;
    #hasContent;
    #text;

    constructor ( options = {} ) {
        this.#style = STYLES[options.style] ?? STYLES[DEFAULT_STYLE];

        const leftBorderWidth = this.#style.topLine?.[0] || this.#style.headerRow?.[0] || this.#style.headerLine?.[0] || this.#style.dataRow?.[0] || this.#style.dataLine?.[0] || this.#style.bottomLine?.[0] ? 1 : 0,
            rightBorderWidth = this.#style.topLine?.[3] || this.#style.headerRow?.[3] || this.#style.headerLine?.[3] || this.#style.dataRow?.[3] || this.#style.dataLine?.[3] || this.#style.bottomLine?.[3] ? 1 : 0,
            internalBorderWidth = this.#style.topLine?.[2] || this.#style.headerRow?.[2] || this.#style.headerLine?.[2] || this.#style.dataRow?.[2] || this.#style.dataLine?.[2] || this.#style.bottomLine?.[2] ? 1 : 0;

        var width;

        if ( options.console ) {
            this.#console = true;

            width = options.width || ( process.stdout.columns ? process.stdout.columns : null ) || DEFAULT_WIDTH;
        }
        else {
            width = options.width || DEFAULT_WIDTH;
        }

        width -= leftBorderWidth + rightBorderWidth + internalBorderWidth + internalBorderWidth * Object.values( options.columns ).length;

        this.#header = options.header ?? true;
        this.#lazy = options.lazy;
        this.#ansi = options.ansi ?? ( this.#console ? process.stdout.isTTY : false );

        var totalWidth = 0,
            freeWidth = 0,
            totalFlex = 0;

        for ( const id in options.columns ) {
            const column = { ...options.columns[id], id };

            this.#columns.push( column );

            const margin = column.margin ?? options.margin ?? DEFAULT_MARGIN;

            column.marginLeft = margin?.[0] || 0;
            column.marginRight = margin?.[1] || 0;

            column.trim ??= options.trim ?? DEFAULT_TRIM;
            column.wordWrap ??= options.wordWrap ?? DEFAULT_WORD_WRAP;

            column.width ??= options.columnWidth;

            column.headerAlign ??= options.headerAlign;
            column.headerValign ??= options.headerValign;
            column.align ??= options.align;
            column.valign ??= options.valign;

            if ( column.width ) totalWidth += column.width;
            else {
                column.flex ||= 1;

                totalFlex += column.flex;
            }
        }

        freeWidth = width - totalWidth;

        // calculate columns width
        for ( const column of this.#columns ) {
            if ( !column.width ) {
                column.width = Math.floor( freeWidth * ( column.flex / totalFlex ) );

                if ( column.width < ( column.minWidth || 1 ) ) column.width = column.minWidth || DEFAULT_MIN_WIDTH;

                freeWidth -= column.width;
                totalFlex -= column.flex;
            }

            column.contentWidth = column.width - column.marginLeft - column.marginRight;
        }

        if ( this.#header && !this.#lazy ) this.#renderHeader();
    }

    // static
    static defineStyle ( name, style ) {
        STYLES[name] = style;
    }

    // properties
    get hasContent () {
        return this.#hasContent;
    }

    get text () {
        return this.#text;
    }

    // public
    add ( ...rows ) {
        this.#hasContent = true;

        if ( !this.#headerWritten ) this.#renderHeader();

        for ( const row of rows ) {
            if ( !this.#firstRow ) this.#renderLine( this.#style.dataLine );
            else this.#firstRow = false;

            this.#renderRow( this.#style.dataRow, row, false );
        }

        return this;
    }

    end () {
        if ( this.#hasContent ) this.#renderLine( this.#style.bottomLine );

        return this.text;
    }

    // private
    #renderHeader () {
        if ( this.#headerWritten ) return;

        this.#headerWritten = true;
        this.#hasContent = true;

        this.#renderLine( this.#style.topLine );

        if ( this.#header ) {
            this.#renderRow( this.#style.headerRow,
                this.#columns.map( column => column.title ),
                true );

            this.#renderLine( this.#style.headerLine );
        }
    }

    #renderLine ( style ) {
        var buf = "";

        if ( style == null ) return;

        buf += style[0] ?? "";

        buf += this.#columns.map( column => ( style[1] || "" ).repeat( column.width ) ).join( style[2] || "" );

        buf += style[3] ?? "";

        this.#addLine( buf );
    }

    #renderRow ( style, data, isHeader ) {
        const cells = [];
        let index = -1,
            height = 0;

        for ( const column of this.#columns ) {
            index++;

            const value = Array.isArray( data ) ? data[index] : data[column.id];

            const lines = this.#wrapColumn( column, value, isHeader );

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
                const valign = isHeader ? cell.column.headerValign || cell.column.valign : cell.column.valign;

                const line = " ".repeat( cell.column.width ),
                    padding = height - cell.height;

                let paddingTop, paddingBottom;

                // center
                if ( valign === "center" ) {
                    paddingTop = Math.floor( padding / 2 );
                    paddingBottom = padding - paddingTop;
                }

                // bottom
                else if ( valign === "bottom" ) {
                    paddingTop = padding;
                }

                // top
                else paddingBottom = padding;

                if ( paddingTop ) cell.lines.unshift( ...new Array( paddingTop ).fill( line ) );
                if ( paddingBottom ) cell.lines.push( ...new Array( paddingBottom ).fill( line ) );
            }
        }

        for ( let n = 0; n < height; n++ ) {
            let buf = "";

            buf += style?.[0] ?? "";

            buf += cells.map( cell => cell.lines.shift() ).join( style?.[2] ?? "" );

            buf += style?.[3] ?? "";

            this.#addLine( buf );
        }
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

    #wrapColumn ( column, value, isHeader ) {
        if ( column.format && !isHeader ) value = column.format( value );

        var maxWidth = column.contentWidth;

        // stringify value
        value += "";

        if ( !this.#ansi ) value = ansi.remove( value );

        value = ansi.wrap( value, maxWidth, { "hard": true, "trim": column.trim, "wordWrap": column.wordWrap } );

        const lines = [];

        for ( let line of value.split( "\n" ) ) {
            let length;

            if ( this.#ansi ) {
                length = ansi.remove( line ).length;
            }
            else {
                length = line.length;
            }

            // padding and align
            if ( length < maxWidth ) {
                const align = isHeader ? column.headerAlign || column.align : column.align,
                    padding = maxWidth - length;

                let paddingLeft, paddingRight;

                // align right
                if ( align === "right" ) {
                    paddingLeft = padding;
                }

                // align center
                else if ( align === "center" ) {
                    paddingLeft = Math.floor( padding / 2 );
                    paddingRight = padding - paddingLeft;
                }

                // align left
                else {
                    paddingRight = padding;
                }

                if ( paddingLeft ) line = " ".repeat( paddingLeft ) + line;
                if ( paddingRight ) line = line + " ".repeat( paddingRight );
            }

            // add margin
            if ( column.marginLeft ) line = " ".repeat( column.marginLeft ) + line;
            if ( column.marginRight ) line = line + " ".repeat( column.marginRight );

            lines.push( line );
        }

        return lines;
    }
}
