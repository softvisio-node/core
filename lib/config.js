import fs from "node:fs";
import module from "node:module";
import _path from "node:path";
import { fileURLToPath } from "node:url";
import JSON5 from "#lib/json5";
import yaml from "#lib/yaml";

export async function readConfig ( path, { resolve, json5, ...options } = {} ) {
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
        if ( json5 ) {
            return JSON5.parse( await fs.promises.readFile( path ) );
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

export function readConfigSync ( path, { resolve, json5, ...options } = {} ) {
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
        if ( json5 ) {
            return JSON5.parse( fs.readFileSync( path ) );
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

export async function writeConfig ( path, data, { resolve, readable, ...options } = {} ) {
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
        return fs.promises.writeFile( path, JSON.stringify( data, null, readable
            ? 4
            : null ) + ( readable
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

export function writeConfigSync ( path, data, { resolve, readable, ...options } = {} ) {
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
        fs.writeFileSync( path, JSON.stringify( data, null, readable
            ? 4
            : null ) + ( readable
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
