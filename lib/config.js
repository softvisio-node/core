import fs from "node:fs";
import module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSON5 from "#lib/json5";
import yaml from "#lib/yaml";

// public
export async function readConfig ( configPath, { resolve, json5, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    const ext = path.extname( configPath );

    // json
    if ( ext === ".json" || ext === ".json5" ) {
        if ( json5 || ext === ".json5" ) {
            return JSON5.parse( await fs.promises.readFile( configPath ) );
        }
        else {
            return JSON.parse( await fs.promises.readFile( configPath ) );
        }
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return yaml.parse( await fs.promises.readFile( configPath, "utf8" ), options );
    }

    // other
    else {
        throw new Error( "Invalid config type" );
    }
}

export function readConfigSync ( configPath, { resolve, json5, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    const ext = path.extname( configPath );

    // json
    if ( ext === ".json" || ext === ".json5" ) {
        if ( json5 || ext === ".json5" ) {
            return JSON5.parse( fs.readFileSync( configPath ) );
        }
        else {
            return JSON.parse( fs.readFileSync( configPath ) );
        }
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return yaml.parse( fs.readFileSync( configPath, "utf8" ), options );
    }

    // other
    else {
        throw new Error( "Invalid config type" );
    }
}

export async function writeConfig ( configPath, data, { resolve, readable, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    const ext = path.extname( configPath );

    // json
    if ( ext === ".json" || ext === ".json5" ) {
        return fs.promises.writeFile( configPath, JSON.stringify( data, null, readable
            ? 4
            : null ) + ( readable
            ? "\n"
            : "" ) );
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return fs.promises.writeFile(
            configPath,
            yaml.stringify( data, {
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

export function writeConfigSync ( configPath, data, { resolve, readable, ...options } = {} ) {
    configPath = parsePath( configPath, resolve );

    const ext = path.extname( configPath );

    // json
    if ( ext === ".json" || ext === ".json5" ) {
        fs.writeFileSync( configPath, JSON.stringify( data, null, readable
            ? 4
            : null ) + ( readable
            ? "\n"
            : "" ) );
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFileSync(
            configPath,
            yaml.stringify( data, {
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
