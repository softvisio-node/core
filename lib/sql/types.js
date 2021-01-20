const { SQL_TYPE } = require( "../const" );

const DEFAULT_TYPES = [

    // number
    {
        "names": {
            "int2": 21,
            "int4": 23,
            "oid": 26,
            "float4": 700,
            "real": 700,
            "float8": 701,
            "double": 701,
        },
        "decode_pgsql": buffer => +buffer,
        "decode_sqlite": value => Number( value ),
    },

    // numeric
    {
        "names": {
            "numeric": 1700,
            "decimal": 1700,
        },
        "decode_pgsql": buffer => buffer.toString(),
        "decode_sqlite": value => value.toString(),
    },

    // bigint
    {
        "names": {
            "bigint": 20,
            "int8": 20,
        },
        "decode_pgsql": buffer => buffer.toString(),
        "decode_sqlite": value => value.toString(),
    },

    // money
    {
        "names": {
            "money": 790,
        },
        "decode_pgsql": buffer => buffer.toString(),
        "decode_sqlite": value => value.toString(),
    },

    // boolen
    {
        "names": {
            "boolean": 16,
            "bool": null,
        },
        "decode_pgsql": buffer => buffer.toString( "binary" ) === "t",
        "decode_sqlite": value => ( value === 1 ? true : false ),
    },

    // json
    {
        "names": {
            "json": 114,
            "jsonb": 3802,
        },
        "encode": value => JSON.stringify( value ),
        "decode_pgsql": buffer => JSON.parse( buffer ),
        "decode_sqlite": value => JSON.parse( value ),
    },

    // buffer
    {
        "names": {
            "bytea": 17,
        },
        "decode_pgsql": buffer => Buffer.from( buffer.slice( 2 ).toString( "binary" ), "hex" ),
    },
];

const DEFAULT_TYPES_SQLITE = {
    "types": {},
    "encode": {},
    "decode": {},
};

const DEFAULT_TYPES_PGSQL = {
    "types": {},
    "encode": {},
    "decode": {},
};

for ( const type of DEFAULT_TYPES ) {
    for ( const name in type.names ) {
        const oid = type.names[name];

        DEFAULT_TYPES_SQLITE.types[name] = DEFAULT_TYPES_PGSQL.types[name] = function ( value ) {
            if ( value != null && typeof value === "object" ) value[SQL_TYPE] = name;

            return value;
        };

        if ( type.decode_sqlite ) DEFAULT_TYPES_SQLITE.decode[name] = type.decode_sqlite;
        if ( type.decode_pgsql && oid ) DEFAULT_TYPES_PGSQL.decode[oid] = type.decode_pgsql;

        if ( type.encode_sqlite || type.encode ) DEFAULT_TYPES_SQLITE.encode[name] = type.encode_sqlite || type.encode;
        if ( type.encode_pgsql || type.encode ) DEFAULT_TYPES_PGSQL.encode[name] = type.encode_pgsql || type.encode;
    }
}

module.exports.DEFAULT_TYPES_SQLITE = DEFAULT_TYPES_SQLITE;
module.exports.DEFAULT_TYPES_PGSQL = DEFAULT_TYPES_PGSQL;
