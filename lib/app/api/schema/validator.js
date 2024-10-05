import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import aclResolver from "./keywords/acl-resolver.js";
import fileKeyword from "./keywords/file.js";
import readKeyword from "./keywords/read.js";

export const schemaValidator = new Ajv() //
    .addSchema( readConfig( "#resources/schemas/api.schema.yaml", { "resolve": import.meta.url } ) );

export const buildParamsValidator = paramsSchema =>
    new Ajv() //
        .addKeyword( readKeyword.keyword )
        .addKeyword( fileKeyword.keyword )
        .addKeyword( aclResolver )
        .compile( paramsSchema );
