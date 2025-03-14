import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Mime from "#lib/mime/mime";

const mime = new Mime(),
    update = async function ( resource ) {
        mime.update( await readConfig( resource.getResourcePath( "mime.json" ) ) );
    },
    resource = await externalResources
        .add( "softvisio-node/core/resources/mime", {
            "autoUpdate": true,
        } )
        .on( "update", update )
        .check();

await update( resource );

export default mime;
