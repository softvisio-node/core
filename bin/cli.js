#!/usr/bin/env node

const cli = require( "@softvisio/core/lib/cli" );
const Vim = require( "@softvisio/core/lib/build/vim" );

class App {
    static cli () {
        return {
            "summary": "Softvisio build tool.",
            "commands": {
                "vim": Vim,
            },
        };
    }
}

cli( App );
