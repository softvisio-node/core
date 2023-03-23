import { default as _glob } from "glob";

export default function glob ( pattern, { cwd, directories = true, markDirectories, dotFiles = true, absolute, ignore } = {} ) {
    return new Promise( resolve => {
        _glob( pattern, {
            cwd,
            "nodir": !directories,
            "mark": markDirectories,
            "dot": dotFiles,
            absolute,
            ignore,
        } ).then( files => {
            resolve( _processFiles( files ) );
        } );
    } );
}

glob.sync = function ( pattern, { cwd, directories = true, markDirectories, dotFiles = true, absolute, ignore } = {} ) {
    const files = _glob.sync( pattern, {
        cwd,
        "nodir": !directories,
        "mark": markDirectories,
        "dot": dotFiles,
        absolute,
        ignore,
    } );

    return _processFiles( files );
};

function _processFiles ( files ) {
    if ( process.platform === "win32" ) {
        for ( let n = 0; n < files.length; n++ ) {
            files[n] = files[n].replaceAll( "\\", "/" );
        }
    }

    return files;
}
