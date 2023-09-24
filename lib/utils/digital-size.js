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
    "petabyte": 1000 ** 5,
    "terabyte": 1000 ** 4,
    "gigabyte": 1000 ** 3,
    "megabyte": 1000 ** 2,
    "kilobyte": 1000,
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
    #formatDifitalSizeParam;

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

        if ( this.#units.byte >= 1000 ) {
            this.#units.kilobyte += Math.floor( this.#units.byte / 1000 );
            this.#units.byte = this.#units.byte % 1000;
        }

        if ( this.#units.kilobyte >= 1000 ) {
            this.#units.megabyte += Math.floor( this.#units.kilobyte / 1000 );
            this.#units.kilobyte = this.#units.kilobyte % 1000;
        }

        if ( this.#units.megabyte >= 1000 ) {
            this.#units.gigabyte += Math.floor( this.#units.megabyte / 1000 );
            this.#units.megabyte = this.#units.megabyte % 1000;
        }

        if ( this.#units.gigabyte >= 1000 ) {
            this.#units.terabyte += Math.floor( this.#units.gigabyte / 1000 );
            this.#units.gigabyte = this.#units.gigabyte % 1000;
        }

        if ( this.#units.terabyte >= 1000 ) {
            this.#units.petabyte += Math.floor( this.#units.terabyte / 1000 );
            this.#units.terabyte = this.#units.terabyte % 1000;
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
    get byte () {
        return this.#units.byte;
    }

    get kilobyte () {
        return this.#units.kilobyte;
    }

    get megabyte () {
        return this.#units.megabyte;
    }

    get gigabyte () {
        return this.#units.gigabyte;
    }

    get terabyte () {
        return this.#units.terabyte;
    }

    get petabyte () {
        return this.#units.petabyte;
    }

    // public
    toString () {
        if ( this.#string == null ) {
            const units = [];

            for ( const [unit, value] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                units.push( value + " " + UNIT_ABBR[unit] );
            }

            if ( !units.length ) units.push( "0 " + UNIT_ABBR.byte );

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

                units.push( value + " " + NGINX_UNIT_ABBR[unit] );
            }

            if ( !units.length ) units.push( "0 " + NGINX_UNIT_ABBR.byte );

            this.#nginx = units.join( " " );
        }

        return this.#nginx;
    }

    toBytes () {
        return this.#bytes;
    }

    getFormatDifitalSizeParam () {
        if ( !this.#formatDifitalSizeParam ) {
            for ( const [unit, bytes] of Object.entries( UNIT_BYTES ) ) {
                if ( !this.#units[unit] ) continue;

                this.#formatDifitalSizeParam = {
                    unit,
                    "value": this.#bytes / bytes,
                };

                break;
            }

            this.#formatDifitalSizeParam ??= {
                "unit": "byte",
                "value": 0,
            };
        }

        return this.#formatDifitalSizeParam;
    }
}
