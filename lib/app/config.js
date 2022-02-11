import crypto from "crypto";
import Ajv from "#lib/ajv";
import { read as readConfig } from "#lib/config";
import { resolve } from "#lib/utils";

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

export function validateAppConfig ( appLocation, config, env ) {

    // validate app config
    const configSchema = new Ajv().addSchema( readConfig( "#resources/schemas/app.config.schema.yaml", { "resolve": import.meta.url } ) );

    // app
    if ( !configSchema.validate( "app", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );

    // api
    if ( config.apiEnabled ) {
        if ( !configSchema.validate( "api", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );
        if ( !configSchema.validate( "permissions", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );
        if ( config.objects && !configSchema.validate( "objects", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );
    }

    // rpc
    if ( config.rpcEnabled && !configSchema.validate( "rpc", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );

    // notifications
    if ( config.notificationsEnabled && !configSchema.validate( "notifications", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );

    // validate env
    const envSchema = new Ajv().addSchema( readConfig( "#resources/schemas/app.env.schema.yaml", { "resolve": import.meta.url } ) );

    // root user
    if ( config.apiEnabled && !envSchema.validate( "root", env.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // smtp settings
    if ( config.apiEnabled && !envSchema.validate( "smtp", env.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // app settings
    if ( config.apiEnabled && !envSchema.validate( "app-settings", env.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // database
    if ( ( config.apiEnabled || config.notificationsEnabled ) && !envSchema.validate( "database", env.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // custom schema
    try {
        var customSchemaPath = resolve( "#resources/schemas/app.env.schema.yaml", appLocation );
    }
    catch ( e ) {}

    if ( customSchemaPath ) {
        const customSchema = readConfig( customSchemaPath );

        const validator = envSchema.compile( customSchema );

        if ( !validator( env ) ) return result( [400, `Application environment is not valid`], validator.errors );
    }

    return result( 200 );
}
