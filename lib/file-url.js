import path from "node:path";
import url from "node:url";

const ROOT_FILE_URL = url.pathToFileURL( "/" );

export function relativeFileUrlToPath ( fileUrl ) {
    if ( typeof fileUrl === "string" ) {

        // file url
        if ( fileUrl.startsWith( "file:" ) ) {

            // relative file url
            if ( fileUrl.charAt( 5 ) !== "/" ) {
                const idx = fileUrl.indexOf( "?" );

                return path.posix.normalize( fileUrl.substring( 5, idx > 0 ? idx : undefined ) );
            }

            // absolute file url
            else {
                return url.fileURLToPath( fileUrl );
            }
        }

        // file path
        else {
            return path.posix.normalize( fileUrl );
        }
    }

    // url object
    else {
        return url.fileURLToPath( fileUrl );
    }
}

export function relativePathToFileUrl ( pathname, fileUrl = ROOT_FILE_URL ) {
    if ( !( fileUrl instanceof URL ) ) fileUrl = new URL( fileUrl, ROOT_FILE_URL );

    if ( path.isAbsolute( pathname ) ) {
        fileUrl.pathname = url.pathToFileURL( pathname.replaceAll( "\\", "/" ) ).pathname;

        return fileUrl.href;
    }

    return "file:" + encodeURI( path.posix.normalize( pathname.replaceAll( "\\", "/" ) ) ) + fileUrl.search;
}
