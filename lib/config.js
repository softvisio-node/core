import fs from "node:fs";
import module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import json5 from "#lib/json5";
import yaml from "#lib/yaml";

const TYPES = {
    "json": "json",
    "json5": "json5",
    "yaml": "yaml",
    "yml": "yaml",
};

// public
export async function readConfig ( configPath, { type, resolve, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    type = TYPES[ type || path.extname( configPath ).slice( 1 ) ];

    // json
    if ( type === "json" ) {
        return JSON.parse( await fs.promises.readFile( configPath ) );
    }

    // json5
    else if ( type === "json5" ) {
        return json5.parse( await fs.promises.readFile( configPath ) );
    }

    // yaml
    else if ( type === "yaml" ) {
        return yaml.fromYaml( await fs.promises.readFile( configPath, "utf8" ), options );
    }

    // other
    else {
        throw new Error( "Invalid config type" );
    }
}

export function readConfigSync ( configPath, { type, resolve, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    type = TYPES[ type || path.extname( configPath ).slice( 1 ) ];

    // json
    if ( type === "json" ) {
        return JSON.parse( fs.readFileSync( configPath ) );
    }

    // json5
    else if ( type === "json5" ) {
        return json5.parse( fs.readFileSync( configPath ) );
    }

    // yaml
    else if ( type === "yaml" ) {
        return yaml.fromYaml( fs.readFileSync( configPath, "utf8" ), options );
    }

    // other
    else {
        throw new Error( "Invalid config type" );
    }
}

export async function writeConfig ( configPath, data, { type, resolve, readable, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    type = TYPES[ type || path.extname( configPath ).slice( 1 ) ];

    // json
    if ( type === "json" || type === "json5" ) {
        return fs.promises.writeFile( configPath, JSON.stringify( data, null, readable
            ? 4
            : null ) + ( readable
            ? "\n"
            : "" ) );
    }

    // yaml
    else if ( type === "yaml" ) {
        return fs.promises.writeFile(
            configPath,
            yaml.toYaml( data, {
                "indent": 2,
                "quotingType": '"',
                ...options,
            } )
        );
    }

    // other
    else {
        throw new Error( "Invalid config type" );
    }
}

export function writeConfigSync ( configPath, data, { type, resolve, readable, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    type = TYPES[ type || path.extname( configPath ).slice( 1 ) ];

    // json
    if ( type === "json" || type === "json5" ) {
        fs.writeFileSync( configPath, JSON.stringify( data, null, readable
            ? 4
            : null ) + ( readable
            ? "\n"
            : "" ) );
    }

    // yaml
    else if ( type === "yaml" ) {
        fs.writeFileSync(
            configPath,
            yaml.toYaml( data, {
                "indent": 2,
                "quotingType": '"',
                ...options,
            } )
        );
    }

    // other
    else {
        throw new Error( "Invalid config type" );
    }
}

// private
function parsePath ( configPath, resolve ) {
    if ( configPath instanceof URL ) {
        return fileURLToPath( configPath );
    }
    else if ( configPath.startsWith( "file:" ) ) {
        return fileURLToPath( configPath );
    }
    else if ( resolve ) {
        return module.createRequire( resolve ).resolve( configPath );
    }
    else {
        return configPath;
    }
}
