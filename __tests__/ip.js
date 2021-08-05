import IPAddr from "#lib/ip/addr";
import IPRange from "#lib/ip/range";

describe( "addr", () => {
    const tests = [

        // v4
        { "addr": "127.0.0.1", "toString": "127.0.0.1" },

        // v6
        { "addr": "::", "toString": "::", "toFullString": "0000:0000:0000:0000:0000:0000:0000:0000" },
        { "addr": "::1", "toString": "::1", "toFullString": "0000:0000:0000:0000:0000:0000:0000:0001" },
        { "addr": "1::", "toString": "1::", "toFullString": "0001:0000:0000:0000:0000:0000:0000:0000" },
        { "addr": "1::1", "toString": "1::1", "toFullString": "0001:0000:0000:0000:0000:0000:0000:0001" },
        { "addr": "1:2:3:4:5:6:7:8", "toString": "1:2:3:4:5:6:7:8", "toFullString": "0001:0002:0003:0004:0005:0006:0007:0008" },
        { "addr": "1:2::5:6:7:8", "toString": "1:2::5:6:7:8", "toFullString": "0001:0002:0000:0000:0005:0006:0007:0008" },
        { "addr": "1:002:3:04:5:06:0000:0000", "toString": "1:2:3:4:5:6::", "toFullString": "0001:0002:0003:0004:0005:0006:0000:0000" },
    ];

    for ( const _test of tests ) {
        let addr;

        for ( const property in _test ) {
            if ( property === "addr" ) continue;

            test( `addr-${_test.addr}-${property}`, () => {
                addr ??= new IPAddr( _test.addr );

                expect( typeof addr[property] === "function" ? addr[property]() : addr[property] ).toBe( _test[property] );
            } );
        }
    }
} );

describe( "range", () => {
    const tests = [

        // v4
        { "range": ["127.0.0.1"], "toString": "127.0.0.1/32" },
        { "range": ["127.0.0.1-1.1.1.1"], "toString": "1.1.1.1-127.0.0.1" },
        { "range": ["127.0.0.1/24"], "toString": "127.0.0.0/24" },
        { "range": ["127.0.0.1", 24], "toString": "127.0.0.0/24" },
        { "range": [new IPAddr( "127.0.0.1" )], "toString": "127.0.0.1/32" },
        { "range": [new IPAddr( "127.0.0.1" ), 24], "toString": "127.0.0.0/24" },

        // v6
        { "range": ["::"], "toString": "::/128" },
    ];

    for ( const _test of tests ) {
        let range;

        for ( const property in _test ) {
            if ( property === "range" ) continue;

            test( `range-${_test.range}-${property}`, () => {
                range ??= new IPRange( ..._test.range );

                expect( typeof range[property] === "function" ? range[property]() : range[property] ).toBe( _test[property] );
            } );
        }
    }
} );
