import CacheLru from "#lib/cache/lru";

const cache = new CacheLru( { "maxSize": 1000 } );

const UNITS = {
    "B": "byte",
    "byte": "byte",
    "bytes": "byte",

    "KB": "kilobyte",
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

    "KiB": "kibibyte",
    "kibibyte": "kibibyte",
    "kibibytes": "kibibyte",

    "MiB": "mebibyte",
    "mebibyte": "mebibyte",
    "mebibytes": "mebibyte",

    "GiB": "gibibyte",
    "gibibyte": "gibibyte",
    "gibibytes": "gibibyte",

    "TiB": "tebibyte",
    "tebibyte": "tebibyte",
    "tebibytes": "tebibyte",

    "PiB": "pebibyte",
    "pebibyte": "pebibyte",
    "pebibytes": "pebibyte",
};

const UNIT_ABBR = {
    "petabyte": "PB",
    "terabyte": "TB",
    "gigabyte": "GB",
    "megabyte": "MB",
    "kilobyte": "KB",
    "byte": "B",
};

const NGINX_UNIT_ABBR = {
    "gigabyte": "G",
    "megabyte": "M",
    "kilobyte": "K",
};

const UNIT_BYTES = {
    "petabyte": 1000 ** 5,
    "terabyte": 1000 ** 4,
    "gigabyte": 1000 ** 3,
    "megabyte": 1000 ** 2,
    "kilobyte": 1000,

    "pebibyte": 1024 ** 5,
    "tebibyte": 1024 ** 4,
    "gibibyte": 1024 ** 3,
    "mebibyte": 1024 ** 2,
    "kibibyte": 1024,

    "byte": 1,
};

export default class DigitalSize {
    #negative = false;
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
    #formatDifitalSizeParam;

    constructor ( size, unit = "byte" ) {
        if ( size ) {
            if ( typeof size === "object" ) {
                this.#bytes = size.bytes || 0;
            }
            else {
                const number = +size;

                // number
                if ( !isNaN( number ) ) {
                    if ( !UNITS[ unit ] ) throw Error( `Digital size unit is not valid` );

                    this.#bytes = size * UNIT_BYTES[ UNITS[ unit ] ];
                }

                // parse string
                else {
                    size = size.trim();

                    const bytes = cache.get( size );

                    if ( bytes != null ) {
                        this.#bytes = bytes;
                    }
                    else {
                        let negative;

                        if ( size.startsWith( "-" ) ) {
                            negative = true;

                            size = size.substring( 1 );
                        }

                        const match = size.split( /\s*(\d+)\s*([A-Za-z]+)\s*/ );

                        if ( match[ 0 ] !== "" || match.at( -1 ) !== "" ) throw Error( `Digital size format is not valid` );

                        for ( let n = 1; n < match.length; n += 3 ) {
                            const unit = UNITS[ match[ n + 1 ] ];

                            if ( !unit ) throw Error( `Digital size format is not valid` );

                            this.#bytes += +match[ n ] * UNIT_BYTES[ unit ];
                        }

                        if ( negative ) this.#bytes = 0 - this.#bytes;

                        cache.set( size, this.#bytes );
                    }
                }
            }
        }

        if ( this.#bytes < 0 ) this.#negative = true;

        this.#bytes = Math.floor( this.#bytes );

        this.#units.byte = Math.abs( this.#bytes );

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
    get hasValue () {
        return !!this.#bytes;
    }

    get isNegative () {
        return this.#negative;
    }

    get bytes () {
        return this.#bytes;
    }

    get kilobytes () {
        return this.#bytes / 1000;
    }

    get megabytes () {
        return this.#bytes / 1_000_000;
    }

    get gigabytes () {
        return this.#bytes / 1_000_000_000;
    }

    get terabytes () {
        return this.#bytes / 1_000_000_000_000;
    }

    get petabytes () {
        return this.#bytes / 1_000_000_000_000_000;
    }

    // public
    toString () {
        if ( this.#string == null ) {
            const units = [];

            for ( const [ unit, value ] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                units.push( value + " " + UNIT_ABBR[ unit ] );
            }

            if ( units.length ) {
                this.#string = ( this.#negative ? "-" : "" ) + units.join( " " );
            }
            else {
                this.#string = "0 " + UNIT_ABBR.byte;
            }
        }

        return this.#string;
    }

    toJSON () {
        return this.toString();
    }

    toNginx () {
        if ( this.#nginx == null ) {
            if ( this.#bytes ) {
                for ( const [ unit, abbr ] of Object.entries( NGINX_UNIT_ABBR ) ) {
                    if ( this.#bytes % UNIT_BYTES[ unit ] ) continue;

                    this.#nginx = this.#bytes / UNIT_BYTES[ unit ] + abbr;

                    break;
                }

                this.#nginx ??= this.#bytes;
            }
            else {
                this.#nginx = "";
            }
        }

        return this.#nginx;
    }

    getFormatDifitalSizeParam () {
        if ( !this.#formatDifitalSizeParam ) {
            for ( const [ unit, value ] of Object.entries( this.#units ) ) {
                if ( !value ) continue;

                this.#formatDifitalSizeParam = {
                    unit,
                    "value": this.#bytes / UNIT_BYTES[ unit ],
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
