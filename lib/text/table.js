import Events from "#lib/events";
import ansi from "#lib/text/ansi";
import wrap from "#lib/text/wrap";

const DEFAULT_WIDTH = 80,
    DEFAULT_STYLE = "ascii",
    DEFAULT_MARGIN = [ 0, 0 ],
    DEFAULT_TRIM = false,
    DEFAULT_WORD_WRAP = true,
    DEFAULT_MIN_WIDTH = 10,
    ALIGN_ALIASES = {
        "left": "left",
        "start": "left",
        "center": "center",
        "right": "right",
        "end": "right",
    },
    VALIGN_ALIASES = {
        "top": "top",
        "start": "top",
        "center": "center",
        "bottom": "bottom",
        "end": "bottom",
    };

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

export default class Table extends Events {
    #stream;
    #style;
    #header;
    #width;
    #ansi;
    #columns = [];

    #started;
    #ended;
    #headerRendered;
    #firstRow = true;
    #content = "";

    constructor ( { style, width, header, ansi, columns, trim, wordWrap, columnWidth, margin, headerAlign, headerValign, align, valign } ) {
        super();

        this.#style = STYLES[ style ] ?? STYLES[ DEFAULT_STYLE ];
        this.#header = header ?? true;
        this.#width = width;
        this.#ansi = ansi;

        if ( Array.isArray( columns ) ) {
            columns = columns.reduce( ( accumulator, column, index ) => {
                accumulator[ index ] = column;

                return accumulator;
            }, {} );
        }

        for ( const id in columns ) {
            const column = { ...columns[ id ], id };

            this.#columns.push( column );

            column.width ??= columnWidth;

            const colunnMargin = column.margin ?? margin ?? DEFAULT_MARGIN;

            column.marginLeft = colunnMargin[ 0 ];
            column.marginRight = colunnMargin[ 1 ];

            column.trim ??= trim ?? DEFAULT_TRIM;
            column.wordWrap ??= wordWrap ?? DEFAULT_WORD_WRAP;

            column.headerAlign = ALIGN_ALIASES[ column.headerAlign ] || ALIGN_ALIASES[ headerAlign ];
            column.headerValign = VALIGN_ALIASES[ column.headerValign ] || VALIGN_ALIASES[ headerValign ];
            column.align = ALIGN_ALIASES[ column.align ] || ALIGN_ALIASES[ align ];
            column.valign = VALIGN_ALIASES[ column.valign ] || VALIGN_ALIASES[ valign ];
        }
    }

    // static
    static defineStyle ( name, style ) {
        STYLES[ name ] = style;
    }

    // properties
    get hasContent () {
        return !!this.#content.length;
    }

    get content () {
        return this.#content;
    }

    // public
    begin () {
        this.#begin();

        this.#renderHeader();

        return this;
    }

    add ( ...rows ) {
        this.#begin();

        for ( const row of rows ) {
            if ( !this.#firstRow ) {
                this.#renderLine( this.#style.dataLine );
            }
            else {
                this.#firstRow = false;
            }

            this.#renderRow( this.#style.dataRow, row, false );
        }

        return this;
    }

    end () {
        if ( !this.#ended ) {
            this.#ended = true;

            this.#begin();

            // render last line
            if ( this.hasContent ) {
                this.#renderLine( this.#style.bottomLine );
            }

            this.emit( "end", this );
        }

        return this;
    }

    // XXX
    pipe ( stream ) {
        this.#stream = stream;

        this.#begin();

        if ( this.#stream && this.hasContent ) {
            this.#stream.write( this.content );
        }

        return this;
    }

    // private
    // XXX
    #begin () {
        if ( this.#started ) return;
        this.#started = true;

        this.#ansi ??= this.#stream?.isTTY ?? false;

        const leftBorderWidth = this.#style.topLine?.[ 0 ] || this.#style.headerRow?.[ 0 ] || this.#style.headerLine?.[ 0 ] || this.#style.dataRow?.[ 0 ] || this.#style.dataLine?.[ 0 ] || this.#style.bottomLine?.[ 0 ]
                ? 1
                : 0,
            rightBorderWidth = this.#style.topLine?.[ 3 ] || this.#style.headerRow?.[ 3 ] || this.#style.headerLine?.[ 3 ] || this.#style.dataRow?.[ 3 ] || this.#style.dataLine?.[ 3 ] || this.#style.bottomLine?.[ 3 ]
                ? 1
                : 0,
            internalBorderWidth = this.#style.topLine?.[ 2 ] || this.#style.headerRow?.[ 2 ] || this.#style.headerLine?.[ 2 ] || this.#style.dataRow?.[ 2 ] || this.#style.dataLine?.[ 2 ] || this.#style.bottomLine?.[ 2 ]
                ? 1
                : 0;

        var width = this.#width || this.#stream?.columns || DEFAULT_WIDTH;
        width -= leftBorderWidth + rightBorderWidth + internalBorderWidth + internalBorderWidth * this.#columns.length;

        var totalWidth = 0,
            freeWidth = 0,
            totalFlex = 0;

        for ( const column of Object.values( this.#columns ) ) {
            if ( column.width ) {
                totalWidth += column.width;
            }
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
    }

    #renderHeader () {
        var buf = "";

        if ( this.#headerRendered ) return buf;

        this.#headerRendered = true;

        buf += this.#renderLine( this.#style.topLine );

        if ( !this.#header ) return buf;

        buf += this.#renderRow(
            this.#style.headerRow,
            this.#columns.map( column => column.title ),
            true
        );

        this.#renderLine( this.#style.headerLine );

        return buf;
    }

    #renderLine ( style ) {
        var buf = "";

        if ( style == null ) return buf;

        buf += style[ 0 ] ?? "";

        buf += this.#columns.map( column => ( style[ 1 ] || "" ).repeat( column.width ) ).join( style[ 2 ] || "" );

        buf += style[ 3 ] ?? "";

        return this.#addLine( buf );
    }

    #renderRow ( style, data, isHeader ) {
        const cells = [];
        let index = -1,
            height = 0;

        for ( const column of this.#columns ) {
            index++;

            const value = Array.isArray( data )
                ? data[ index ]
                : data[ column.id ];

            const lines = this.#wrapColumn( column, value, isHeader, data );

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
                const valign = isHeader
                    ? cell.column.headerValign || cell.column.valign
                    : cell.column.valign;

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
                else {
                    paddingBottom = padding;
                }

                if ( paddingTop ) cell.lines.unshift( ...new Array( paddingTop ).fill( line ) );
                if ( paddingBottom ) cell.lines.push( ...new Array( paddingBottom ).fill( line ) );
            }
        }

        var row = "";

        for ( let n = 0; n < height; n++ ) {
            let buf = "";

            buf += style?.[ 0 ] ?? "";

            buf += cells.map( cell => cell.lines.shift() ).join( style?.[ 2 ] ?? "" );

            buf += style?.[ 3 ] ?? "";

            row += this.#addLine( buf );
        }

        return row;
    }

    #addLine ( line ) {
        if ( line == null ) return "";

        line += "\n";

        this.#content += line;

        if ( this.#stream ) this.#stream.write( line );

        this.emit( "data", line );

        return line;
    }

    #wrapColumn ( column, value, isHeader, row ) {
        if ( column.format && !isHeader ) value = column.format( value, row );

        var maxWidth = column.contentWidth;

        // stringify value
        if ( value == null ) value = "";
        else value += "";

        if ( !this.#ansi ) value = ansi.remove( value );

        value = wrap( value, maxWidth, { "trim": column.trim, "wordWrap": column.wordWrap } );

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
                const align = isHeader
                        ? column.headerAlign || column.align
                        : column.align,
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
