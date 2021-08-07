const SEGMENTER = new Intl.Segmenter( "en", { "granularity": "grapheme" } );

class Wrap {
    #maxLength;
    #trim;
    #wordWrap;

    #output = [];

    constructor ( maxLength, options ) {
        this.#maxLength = maxLength;
        this.#trim = options.trim;
        this.#wordWrap = options.wordWrap;
    }

    // public
    wrap ( string ) {
        const segments = SEGMENTER.segment( string );

        for ( const { "segment": char } of segments ) {
            this.#output.push( char );
        }

        return this.#output.join( "" );
    }
}

export default function wrap ( string, maxLength, options = {} ) {
    const wrap = new Wrap( maxLength, options );

    return wrap.wrap( string );
}
