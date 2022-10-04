import "#lib/result";
import { readConfig } from "#lib/config";
import * as utils from "#lib/utils";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import env from "#lib/env";
import { isKebabCase, kebabToCamelCase } from "#lib/utils/naming-conventions";
import ApiSchema from "#lib/app/api/schema";

export default class Components {
    #location;
    #app;
    #isInitialized;
    #isStarted;
    #specs = {};
    #components = {};

    constructor ( location ) {
        this.#location = location;

        this.init();
    }

    // properties
    get app () {
        return this.#app;
    }

    // public
    get ( componentName ) {
        return this.#components[componentName];
    }

    init () {
        if ( this.#isInitialized ) return result( [400, `Components are already initialized`] );

        this.#isInitialized = true;

        try {
            const registry = {
                "loadedConfigs": {},
                "components": {},
            };

            const res = this.#loadConfig( ".", this.#location, registry );
            if ( !res.ok ) return res;

            const appConfig = res.data,
                colors = {},
                sort = componentName => {
                    const component = registry.components[componentName];

                    if ( !component ) return result( [400, `Component "${componentName}" is not registered`] );

                    const color = colors[componentName] || "white";

                    if ( color === "black" ) {
                        return result( 200 );
                    }
                    else if ( color === "grey" ) {
                        return result( [500, `Cyclic dependency: "${componentName}"`] );
                    }
                    else {
                        colors[componentName] = "grey";

                        if ( component.config.dependencies ) {
                            for ( const componentName of component.config.dependencies ) {
                                const res = sort( componentName );

                                if ( !res.ok ) return res;
                            }
                        }

                        colors[componentName] = "black";

                        component.appConfig = appConfig.components?.[componentName];

                        this.#specs[componentName] = component;

                        return result( 200 );
                    }
                };

            // topologically sort components
            for ( const componentName of Object.keys( appConfig.components || {} ) ) {
                const res = sort( componentName );

                if ( !res.ok ) return res;
            }
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async run ( app ) {
        var res;

        if ( !this.#isInitialized ) {
            res = this.init();

            if ( !res.ok ) return res;
        }

        if ( this.#isStarted ) return result( [400, `Components are already started`] );

        this.#isStarted = true;

        this.#app = app;

        // load app env
        const _env = env.loadEnv();

        // create components
        for ( const spec of Object.values( this.#specs ) ) {
            const Class = ( await import( spec.module ) ).default;

            const component = new Class( this, spec.name, spec.location, utils.mergeObjects( {}, spec.config.config, spec.appConfig, _env[spec.name] ) );

            this.#components[component.name] = component;
        }

        // configure components
        for ( const component of Object.values( this.#components ) ) {
            const res = await component.configure();
            if ( !res.ok ) {
                console.log( `Error configuring component "${component.name}":`, res + "" );

                return res;
            }
        }

        // install components
        for ( const component of Object.values( this.#components ) ) {
            const res = await component.install();

            if ( !res.ok ) {
                console.log( `Error installing component "${component.name}":`, res + "" );

                return res;
            }
        }

        // init components
        for ( const component of Object.values( this.#components ) ) {
            const res = await component.init();

            if ( !res.ok ) {
                console.log( `Error initializing component "${component.name}":`, res + "" );

                return res;
            }
        }

        // run components
        for ( const component of Object.values( this.#components ) ) {
            const res = await component.run();

            if ( !res.ok ) {
                console.log( `Error running component "${component.name}":`, res + "" );

                return res;
            }
        }

        return result( 200 );
    }

    // private
    #loadConfig ( location, resolve, registry ) {
        const configLocation = utils.resolve( location + "/app.yaml", resolve );

        // config is already loaded
        if ( registry.loadedConfigs[configLocation] ) return;

        registry.loadedConfigs[configLocation] = true;

        const config = readConfig( configLocation, { resolve } );

        const res = this.#loadComponents( configLocation, registry );
        if ( !res.ok ) return res;

        if ( config.use ) {
            for ( const location of config.use ) {
                const res = this.#loadConfig( location, configLocation, registry );
                if ( !res.ok ) return res;
            }
        }

        return result( 200, config );
    }

    #loadComponents ( appConfiglocation, registry ) {
        const componentsLocation = path.join( path.dirname( appConfiglocation ), "components" );

        // components directory is not exists
        if ( !fs.existsSync( componentsLocation ) ) return result( 200 );

        for ( const dirent of fs.readdirSync( componentsLocation, { "withFileTypes": true } ) ) {
            if ( !dirent.isDirectory() ) continue;

            const componentId = dirent.name;

            // compinent name is not in kebab case
            if ( !isKebabCase( componentId ) ) return result( [500, `Component id "${componentId}" should be in the kebab-case`] );

            const componentName = kebabToCamelCase( componentId ),
                componentLocation = path.join( componentsLocation, componentId ),
                componentConfigPath = path.join( componentLocation, "index.yaml" ),
                componentModulePath = url.pathToFileURL( path.join( componentLocation, "index.js" ) );

            if ( registry.components[componentName] ) return result( [500, `Component "${componentName}" is already registered`] );

            // component config is is not exists
            if ( !fs.existsSync( componentConfigPath ) ) return result( [500, `Component config "${componentConfigPath}" is not exists`] );

            // component module is is not exists
            if ( !fs.existsSync( componentModulePath ) ) return result( [500, `Component module "${componentModulePath}" is not exists`] );

            const componentConfig = readConfig( componentConfigPath );

            registry.components[componentName] = {
                "name": componentName,
                "location": componentLocation,
                "module": componentModulePath,
                "config": componentConfig,
            };
        }

        return result( 200 );
    }

    // XXX
    getApiSchema () {
        return new ApiSchema();
    }

    // XXX
    getRpcSchema () {
        const schema = new ApiSchema();

        for ( const component of Object.values( this.#specs ) ) {
            const location = path.join( component.location, "rpc" );

            if ( !fs.existsSync( location ) ) continue;

            schema.addLocation( location );
        }

        process.exit();

        return schema;
    }
}
