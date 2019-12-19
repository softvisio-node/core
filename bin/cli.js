#!/usr/bin/env node

const net = require( "net" );
const readline = require( "readline" );
const path = require( "path" );
const eslintApi = require( "eslint/lib/cli-engine/cli-engine.js" );

// disable prettier colors
process.env.FORCE_COLOR = 0;
const prettierApi = require( "prettier" );

const terserApi = require( "terser" );

const defaultEslintConfig = path.resolve( __dirname, "../share/.eslintrc.yaml" );

var server = net.createServer( function ( socket ) {
    var rl = readline.createInterface( socket, socket );

    rl.on( "line", function ( line ) {
        onCommand( line, function ( data ) {
            socket.write( data + "\n" );
        } );
    } );
} );

server.listen( 55556, "127.0.0.1" );

function onCommand ( data, req ) {
    data = JSON.parse( data );

    var res;

    if ( data.command === "prettier" ) {
        res = prettier( data );
    }
    else if ( data.command === "eslint" ) {
        res = eslint( data );
    }
    else if ( data.command === "terser" ) {
        res = terser( data );
    }
    else {
        res = {
            "status": 0,
            "reason": "Invalid command",
        };
    }

    req( JSON.stringify( res ) );
}

function eslint ( data ) {
    let engine;

    try {
        engine = new eslintApi.CLIEngine( data.options );
    }
    catch ( err ) {
        return {
            "status": 0,
            "reason": err.message,
        };
    }

    var report;

    try {
    	report = engine.executeOnText( data.data, data.path, true );
    }
    catch ( err ) {

        // fallback to default settings
        if ( err.message.includes( "No ESLint configuration found" ) ) {
            data.options.useEslintrc = false;
            data.options.configFile = defaultEslintConfig;

            engine = new eslintApi.CLIEngine( data.options );

            report = engine.executeOnText( data.data, data.path, true );
        }
        else {
            return {
                "status": 0,
                "reason": err.message,
            };
        }
    }

    return {
        "status": 1,
        "result": report.results,
    };
}

function prettier ( data ) {
    var res;

    var options;

    try {
        const config = prettierApi.resolveConfig.sync( data.options.filepath, {
            "editorconfig": data.options.editorconfig,
            "config": data.options.config,
        } );

        options = { ...data.options, ...config };
    }
    catch ( error ) {
        return {
            "status": 0,
            "reason": error.message,
        };
    }

    try {
        res = prettierApi.format( data.data, options );
    }
    catch ( error ) {
        return {
            "status": 0,
            "reason": error.message,
        };
    }

    return {
        "status": 1,
        "result": res,
    };
}

function terser ( data ) {
    var res;

    try {
        res = terserApi.minify( data.data, data.options );
    }
    catch ( error ) {
        return {
            "status": 0,
            "reason": error.message,
        };
    }

    if ( res.error ) {
        return {
            "status": 0,
            "reason": res.error.message,
        };
    }
    else {
        return {
            "status": 1,
            "result": res.code,
        };
    }
}
