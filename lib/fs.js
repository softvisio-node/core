import fs from "fs";
import FileTree from "#lib/fs/file-tree";
import * as config from "@softvisio/config";
import module from "module";

export default fs;

fs.FileTree = FileTree;
fs.config = config;

// XXX remove, after import.meta.resolve will be released
fs.resolve = function ( path, from ) {
    return module.createRequire( from ).resolve( path );
};
