import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Mime from "#lib/mime/mime";

const MIME = await externalResources
    .add( "softvisio-node/core/resources/mime" )

    // .on( "update", () => ( RESOURCES = null ) )
    .check();

const mime = new Mime();

for ( const type of readConfig( MIME.getResourcePath( "mime.json" ) ) ) {
    mime.add( type );
}

export default mime;
