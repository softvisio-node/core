import CacheLru from "#lib/cache/lru";

const CACHE = new CacheLru( { "maxSize": 1000 } ),
    UNITS = {
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
    },
    UNIT_ABBR = {
        "petabyte": "PB",
        "terabyte": "TB",
        "gigabyte": "GB",
        "megabyte": "MB",
        "kilobyte": "KB",
        "byte": "B",
    },
    NGINX_SIZE_ABBR = {
        "mebibyte": "M",
        "kibibyte": "K",
    },
    NGINX_OFFSET_ABBR = {
        "gibibyte": "G", // NOTE not portable, for nginx offsets only
        "mebibyte": "M",
        "kibibyte": "K",
    },
    UNIT_BYTES = {
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
    #bytes = 0;
    #string;
    #nginx = {
        "size": null,
        "offset": null,
    };
    #formatDifitalSizeParam;

    constructor ( size, unit = "bytes" ) {

        // check unit
        if ( !UNITS[ unit ] ) throw new Error( `Digital size unit is not valid` );

        if ( size ) {

            // string
            if ( typeof size === "string" ) {
                const number = Number( size );

                if ( !Number.isNaN( number ) ) {
                    this.#bytes = number * UNIT_BYTES[ UNITS[ unit ] ];
                }
                else {
                    size = size.replaceAll( " ", "" ).trim();

                    const bytes = CACHE.get( size );

                    if ( bytes != null ) {
                        this.#bytes = bytes;
                    }
                    else {
                        const match = size.split( /([+-]?\d+(?:\.\d+)?)([A-Za-z]+)/ );

                        for ( let n = 0; n < match.length; n += 3 ) {
                            if ( match[ n ] !== "" ) throw new Error( `Digital size is not valid` );

                            if ( match[ n + 1 ] === undefined ) break;

                            const unit = UNITS[ match[ n + 2 ] ];
                            if ( !unit ) throw new Error( `Digital size is not valid` );

                            this.#bytes += Number( match[ n + 1 ] ) * UNIT_BYTES[ unit ];
                        }

                        CACHE.set( size, this.#bytes );
                    }
                }
            }

            // number
            else if ( typeof size === "number" ) {
                this.#bytes = size * UNIT_BYTES[ UNITS[ unit ] ];
            }

            // object
            else if ( typeof size === "object" ) {
                this.#bytes = size.bytes || 0;
            }

            // invalid
            else {
                throw new Error( "Digital size is not valid" );
            }
        }

        this.#bytes = Math.trunc( this.#bytes );
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
            const units = [],
                sign = this.#bytes < 0
                    ? "-"
                    : "";

            let bytes = Math.abs( this.#bytes );

            for ( const [ unit, abbr ] of Object.entries( UNIT_ABBR ) ) {
                if ( bytes >= UNIT_BYTES[ unit ] ) {
                    const remainder = bytes % UNIT_BYTES[ unit ];

                    units.push( sign + ( bytes - remainder ) / UNIT_BYTES[ unit ] + " " + abbr );

                    bytes = remainder;
                }
            }

            if ( units.length ) {
                this.#string = units.join( " " );
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

    toNginx ( { offset } = {} ) {
        const id = offset
            ? "offset"
            : "size";

        if ( this.#nginx[ id ] == null ) {
            if ( this.#bytes ) {
                const units = offset
                    ? NGINX_OFFSET_ABBR
                    : NGINX_SIZE_ABBR;

                for ( const [ unit, abbr ] of Object.entries( units ) ) {
                    if ( this.#bytes % UNIT_BYTES[ unit ] ) continue;

                    this.#nginx[ id ] = this.#bytes / UNIT_BYTES[ unit ] + abbr;

                    break;
                }

                // default
                this.#nginx[ id ] ??= this.#bytes;
            }
            else {
                this.#nginx[ id ] = "";
            }
        }

        return this.#nginx[ id ];
    }

    getFormatDifitalSizeParam () {
        if ( !this.#formatDifitalSizeParam ) {
            const bytes = Math.abs( this.#bytes );

            for ( const unit in UNIT_ABBR ) {
                if ( bytes >= UNIT_BYTES[ unit ] ) {
                    this.#formatDifitalSizeParam = {
                        unit,
                        "value": this.#bytes / UNIT_BYTES[ unit ],
                    };

                    break;
                }
            }

            // default
            this.#formatDifitalSizeParam ??= {
                "unit": "byte",
                "value": 0,
            };
        }

        return this.#formatDifitalSizeParam;
    }

    add ( size, unit ) {
        return new this.constructor( this.#bytes + this.constructor( size, unit ).bytes, "bytes" );
    }

    subtract ( size, unit ) {
        return new this.constructor( this.#bytes - this.constructor( size, unit ).bytes, "bytes" );
    }
}
