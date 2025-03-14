import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Mime from "#lib/mime/mime";

const mime = new Mime(),
    update = async function ( resource ) {
        mime.clear().add( await readConfig( resource.getResourcePath( "mime.json" ) ) );
    },
    RESOURCE = await externalResources.add( "softvisio-node/core/resources/mime" ).on( "update", update ).check();

await update( RESOURCE );

export default mime;
