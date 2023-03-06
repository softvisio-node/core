// export { default } from "glob";

import { glob, globSync } from "glob";

export default glob;

glob.globSync = function ( pattern, options = {} ) {
    const files = globSync( pattern, options );

    if ( !options.platform && process.platform === "win32" ) {
        for ( let n = 0; n < files.length; n++ ) {
            files[n] = files[n].replaceAll( "\\", "/" );
        }
    }

    return files;
};
