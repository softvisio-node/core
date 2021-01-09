const TYPES = {
    "number": {
        "alias": ["int2", "int4", "oid", "float4", "real", "float8", "double"],
        "pgsql": {
            "oid": [
                21, // int2
                23, // int4
                26, // oid
                700, // float4, real
                701, // float8, double
            ],
            "from": buf => +buf,
        },
        "sqlite": {
            "from": x => Number( x ),
        },
    },

    "numeric": {
        "alias": ["decimal"],
        "pgsql": {
            "oid": [
                1700, // numeric, decimal
            ],
            "from": buf => buf.toString(),
        },
        "sqlite": {
            "from": x => x.toString(),
        },
    },

    "bigint": {
        "alias": ["int8"],
        "pgsql": {
            "oid": [
                20, // int8
            ],
            "from": buf => buf.toString(), // BigInt( buf ),
        },
        "sqlite": {
            "from": x => x.toString(),
        },
    },

    "money": {
        "pgsql": {
            "oid": [
                790, // money
            ],
            "from": buf => buf.toString(),
        },
        "sqlite": {
            "from": x => x.toString(),
        },
    },

    "boolean": {
        "alias": ["bool"],
        "pgsql": {
            "oid": [
                16, // bool
            ],
            "from": buf => buf.toString( "binary" ) === "t",
        },
        "sqlite": {
            "from": x => ( x === 1 ? true : false ),
        },
    },

    "json": {
        "alias": ["jsonb"],
        "pgsql": {
            "oid": [
                114, // json
                3802, // jsonb
            ],
            "to": x => JSON.stringify( x ),
            "from": buf => JSON.parse( buf ),
        },
        "sqlite": {
            "to": x => JSON.stringify( x ),
            "from": x => JSON.parse( x ),
        },
    },

    "bytea": {
        "pgsql": {
            "oid": [
                17, // bytea
            ],
            "from": buf => Buffer.from( buf.slice( 2 ).toString( "binary" ), "hex" ),
        },
    },

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
    //             1082, // date
    //             1083, // time
    //             1114, // timestamp
    //             1184, // timestamptz
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
