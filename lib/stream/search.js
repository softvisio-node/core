import Events from "events";

export default class StreamSearch extends Events {
    maxMatches;
    matches = 0;
    _occ = new Array( 256 );
    _lookbehind_size = 0;
    _eol;
    _bufpos = 0;
    _lookbehind;
    #encoding;

    constructor ( eol, options = {} ) {
        super();

        if ( typeof eol === "string" ) eol = Buffer.from( eol, options.encoding );

        var i,
            j,
            eolLength = eol.length;

        this.#encoding = options.encoding;

        this.maxMatches = options.maxMatches ?? Infinity;

        this._eol = eol;

        this._lookbehind = Buffer.alloc( eolLength );

        // initialize occurrence table.
        for ( j = 0; j < 256; ++j ) this._occ[j] = eolLength;

        // Populate occurrence table with analysis of the eol,
        // ignoring last letter.
        if ( eolLength >= 1 ) {
            for ( i = 0; i < eolLength - 1; ++i ) this._occ[eol[i]] = eolLength - 1 - i;
        }
    }

    reset () {
        this._lookbehind_size = 0;
        this.matches = 0;
        this._bufpos = 0;
    }

    push ( chunk, pos ) {
        var r, chlen;

        if ( !Buffer.isBuffer( chunk ) ) chunk = Buffer.from( chunk, this.#encoding );

        chlen = chunk.length;

        this._bufpos = pos || 0;

        while ( r !== chlen && this.matches < this.maxMatches ) r = this.#feed( chunk );

        return r;
    }

    #feed ( data ) {
        var len = data.length,
            eol = this._eol,
            eolLength = eol.length;

        // Positive: points to a position in `data`
        //           pos == 3 points to data[3]
        // Negative: points to a position in the lookbehind buffer
        //           pos == -2 points to lookbehind[lookbehind_size - 2]
        var pos = -this._lookbehind_size,
            last_eol_char = eol[eolLength - 1],
            occ = this._occ,
            lookbehind = this._lookbehind;

        if ( pos < 0 ) {

            // Lookbehind buffer is not empty. Perform Boyer-Moore-Horspool
            // search with character lookup code that considers both the
            // lookbehind buffer and the current round's haystack data.
            //
            // Loop until
            //   there is a match.
            // or until
            //   we've moved past the position that requires the
            //   lookbehind buffer. In this case we switch to the
            //   optimized loop.
            // or until
            //   the character to look at lies outside the haystack.
            while ( pos < 0 && pos <= len - eolLength ) {
                const ch = this.#lookupChar( data, pos + eolLength - 1 );

                if ( ch === last_eol_char && this.#memcmp( data, pos, eolLength - 1 ) ) {
                    this._lookbehind_size = 0;
                    ++this.matches;
                    if ( pos > -this._lookbehind_size ) this.emit( "info", true, lookbehind, 0, this._lookbehind_size + pos );
                    else this.emit( "info", true );

                    this._bufpos = pos + eolLength;
                    return pos + eolLength;
                }
                else pos += occ[ch];
            }

            // No match.

            if ( pos < 0 ) {

                // There's too few data for Boyer-Moore-Horspool to run,
                // so let's use a different algorithm to skip as much as
                // we can.
                // Forward pos until
                //   the trailing part of lookbehind + data
                //   looks like the beginning of the eol
                // or until
                //   pos == 0
                while ( pos < 0 && !this.#memcmp( data, pos, len - pos ) ) pos++;
            }

            if ( pos >= 0 ) {

                // Discard lookbehind buffer.
                this.emit( "info", false, lookbehind, 0, this._lookbehind_size );
                this._lookbehind_size = 0;
            }
            else {

                // Cut off part of the lookbehind buffer that has
                // been processed and append the entire haystack
                // into it.
                var bytesToCutOff = this._lookbehind_size + pos;

                if ( bytesToCutOff > 0 ) {

                    // The cut off data is guaranteed not to contain the eol.
                    this.emit( "info", false, lookbehind, 0, bytesToCutOff );
                }

                lookbehind.copy( lookbehind, 0, bytesToCutOff, this._lookbehind_size - bytesToCutOff );
                this._lookbehind_size -= bytesToCutOff;

                data.copy( lookbehind, this._lookbehind_size );
                this._lookbehind_size += len;

                this._bufpos = len;
                return len;
            }
        }

        if ( pos >= 0 ) pos += this._bufpos;

        // Lookbehind buffer is now empty. Perform Boyer-Moore-Horspool
        // search with optimized character lookup code that only considers
        // the current round's haystack data.
        while ( pos <= len - eolLength ) {
            const ch = data[pos + eolLength - 1];

            if ( ch === last_eol_char && data[pos] === eol[0] && this.#jsmemcmp( eol, 0, data, pos, eolLength - 1 ) ) {
                ++this.matches;
                if ( pos > 0 ) this.emit( "info", true, data, this._bufpos, pos );
                else this.emit( "info", true );

                this._bufpos = pos + eolLength;
                return pos + eolLength;
            }
            else pos += occ[ch];
        }

        // There was no match. If there's trailing haystack data that we cannot
        // match yet using the Boyer-Moore-Horspool algorithm (because the trailing
        // data is less than the eol size) then match using a modified
        // algorithm that starts matching from the beginning instead of the end.
        // Whatever trailing data is left after running this algorithm is added to
        // the lookbehind buffer.
        if ( pos < len ) {
            while ( pos < len && ( data[pos] !== eol[0] || !this.#jsmemcmp( data, pos, eol, 0, len - pos ) ) ) {
                ++pos;
            }
            if ( pos < len ) {
                data.copy( lookbehind, 0, pos, pos + ( len - pos ) );
                this._lookbehind_size = len - pos;
            }
        }

        // Everything until pos is guaranteed not to contain eol data.
        if ( pos > 0 ) this.emit( "info", false, data, this._bufpos, pos < len ? pos : len );

        this._bufpos = len;
        return len;
    }

    #lookupChar ( data, pos ) {
        if ( pos < 0 ) return this._lookbehind[this._lookbehind_size + pos];
        else return data[pos];
    }

    #memcmp = function ( data, pos, len ) {
        var i = 0;

        while ( i < len ) {
            if ( this.#lookupChar( data, pos + i ) === this._eol[i] ) ++i;
            else return false;
        }

        return true;
    };

    #jsmemcmp ( buf1, pos1, buf2, pos2, num ) {
        for ( var i = 0; i < num; ++i, ++pos1, ++pos2 ) if ( buf1[pos1] !== buf2[pos2] ) return false;

        return true;
    }
}
