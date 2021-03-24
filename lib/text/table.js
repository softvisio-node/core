const table = require( "table" );

const DEFAULT_MAX_WIDTH = 80;
const DEFAULT_STYLE = "ascii";

const STYLES = {
    "ascii": `
+-++
| ||
|=+|
| ||
|-+|
+-++`,
    "unicode": `
┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
└─┴┘`,
    "compact": "",
    "markdown": `

| ||
|-||
| ||`,
};

const convertedStyle = {};

function getStyle ( name ) {
    if ( !( name in STYLES ) ) name = DEFAULT_STYLE;

    if ( !convertedStyle[name] ) {
        const lines = STYLES[name].trim().split( "\n" );

        convertedStyle[name] = {
            "topLeft": lines[0]?.[0] ?? "",
            "topBody": lines[0]?.[1] ?? "",
            "topJoin": lines[0]?.[2] ?? "",
            "topRight": lines[0]?.[3] ?? "",

            "bottomLeft": lines[5]?.[0] ?? "",
            "bottomBody": lines[5]?.[1] ?? "",
            "bottomJoin": lines[5]?.[2] ?? "",
            "bottomRight": lines[5]?.[3] ?? "",

            "bodyLeft": lines[3]?.[0] ?? "",
            "bodyJoin": lines[3]?.[2] ?? "",
            "bodyRight": lines[3]?.[3] ?? "",

            "joinLeft": lines[4]?.[0] ?? "",
            "joinBody": lines[4]?.[1] ?? "",
            "joinJoin": lines[4]?.[2] ?? "",
            "joinRight": lines[4]?.[3] ?? "",
        };
    }

    return convertedStyle[name];
}

module.exports = class Table {
    #maxWidth;
    #lazyHeader;
    #columns = {};
    #columnsIndex = [];

    #table;
    #headerWritten;

    constructor ( options = {} ) {
        this.#maxWidth = options.maxWidth || ( process.stdout.columns ? process.stdout.columns - 13 : null ) || DEFAULT_MAX_WIDTH;

        this.#lazyHeader = options.lazyHeader;

        var totalWidth = 0,
            totalFlex = 0;

        for ( const id in options.columns ) {
            this.#columnsIndex.push( id );

            const column = { ...options.columns[id], id, "index": this.#columnsIndex.length - 1 };

            this.#columns[id] = column;

            if ( column.width ) totalWidth += column.width;
            else totalFlex += column.flex || 1;
        }

        if ( totalFlex ) {
            for ( const column of Object.values( this.#columns ) ) {
                if ( column.width ) continue;

                column.width = Math.floor( ( this.#maxWidth - totalWidth ) * ( ( column.flex || 1 ) / totalFlex ) );
            }
        }

        this.#table = table.createStream( {
            "border": getStyle( options.style ),
            "columnCount": Object.values( this.#columns ).length,
            "columns": Object.fromEntries( Object.values( this.#columns ).map( column => [column.index, { "width": column.width }] ) ),
            "columnDefault": { "width": 1 },

            // "drawHorizontalLine": ( index, size ) => true,
            // "singleLine": true,
        } );

        if ( !this.#lazyHeader ) this.#writeHeader();
    }

    #writeHeader () {
        if ( this.#headerWritten ) return;

        this.#headerWritten = true;

        this.#table.write( Object.values( this.#columns ).map( column => column.title || "" ) );
    }

    add ( row ) {
        if ( !this.#headerWritten ) this.#writeHeader();

        const data = this.#columnsIndex.map( id => {
            const column = this.#columns[id];

            let value = Array.isArray( row ) ? row[column.index] : row[id];

            if ( column.filter ) value = column.filter( value );

            return value ?? "";
        } );

        this.#table.write( data );

        return this;
    }

    end () {}
};
