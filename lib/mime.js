import { readConfig, readConfigSync } from "#lib/config";
import externalResources from "#lib/external-resources";
import Mime from "#lib/mime/mime";

const mime = new Mime();

const RESOURCE = await externalResources
    .add( "softvisio-node/core/resources/mime" )
    .on( "update", RESOURCE => mime.clear().add( readConfigSync( RESOURCE.getResourcePath( "mime.json" ) ) ) )
    .check();

mime.add( await readConfig( RESOURCE.getResourcePath( "mime.json" ) ) );

export default mime;
