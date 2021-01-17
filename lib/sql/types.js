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
            "from": buffer => +buffer,
        },
        "sqlite": {
            "from": value => Number( value ),
        },
    },

    "numeric": {
        "pgsql": {
            "oid": [
                1700, // numeric, decimal
            ],
            "from": buffer => buffer.toString(),
        },
        "sqlite": {
            "from": value => value.toString(),
        },
    },

    "bigint": {
        "alias": ["int8"],
        "pgsql": {
            "oid": [
                20, // int8
            ],
            "from": buffer => buffer.toString(), // BigInt( buffer ),
        },
        "sqlite": {
            "from": value => value.toString(),
        },
    },

    "money": {
        "pgsql": {
            "oid": [
                790, // money
            ],
            "from": buffer => buffer.toString(),
        },
        "sqlite": {
            "from": value => value.toString(),
        },
    },

    "boolean": {
        "alias": ["bool"],
        "pgsql": {
            "oid": [
                16, // boolean
            ],
            "from": buffer => buffer.toString( "binary" ) === "t",
        },
        "sqlite": {
            "from": value => ( value === 1 ? true : false ),
        },
    },

    "json": {
        "alias": ["jsonb"],
        "pgsql": {
            "oid": [
                114, // json
                3802, // jsonb
            ],
            "to": value => JSON.stringify( value ),
            "from": buffer => JSON.parse( buffer ),
        },
        "sqlite": {
            "to": value => JSON.stringify( value ),
            "from": value => JSON.parse( value ),
        },
    },

    "bytea": {
        "pgsql": {
            "oid": [
                17, // bytea
            ],
            "from": buffer => Buffer.from( buffer.slice( 2 ).toString( "binary" ), "hex" ),
        },
    },

    // "array": {
    //     "alias": [],
    //     "pgsql": {
    //         "oid": [], // TODO
    //         "to": value => value, // TODO
    //         "from": buffer => buffer, // TODO
    //     },
    //     "sqlite": {
    //         "to": value => value, // TODO can use messagepack
    //         "from": value => value, // TODO can use messagepack
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
    //         "from": buffer => new Date( buffer ),
    //     },
    //     "sqlite": {
    //         "from": value => new Date( value ),
    //     },
    // },
};

module.exports = TYPES;
