const TYPES = {
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

            // "to": ( x ) => "" + x,
            "from": ( buf ) => +buf,
        },
        "sqlite": {

            // "to": ( x ) => "" + x,
            // "from": ( x ) => +x,
        },
    },
    "boolean": {
        "alias": ["bool"],
        "pgsql": {
            "oid": [
                16, // BOOL
            ],

            // "to": ( x ) => ( x === true ? "t" : "f" ),
            "from": ( buf ) => buf.toString( "binary" ) === "t",
        },

        "sqlite": {

            //     "to": ( x ) => ( x === true ? 1 : 0 ),
            "from": ( x ) => ( x === 1 ? true : false ),
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
            "to": ( x ) => JSON.stringify( x ), // TODO messagepack
            "from": ( x ) => JSON.parse( x ), // TODO messagepack
        },
    },

    // "bytea": {
    //     "alias": ["blob"],
    //     "pgsql": {
    //         "oid": [
    //             17, // BYTEA
    //         ],
    //     },
    //     "sqlite": {
    //         "to": ( x ) => x, // TODO
    //         "from": ( x ) => x, // TODO
    //     },
    // },

    // "array": {
    //     "alias": [],
    //     "pgsql": {
    //         "oid": [], // TODO
    //         "to": ( x ) => x, // TODO
    //         "from": ( buf ) => buf, // TODO
    //     },
    //     "sqlite": {
    //         "to": ( x ) => x, // TODO can use messagepack
    //         "from": ( x ) => x, // TODO can use messagepack
    //     },
    // },

    // "date": {
    //     "alias": ["time", "timestamp", "timestamptz"],
    //     "pgsql": {
    //         "oid": [
    //             1082, // DATE
    //             1083, // TIME
    //             1114, // TIMESTAMP
    //             1184, // TIMESTAMPTZ
    //         ],
    //         "to": ( x ) => x.toISOString(),
    //         "from": ( buf ) => new Date( buf ),
    //     },
    //     "sqlite": {
    //         "to": ( x ) => x.toISOString(),
    //         "from": ( x ) => new Date( x ),
    //     },
    // },
};

module.exports = TYPES;
