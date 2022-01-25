import crypto from "crypto";
import Ajv from "#lib/ajv";
import { read as readConfig } from "#lib/config";

const DEFAULT = {
    "usernameIsEmail": true,
    "newUserEnabled": true,
    "defaultGravatarEmail": "noname@softvisio.net", // used, if user email is not set
    "defaultGravatarImage": "identicon", // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank
    "authCacheMaxSize": 10_000,
    "authCacheLastActivityDropInterval": 1000 * 60, // ms, 1 min.
    "sessionMaxAge": 1000 * 60 * 60 * 24 * 30, // ms, 30 days
    "tokenMaxAge": 1000 * 60 * 60 * 24, // ms, 1 day
    "objectUserCacheMaxSize": 10_000,
    "apiCallLogCacheDropInterval": 10_000, // ms, 10 sec.
};

export default function mergeConfig ( config = {} ) {

    // merge with default values
    for ( const key in DEFAULT ) config[key] ??= DEFAULT[key];

    config.defaultGravatarUrl ??= `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( config.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${config.defaultGravatarImage}`;

    // validate config
    const validator = Ajv.new().compile( readConfig( "#resources/schemas/app.config.schema.yaml", { "resolve": import.meta.url } ) );

    if ( !validator( config ) ) {
        console.log( "Application config is not valid, inspect errors below:" );

        console.log( validator.errors );

        process.exit( 2 );
    }

    config.defaultGravatarImage = encodeURIComponent( config.defaultGravatarImage );

    return config;
}
