import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import readKeyword from "./keywords/read.js";
import fileKeyword from "./keywords/file.js";
import checkAclKeyword from "./keywords/check-acl.js";

export const schemaValidator = new Ajv() //
    .addSchema( readConfig( "#resources/schemas/api.schema.yaml", { "resolve": import.meta.url } ) );

export const buildParamsValidator = paramsSchema =>
    new Ajv() //
        .addKeyword( readKeyword.keyword )
        .addKeyword( fileKeyword.keyword )
        .addKeyword( checkAclKeyword )
        .compile( paramsSchema );
