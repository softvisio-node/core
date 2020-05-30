const TYPES = {

    // "string": {
    //     "alias": ["text"],
    // },
    // "bytea": {
    //     "alias": ["blob"],
    //     "pgsql": {
    //         "oid": [
    //             17, // BYTEA
    //         ],
    //     },
    //     "sqlite": {},
    // },
    "number": {
        "alias": ["int2", "int4", "int8", "oid", "float4", "float8", "money", "numeric"],
        "pgsql": {
            "oid": [
                20, // INT8
                21, // INT2
                23, // INT4
                26, // OID
                700, // FLOAT4
                701, // FLOAT8
                790, // MONEY
                1700, // NUMERIC
            ],
            "to": ( x ) => "" + x,
            "from": ( buf ) => +buf,
        },
        "sqlite": {
            "to": ( x ) => "" + x,
            "parse": ( x ) => +x,
        },
    },
    "boolean": {
        "alias": ["bool"],
        "pgsql": {
            "oid": [
                16, // BOOL
            ],
            "to": ( x ) => ( x === true ? "t" : "f" ),
            "from": ( buf ) => buf.toString( "binary" ) === "t",
        },
        "sqlite": {
            "to": ( x ) => ( x === true ? 1 : 0 ),
            "from": ( x ) => ( x ? true : false ),
        },
    },
    "json": {
        "alias": ["jsonb"],
        "pgsql": {
            "oid": [
                114, // JSON
                3802, // JSONB
            ],
            "to": ( x ) => JSON.stringify( x ),
            "from": ( buf ) => JSON.parse( buf ),
        },
        "sqlite": {
            "to": ( x ) => JSON.stringify( x ),
            "from": ( buf ) => JSON.parse( buf ),
        },
    },
};

module.exports = TYPES;
