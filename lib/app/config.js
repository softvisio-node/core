import crypto from "crypto";
import Ajv from "#lib/ajv";
import { read as readConfig } from "#lib/config";

const DEFAULT = {

    // api settings
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

    // connections
    "apiMaxPayloadLength": 1024 * 64, // 64K
    "apiIdleTimeout": 40,
    "apiSendPingsAutomatically": true,
    "apiCompression": true,
    "rpcMaxPayloadLength": 1024 * 64, // 64K
    "rpcIdleTimeout": 0,
    "rpcSendPingsAutomatically": true,
    "rpcCompression": false,
};

export function mergeAppConfig ( config = {} ) {

    // merge with default values
    for ( const key in DEFAULT ) config[key] ??= DEFAULT[key];

    // calculated settings
    config.notificationsEnabled ??= config.apiEnabled;
    config.threadsEnabled ??= config.apiEnabled;

    config.publicHttpServerEnabled ??= config.apiEnabled;
    config.privateHttpServerEnabled ??= config.rpcEnabled;

    config.publicHttpServerPort ||= 80;
    config.privateHttpServerPort ||= config.publicHttpServerEnabled ? 81 : 80;

    config.defaultGravatarUrl ??= `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( config.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${config.defaultGravatarImage}`;

    config.defaultGravatarImage = encodeURIComponent( config.defaultGravatarImage );

    return config;
}

export function validateAppConfig ( app, config, env ) {

    // validate config
    const validator = new Ajv().compile( readConfig( "#resources/schemas/app.config.schema.yaml", { "resolve": import.meta.url } ) );

    if ( !validator( config ) ) return result( [500, `Application config is not valid`], validator.errors );

    // validate env
    // const envValidator = new Ajv().compile( readConfig( "#resources/schemas/app.env.schema.yaml", { "resolve": import.meta.url } ) );

    return result( 200 );
}
