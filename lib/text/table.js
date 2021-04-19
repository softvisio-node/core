const wrapAnsi = require( "wrap-ansi" );

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
    "no-border": {
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

// eslint-disable-next-line no-control-regex
const ANSI = new RegExp( /\x1B\[.*?m/, "g" );
const ANSI_RESET = "\x1b[39m\x1b[22m\u001b[49m";

/** class: Table
 * summary: Render text table.
 */
module.exports = class Table {
    #console;
    #header;
    #lazy;
    #ansi;

    #topLine;
    #headerRow;
    #headerLine;
    #dataRow;
    #dataLine;
    #bottomLine;

    #columns = [];

    #headerWritten;
    #firstRow = true;
    #hasContent;
    #text;

    /** method: constructor1
     * summary: Constructor.
     * params:
     *   - name: options
     *     schema:
     *       type: object
     *       properties:
     *         style: { type: string, enum: [ascii, unicode, markdown, compact, no-border], default: ascii, summary: Table style. }
     *         console: { type: boolean, default: false, summary: Print rendered rows to console. }
     *         ansi: { type: boolean, default: process.stdout.isTTY, summary: Alow ANSI escape characters. }
     *         width: { type: integer, default: 80, summary: Table width. If `console` set to `true` terminal width is used as default value. }
     *         lazy: { type: boolean, default: false, summary: Render table header on first row added. }
     *         header: { type: boolean, default: true, summary: Render table header. }
     *         margin:
     *           type: array
     *           items:
     *             - { type: integer, summary: Left margin. }
     *             - { type: integer, summary: Right margin. }
     *           default: [0, 0]
     *           summary: Cell content margin.
     *         trim: { type: boolean, default: false, summary: Trim cell value. }
     *         wordWrap: { type: boolean, default: true, summary: Split words at spaces. }
     *         columns:
     *           type: object
     *           properties:
     *             width: { type: integer, summary: Column width. }
     *             minWidth: { type: integer, default: 0, summary: Applied to columns with dynamic width. }
     *             flex: { type: integer, summary: Column flex. }
     *             title: { type: string, summary: Column title. }
     *             margin: { default: Table `margin`., summary: Cell content margin. }
     *             trim: { type: boolean, default: Table `trim`., summary: Trim cell value. }
     *             wordWrap: { type: boolean, default: Table `wordWrap`., summary: Split words at spaces. }
     *             align: { type: string, enum: [left, center, right], default: left, summary: Cell content horizontal align. }
     *             headerAlign: { type: string, enum: [left, center, right], default: left, summary: Column header horizontal align. }
     *             valign: { type: string, enum: [top, center, bottom], default: top, summary: Cell content vertical align. }
     *             headerValign: { type: string, enum: [top, center, bottom], default: left, summary: Column header vertical align. }
     *           additionalProperties: false
     *         topLine: { type: [string, null], summary: Line style. }
     *         headerRow: { type: [string, null], summary: Line style. }
     *         headerLine: { type: [string, null], summary: Line style. }
     *         dataRow: { type: [string, null], summary: Line style. }
     *         dataLine: { type: [string, null], summary: Line style. }
     *         bottomLine: { type: [string, null], summary: Line style. }
     *       additionalProperties: false
     */
    constructor ( options = {} ) {
        const style = STYLES[options.style] ?? STYLES[DEFAULT_STYLE];

        options = { ...style, ...options };

        this.#topLine = options.topLine;
        this.#headerRow = options.headerRow;
        this.#headerLine = options.headerLine;
        this.#dataRow = options.dataRow;
        this.#dataLine = options.dataLine;
        this.#bottomLine = options.bottomLine;

        const leftBorderWidth = this.#topLine?.[0] || this.#headerRow?.[0] || this.#headerLine?.[0] || this.#dataRow?.[0] || this.#dataLine?.[0] || this.#bottomLine?.[0] ? 1 : 0,
            rightBorderWidth = this.#topLine?.[3] || this.#headerRow?.[3] || this.#headerLine?.[3] || this.#dataRow?.[3] || this.#dataLine?.[3] || this.#bottomLine?.[3] ? 1 : 0,
            internalBorderWidth = this.#topLine?.[2] || this.#headerRow?.[2] || this.#headerLine?.[2] || this.#dataRow?.[2] || this.#dataLine?.[2] || this.#bottomLine?.[2] ? 1 : 0;

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

    get hasContent () {
        return this.#hasContent;
    }

    get text () {
        return this.#text;
    }

    add ( ...rows ) {
        this.#hasContent = true;

        if ( !this.#headerWritten ) this.#renderHeader();

        for ( const row of rows ) {
            if ( !this.#firstRow ) this.#renderLine( this.#dataLine );
            else this.#firstRow = false;

            this.#renderRow( this.#dataRow, row, false );
        }

        return this;
    }

    end () {
        if ( this.#hasContent ) this.#renderLine( this.#bottomLine );

        return this.text;
    }

    #renderHeader () {
        if ( this.#headerWritten ) return;

        this.#headerWritten = true;
        this.#hasContent = true;

        this.#renderLine( this.#topLine );

        if ( this.#header ) {
            this.#renderRow( this.#headerRow,
                this.#columns.map( column => column.title ),
                true );

            this.#renderLine( this.#headerLine );
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

    #wrapColumn ( column, value, isHeader ) {
        value ??= "";

        if ( column.format && !isHeader ) value = column.format( value );

        var maxWidth = column.contentWidth,
            ansiStyle = "";

        // strigify value
        value += "";

        if ( !this.#ansi ) value = value.removeANSI();

        value = wrapAnsi( value, maxWidth, { "hard": true, "trim": column.trim, "wordWrap": column.wordWrap } );

        const lines = [];

        for ( let line of value.split( "\n" ) ) {
            let length;

            if ( this.#ansi ) {
                length = line.removeANSI().length;

                const ansiCodes = [...line.matchAll( ANSI )].map( match => match[0] ).join( "" );

                line = ansiStyle + line;

                ansiStyle += ansiCodes;

                // reset ansi codes
                if ( ansiStyle ) line += ANSI_RESET;
            }
            else length = line.length;

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
};
