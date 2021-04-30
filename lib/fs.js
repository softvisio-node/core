import fs from "fs";
import FileTree from "./fs/file-tree.js";
import * as config from "./fs/config.js";
import * as tmp from "./fs/tmp.js";
import crypto from "crypto";
import module from "module";

export default fs;

fs.FileTree = FileTree;
fs.config = config;
fs.tmp = tmp;

fs.getHash = async function ( path, algorithm, digest = "hex" ) {
    return new Promise( ( resolve, reject ) => {
        const hash = crypto.createHash( algorithm ),
            stream = fs.ReadStream( path );

        stream.once( "error", e => reject( e ) );

        stream.on( "data", data => hash.update( data ) );

        stream.once( "end", () => resolve( hash.digest( digest ) ) );
    } );
};

// XXX remove, after import.meta.resolve will be released
fs.resolve = function ( _path, from ) {
    return module.createRequire( from ).resolve( _path );
};
