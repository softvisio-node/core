import fs from "fs";
import FileTree from "#lib/fs/file-tree";
import * as config from "#lib/fs/config";
import { TmpFile, TmpDir } from "#lib/fs/tmp";
import module from "module";

export default fs;

fs.FileTree = FileTree;
fs.config = config;
fs.TmpFile = TmpFile;
fs.TmpDir = TmpDir;

fs.getHash = async function ( path, algorithm, digest = "hex" ) {
    const { "default": crypto } = await import( "crypto" );

    return new Promise( ( resolve, reject ) => {
        const hash = crypto.createHash( algorithm ),
            stream = fs.ReadStream( path );

        stream.once( "error", e => reject( e ) );

        stream.on( "data", data => hash.update( data ) );

        stream.once( "end", () => resolve( hash.digest( digest ) ) );
    } );
};

// XXX remove, after import.meta.resolve will be released
fs.resolve = function ( path, from ) {
    return module.createRequire( from ).resolve( path );
};
