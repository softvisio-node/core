import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Mime from "#lib/mime/mime";

const mime = new Mime();

const MIME = await externalResources
    .add( "softvisio-node/core/resources/mime" )
    .on( "update", () => mime.clear().addTypes( readConfig( MIME.getResourcePath( "mime.json" ) ) ) )
    .check();

mime.addTypes( readConfig( MIME.getResourcePath( "mime.json" ) ) );

export default mime;
