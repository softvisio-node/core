import { SQL_TYPE } from "#lib/const";

const DEFAULT_TYPES = [

    // number
    {
        "names": {
            "int2": 21, // smallint
            "int4": 23, // integer
            "float4": 700, // real
            "float8": 701, // double
            "oid": 26,
        },
        "decode_pgsql": buffer => +buffer,
        "decode_sqlite": value => Number( value ),
    },

    // numeric
    {
        "names": {
            "numeric": 1700, // decimal
        },
        "decode_pgsql": buffer => buffer.toString( "latin1" ),
        "decode_sqlite": value => value.toString(),
    },

    // bigint
    {
        "names": {
            "int8": 20, // bigint
        },
        "decode_pgsql": buffer => buffer.toString( "latin1" ),
        "decode_sqlite": value => value.toString(),
    },

    // bigint SQLite
    {
        "names": {
            "integer": null, // bigint
        },
        "decode_sqlite": value => value.toString(),
    },

    // money
    {
        "names": {
            "money": 790,
        },
        "decode_pgsql": buffer => buffer.toString( "latin1" ),
        "decode_sqlite": value => value.toString(),
    },

    // boolen
    {
        "names": {
            "bool": 16, // boolean
        },
        "decode_pgsql": buffer => buffer.toString( "latin1" ) === "t",
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
        "decode_pgsql": buffer => Buffer.from( buffer.toString( "latin1", 2 ), "hex" ),
    },
];

export const DEFAULT_TYPES_SQLITE = {
    "types": {},
    "encode": {},
    "decode": {},
};

export const DEFAULT_TYPES_PGSQL = {
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

        if ( type.decode_pgsql ) {
            DEFAULT_TYPES_PGSQL.decode[name] = type.decode_pgsql;

            if ( oid ) DEFAULT_TYPES_PGSQL.decode[oid] = type.decode_pgsql;
        }

        if ( type.encode_sqlite || type.encode ) DEFAULT_TYPES_SQLITE.encode[name] = type.encode_sqlite || type.encode;

        if ( type.encode_pgsql || type.encode ) DEFAULT_TYPES_PGSQL.encode[name] = type.encode_pgsql || type.encode;
    }
}
