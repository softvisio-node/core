import crypto from "crypto";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import { resolve } from "#lib/utils";

const DEFAULT_LOCALE = "en-GB",
    DEFAULT_CURRENCY = "USD";

const DEFAULT = {

    // locale
    "locales": new Set( [DEFAULT_LOCALE] ),
    "defaultLocale": DEFAULT_LOCALE,
    "currency": DEFAULT_CURRENCY,

    // app
    "apiEnabled": false,
    "rpcEnabled": false,

    // api settings
    "newUserEnabled": true,
    "defaultGravatarImage": "noname@softvisio.net", // email, url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank
    "authCacheMaxSize": 10_000,
    "authCacheLastActivityDropInterval": 1000 * 60, // ms, 1 min.
    "sessionMaxAge": 1000 * 60 * 60 * 24 * 30, // ms, 30 days
    "authorizedSessionMaxAge": 1000 * 60 * 5, // 5 minutes
    "actionTokenMaxAge": 1000 * 60 * 10, // ms, 10 minutes
    "objectUserCacheMaxSize": 10_000,
    "apiCallLogCacheDropInterval": 10_000, // ms, 10 sec.

    "privateHttpServerAddress": "0.0.0.0",
    "publicHttpServerAddress": "0.0.0.0",

    "privateHttpServerPort": null,
    "publicHttpServerPort": null,

    // api connections
    "apiMaxPayloadLength": 1024 * 64, // 64K
    "apiIdleTimeout": 40,
    "apiSendPingsAutomatically": true,
    "apiCompress": null, // use server default

    // rpc connections
    "rpcMaxPayloadLength": 1024 * 64, // 64K
    "rpcIdleTimeout": 0,
    "rpcSendPingsAutomatically": true,
    "rpcCompress": false, // do not compress rpc messages
};

export function mergeAppConfig ( config = {} ) {

    // merge with default values
    for ( const key in DEFAULT ) config[key] ??= DEFAULT[key];

    // locale
    if ( !( config.locales instanceof Set ) ) {
        config.locales = new Set( config.locales );
    }

    // calculated settings
    config.notificationsEnabled ??= config.apiEnabled;
    config.threadsEnabled ??= config.apiEnabled;

    config.publicHttpServerEnabled ??= config.apiEnabled;
    config.privateHttpServerEnabled ??= config.rpcEnabled;

    config.publicHttpServerPort ??= 80;
    config.privateHttpServerPort ??= config.publicHttpServerEnabled ? 81 : 80;

    // email
    if ( config.defaultGravatarImage.includes( "@" ) ) {
        config.defaultGravatarEncoded = `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( config.defaultGravatarImage.toLowerCase() ).digest( "hex" )}?d=404`;
    }
    else {
        config.defaultGravatarEncoded = config.defaultGravatarImage;
    }

    config.defaultGravatarEncoded = encodeURIComponent( config.defaultGravatarEncoded );

    return config;
}

export function validateAppConfig ( appLocation, config, env ) {

    // validate default locale
    if ( !config.locales.has( config.defaultLocale ) ) return result( [400, `App default locale is not exists in locales list`] );

    // validate app config
    const configSchema = new Ajv().addSchema( readConfig( "#resources/schemas/app.config.schema.yaml", { "resolve": import.meta.url } ) );

    // app
    if ( !configSchema.validate( "app", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );

    // api
    if ( config.apiEnabled ) {
        if ( !configSchema.validate( "api", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );
        if ( !configSchema.validate( "roles", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );
        if ( config.acl && !configSchema.validate( "acl", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );
    }

    // rpc
    if ( config.rpcEnabled && !configSchema.validate( "rpc", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );

    // notifications
    if ( config.notificationsEnabled && !configSchema.validate( "notifications", config ) ) return result( [400, `Application config is not valid`], configSchema.errors );

    // validate env
    const envSchema = new Ajv().addSchema( readConfig( "#resources/schemas/app.env.schema.yaml", { "resolve": import.meta.url } ) );

    // root user
    if ( config.apiEnabled && !envSchema.validate( "root", process.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // smtp settings
    if ( config.apiEnabled && !envSchema.validate( "smtp", process.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // app settings
    if ( config.apiEnabled && !envSchema.validate( "app-settings", process.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // database
    if ( ( config.apiEnabled || config.notificationsEnabled ) && !envSchema.validate( "database", process.env ) ) return result( [400, `Application environment is not valid`], envSchema.errors );

    // custom schema
    try {
        var customSchemaPath = resolve( "#resources/schemas/app.env.schema.yaml", appLocation );
    }
    catch ( e ) {}

    if ( customSchemaPath ) {
        const customSchema = readConfig( customSchemaPath );

        const validator = envSchema.compile( customSchema );

        env.env = process.env;

        if ( !validator( env ) ) {
            delete env.env;

            return result( [400, `Application environment is not valid`], validator.errors );
        }
        else {
            delete env.env;
        }
    }

    return result( 200 );
}
