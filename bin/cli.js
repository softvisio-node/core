#!/usr/bin/env node

const Cli = require( "@softvisio/core/lib/cli" );
const Vim = require( "@softvisio/core/lib/build/vim" );

class App extends mix( Cli ) {
    static cli () {
        return {
            "summary": "Softvisio build tool.",
            "commands": {
                "vim": Vim,
            },
        };
    }
}

new App();
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 6:19          | no-undef                     | 'mix' is not defined.                                                          |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
