const UNITS = {
    "b": "byte",
    "byte": "byte",
    "bytes": "byte",

    "kB": "kilobyte",
    "kilobyte": "kilobyte",
    "kilobytes": "kilobyte",

    "MB": "megabyte",
    "megabyte": "megabyte",
    "megabytes": "megabyte",

    "GB": "gigabyte",
    "gigabyte": "gigabyte",
    "gigabytes": "gigabyte",

    "TB": "terabyte",
    "terabyte": "terabyte",
    "terabytes": "terabyte",

    "PB": "petabyte",
    "petabyte": "petabyte",
    "petabytes": "petabyte",
};

const UNIT_ABBR = {
    "petabyte": "PB",
    "terabyte": "TB",
    "gigabyte": "GB",
    "megabyte": "MB",
    "kilobyte": "kB",
    "byte": "b",
};

const NGINX_UNIT_ABBR = {
    "petabyte": "PB",
    "terabyte": "T",
    "gigabyte": "G",
    "megabyte": "M",
    "kilobyte": "k",
    "byte": "b",
};

const UNIT_BYTES = {
    "petabyte": 1024 ** 5,
    "terabyte": 1024 ** 4,
    "gigabyte": 1024 ** 3,
    "megabyte": 1024 ** 2,
    "kilobyte": 1024,
    "byte": 1,
};

export default class DigitalSize {
    #bytes = 0;
    #units = {
        "petabyte": 0,
        "terabyte": 0,
        "gigabyte": 0,
        "megabyte": 0,
        "kilobyte": 0,
        "byte": 0,
    };
    #string;
    #nginx;
    #_toUnit = {};

    constructor ( size, unit = "byte" ) {
        if ( typeof size === "object" ) {
            for ( const [unit, bytes] of Object.entries( UNIT_BYTES ) ) {
                this.#bytes += ( size[unit] || 0 ) * bytes;
            }
        }
        else {
            const number = +size;

            // number
            if ( !isNaN( number ) ) {
                if ( !UNITS[unit] ) throw Error( `Digital size unit is not valid` );

                this.#bytes += size * UNIT_BYTES[UNITS[unit]];
            }

            // parse string
            else {
                size = size.trim();

                const match = size.split( /\s*(\d+)\s*([a-zA-Z]+)\s*/ );

                if ( match[0] !== "" || match.at( -1 ) !== "" ) throw Error( `Digital size format is not valid` );

                for ( let n = 1; n < match.length; n += 3 ) {
                    const unit = UNITS[match[n + 1]];

                    if ( !unit ) throw Error( `Digital size format is not valid` );

                    this.#bytes += +match[n] * UNIT_BYTES[UNITS[unit]];
                }
            }
        }

        this.#bytes = Math.floor( this.#bytes );

        this.#units.byte = this.#bytes;

        if ( this.#units.byte >= UNIT_BYTES.kilobyte ) {
            this.#units.kilobyte += Math.floor( this.#units.byte / UNIT_BYTES.kilobyte );
            this.#units.byte = this.#units.byte % UNIT_BYTES.kilobyte;
        }

        if ( this.#units.kilobyte >= UNIT_BYTES.megabyte ) {
            this.#units.megabyte += Math.floor( this.#units.kilobyte / UNIT_BYTES.megabyte );
            this.#units.kilobyte = this.#units.kilobyte % UNIT_BYTES.megabyte;
        }

        if ( this.#units.megabyte >= UNIT_BYTES.gigabyte ) {
            this.#units.gigabyte += Math.floor( this.#units.megabyte / UNIT_BYTES.gigabyte );
            this.#units.megabyte = this.#units.megabyte % UNIT_BYTES.gigabyte;
        }

        if ( this.#units.gigabyte >= UNIT_BYTES.terabyte ) {
            this.#units.terabyte += Math.floor( this.#units.gigabyte / UNIT_BYTES.terabyte );
            this.#units.gigabyte = this.#units.gigabyte % UNIT_BYTES.terabyte;
        }

        if ( this.#units.terabyte >= UNIT_BYTES.petabyte ) {
            this.#units.petabyte += Math.floor( this.#units.terabyte / UNIT_BYTES.petabyte );
            this.#units.terabyte = this.#units.terabyte % UNIT_BYTES.petabyte;
        }
    }

    // static
    static new ( size, unit ) {
        if ( size instanceof this ) {
            return size;
        }
        else {
            return new this( size, unit );
        }
    }

    // properties

    // public
    toString () {
        if ( this.#string == null ) {
            const units = [];

            for ( const [unit, value] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                units.push( value + UNIT_ABBR[unit] );
            }

            if ( !units.length ) units.push( "0" + UNIT_ABBR.byte );

            this.#string = units.join( " " );
        }

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toNginx () {
        if ( this.#nginx == null ) {
            const units = [];

            for ( const [unit, value] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                units.push( value + NGINX_UNIT_ABBR[unit] );
            }

            if ( !units.length ) units.push( "0" + NGINX_UNIT_ABBR.byte );

            this.#nginx = units.join( " " );
        }

        return this.#nginx;
    }

    toBytes () {
        return this.#bytes;
    }
}
