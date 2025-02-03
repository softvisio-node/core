import fs from "node:fs";
import module from "node:module";
import _path from "node:path";
import { fileURLToPath } from "node:url";
import json5 from "#lib/json5";
import yaml from "#lib/yaml";

// options:
// json5: false
// all: yaml load all documents, returns array
export async function readConfig ( path, { resolve, ...options } = {} ) {
    if ( path instanceof URL ) {
        path = fileURLToPath( path );
    }
    else if ( path.startsWith( "file:" ) ) {
        path = fileURLToPath( path );
    }
    else if ( resolve ) {
        path = module.createRequire( resolve ).resolve( path );
    }

    const ext = _path.extname( path );

    // json
    if ( ext === ".json" ) {
        if ( options.json5 ) {
            return json5.parse( await fs.promises.readFile( path ) );
        }
        else {
            return JSON.parse( await fs.promises.readFile( path ) );
        }
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return yaml.parse( await fs.promises.readFile( path, "utf8" ), options );
    }
}

export function readConfigSync ( path, { resolve, ...options } = {} ) {
    if ( path instanceof URL ) {
        path = fileURLToPath( path );
    }
    else if ( path.startsWith( "file:" ) ) {
        path = fileURLToPath( path );
    }
    else if ( resolve ) {
        path = module.createRequire( resolve ).resolve( path );
    }

    const ext = _path.extname( path );

    // json
    if ( ext === ".json" ) {
        if ( options.json5 ) {
            return json5.parse( fs.readFileSync( path ) );
        }
        else {
            return JSON.parse( fs.readFileSync( path ) );
        }
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return yaml.parse( fs.readFileSync( path, "utf8" ), options );
    }
}

export async function writeConfig ( path, data, { resolve, ...options } = {} ) {
    if ( path instanceof URL ) {
        path = fileURLToPath( path );
    }
    else if ( path.startsWith( "file:" ) ) {
        path = fileURLToPath( path );
    }
    else if ( resolve ) {
        path = module.createRequire( resolve ).resolve( path );
    }

    const ext = _path.extname( path );

    // json
    if ( ext === ".json" ) {
        return fs.promises.writeFile( path, JSON.stringify( data, null, options.readable
            ? 4
            : null ) + ( options.readable
            ? "\n"
            : "" ) );
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return fs.promises.writeFile(
            path,
            yaml.stringify( data, {
                "indent": 2,
                "quotingType": '"',
                ...options,
            } )
        );
    }
}

export function writeConfigSync ( path, data, { resolve, ...options } = {} ) {
    if ( path instanceof URL ) {
        path = fileURLToPath( path );
    }
    else if ( path.startsWith( "file:" ) ) {
        path = fileURLToPath( path );
    }
    else if ( resolve ) {
        path = module.createRequire( resolve ).resolve( path );
    }

    const ext = _path.extname( path );

    // json
    if ( ext === ".json" ) {
        fs.writeFileSync( path, JSON.stringify( data, null, options.readable
            ? 4
            : null ) + ( options.readable
            ? "\n"
            : "" ) );
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFileSync(
            path,
            yaml.stringify( data, {
                "indent": 2,
                "quotingType": '"',
                ...options,
            } )
        );
    }
}
