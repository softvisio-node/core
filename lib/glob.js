// export { default } from "glob";

import { glob, globSync } from "glob";

export default glob;

glob.globSync = function ( pattern, options = {} ) {
    options.mark ??= true;

    var files = globSync( pattern, options );

    if ( !options.platform && process.platform === "win32" ) {
        files = files.map( file => file.replaceAll( "\\", "/" ) );
    }

    return files;
};
