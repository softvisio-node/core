export default class DataUrl extends URL {
    #type;
    #encoding;
    #data;

    constructor ( url, baseUrl ) {
        super( url || "data:", baseUrl );

        this.#parseDataUrl();
    }

    // static
    static new ( url, baseUrl ) {
        if ( url instanceof this ) {
            return url;
        }
        else {
            return new this( url, baseUrl );
        }
    }

    // properties
    get href () {
        return super.href;
    }

    set href ( value ) {
        if ( value === super.href ) return;

        super.href = value;

        this.#parseDataUrl();
    }

    get pathname () {
        return super.pathname;
    }

    set pathname ( value ) {
        if ( value === super.pathname ) return;

        super.pathname = value;

        this.#parseDataUrl();
    }

    get type () {
        return this.#type;
    }

    set type ( value ) {
        if ( this.protocol !== "data:" ) return;

        value ||= "";

        if ( this.#type === value ) return;

        this.#type = value;

        this.#createDataUrl();
    }

    get encoding () {
        return this.#encoding;
    }

    set encoding ( value ) {
        if ( this.protocol !== "data:" ) return;

        value ||= "";

        if ( this.#encoding === value ) return;

        this.#encoding = value;

        this.#createDataUrl();
    }

    get data () {
        return this.#data;
    }

    set data ( value ) {
        if ( this.protocol !== "data:" ) return;

        value ||= "";

        if ( !Buffer.isBuffer( value ) ) {
            value = Buffer.from( value );
        }

        this.#data = value;

        this.#createDataUrl();
    }

    // private
    #parseDataUrl () {
        if ( this.protocol === "data:" ) {
            const idx = this.pathname.indexOf( "," );

            // has no data
            if ( idx === -1 ) {
                this.#type = this.pathname;

                this.#encoding = "";

                this.#data = Buffer.from( "" );
            }

            // has data
            else {
                [ this.#type, this.#encoding ] = this.pathname.slice( 0, idx ).split( ";" );

                this.#data = this.pathname.slice( idx + 1 );

                if ( this.#encoding ) {
                    this.#data = Buffer.from( this.#data, this.#encoding );
                }
                else {
                    this.#data = Buffer.from( decodeURIComponent( this.#data ) );
                }
            }
        }
        else {
            this.#type = "";
            this.#encoding = "";
            this.#data = Buffer.from( "" );
        }
    }

    #createDataUrl () {
        var href = "data:";

        if ( this.#type ) href += this.#type;

        if ( this.#data?.length ) {
            if ( this.#encoding ) {
                href += ";" + this.#encoding + "," + this.#data.toString( this.#encoding );
            }
            else {
                href += "," + encodeURIComponent( this.#data.toString() );
            }
        }

        super.href = href + this.search;
    }
}
