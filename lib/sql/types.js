const TYPES = {
    "NUMBER": {
        "alias": ["INT2", "INT4", "OID", "FLOAT4", "REAL", "FLOAT8", "DOUBLE"],
        "pgsql": {
            "oid": [
                21, // INT2
                23, // INT4
                26, // OID
                700, // FLOAT4, REAL
                701, // FLOAT8, DOUBLE
            ],
            "from": buf => +buf,
        },
        "sqlite": {
            "from": x => Number( x ),
        },
    },

    "NUMERIC": {
        "alias": ["DECIMAL"],
        "pgsql": {
            "oid": [
                1700, // NUMERIC, DECIMAL
            ],
            "from": buf => buf.toString(),
        },
        "sqlite": {
            "from": x => x.toString(),
        },
    },

    "BIGINT": {
        "alias": ["INT8"],
        "pgsql": {
            "oid": [
                20, // INT8
            ],
            "from": buf => BigInt( buf ),
        },
    },

    "MONEY": {
        "pgsql": {
            "oid": [
                790, // MONEY
            ],
            "from": buf => buf.toString(),
        },
        "sqlite": {
            "from": x => x.toString(),
        },
    },

    "BOOLEAN": {
        "alias": ["BOOL"],
        "pgsql": {
            "oid": [
                16, // BOOL
            ],
            "from": buf => buf.toString( "binary" ) === "t",
        },
        "sqlite": {
            "from": x => ( x === 1 ? true : false ),
        },
    },

    "JSON": {
        "alias": ["JSONB"],
        "pgsql": {
            "oid": [
                114, // JSON
                3802, // JSONB
            ],
            "to": x => JSON.stringify( x ),
            "from": buf => JSON.parse( buf ),
        },
        "sqlite": {
            "to": x => JSON.stringify( x ),
            "from": x => JSON.parse( x ),
        },
    },

    "BYTEA": {

        // "alias": ["BLOB"],
        "pgsql": {
            "oid": [
                17, // BYTEA
            ],
            "from": buf => Buffer.from( buf.slice( 2 ).toString( "binary" ), "hex" ),
        },
    },

    // "ARRAY": {
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

    // "DATE": {
    //     "alias": ["TIME", "TIMESTAMP", "TIMESTAMPTZ"],
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
