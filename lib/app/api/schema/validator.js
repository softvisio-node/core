import Ajv from "#lib/ajv";
import { read as readConfig } from "#lib/config";
import readKeyword from "./keywords/read.js";
import fileKeyword from "./keywords/file.js";

export const schemaValidator = Ajv.new().addSchema( readConfig( "#resources/schemas/api.schema.yaml", { "resolve": import.meta.url } ) );

export const buildParamsValidator = paramsSchema => Ajv.new().addKeyword( readKeyword.keyword ).addKeyword( fileKeyword.keyword ).compile( paramsSchema );
