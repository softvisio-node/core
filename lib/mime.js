import { readConfig } from "#lib/config";
import externalResources from "#lib/external-resources";
import Mime from "#lib/mime/mime";

const mime = new Mime();

const RESOURCE = await externalResources
    .add( "softvisio-node/core/resources/mime" )
    .on( "update", RESOURCE => mime.clear().add( readConfig( RESOURCE.getResourcePath( "mime.json" ) ) ) )
    .check();

mime.add( readConfig( RESOURCE.getResourcePath( "mime.json" ) ) );

export default mime;
