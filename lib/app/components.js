import "#lib/result";
import { readConfig } from "#lib/config";
import * as utils from "#lib/utils";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import { isKebabCase, kebabToCamelCase } from "#lib/utils/naming-conventions";
import ApiSchema from "#lib/app/api/frontend/schema";
import Ajv from "#lib/ajv";

const appConfigValidate = new Ajv().compile( readConfig( "#resources/schemas/app-config.schema.yaml", { "resolve": import.meta.url } ) ),
    appComponentConfigValidate = new Ajv().compile( readConfig( "#resources/schemas/app-component-config.schema.yaml", { "resolve": import.meta.url } ) );

export default class Components {
    #location;
    #app;
    #specs = {};
    #components = {};

    #isLoaded;
    #isCreated;
    #isConfigured;
    #isInstalled;
    #isInitialized;
    #isStarted = false;
    #isShuttingDown = false;

    constructor ( location ) {
        this.#location = location;
    }

    // properties
    get app () {
        return this.#app;
    }

    // public
    get ( componentName ) {
        return this.#components[componentName];
    }

    load () {
        if ( this.#isLoaded ) return result( [500, `Components are already loaded`] );
        this.#isLoaded = true;

        try {
            const registry = {
                "loadedConfigs": {},
                "components": {},
            };

            const res = this.#loadConfig( ".", this.#location, registry );
            if ( !res.ok ) return res;

            const appConfig = res.data,
                colors = {},
                requiredComponents = new Set();

            // create required components index
            for ( const componentName of Object.keys( appConfig.components || {} ) ) {
                const component = registry.components[componentName];

                requiredComponents.add( componentName );

                for ( const componentName of component?.config.dependencies || [] ) {
                    requiredComponents.add( componentName );
                }
            }

            const sort = componentName => {
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

                    // process component dependencies
                    if ( component.config.dependencies ) {
                        for ( const componentName of component.config.dependencies ) {
                            const res = sort( componentName );

                            if ( !res.ok ) return res;
                        }
                    }

                    // process component optional dependencies
                    if ( component.config.optionalDependencies ) {
                        for ( const componentName of component.config.optionalDependencies ) {

                            // optional dependency is not used
                            if ( !requiredComponents.has( componentName ) ) continue;

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

            return result( 200, appConfig.config );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true } );
        }
    }

    async create ( app, runtimeConfig ) {
        if ( this.#isCreated ) return result( [500, `Component are already created`] );
        this.#isCreated = true;

        if ( !this.#isLoaded ) {
            const res = this.load();
            if ( !res.ok ) return res;
        }

        this.#app = app;

        // create components
        for ( const spec of Object.values( this.#specs ) ) {
            try {
                const Class = ( await import( spec.module ) ).default;

                const component = new Class(
                    this,
                    spec.name,
                    spec.location,
                    spec.config.dependencies,
                    utils.mergeObjects( [
                        {},
                        spec.config.config, // component default config
                        spec.appConfig, // component app config
                        runtimeConfig?.[spec.name], // component runtime config
                    ] )
                );

                this.#components[component.name] = component;
            }
            catch ( e ) {
                return result.catch( e, { "keepError": true } );
            }
        }

        return result( 200 );
    }

    async configure () {
        if ( this.#isConfigured ) return result( [500, `Component are already configured`] );
        this.#isConfigured = true;

        if ( !this.#isCreated ) return result( [500, `Component are not created`] );

        // configure in the reverse order
        for ( const component of Object.values( this.#components ).reverse() ) {
            const res = await component.configure();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async install () {
        if ( this.#isInstalled ) return result( [500, `Component are already installed`] );
        this.#isInstalled = true;

        if ( !this.#isConfigured ) {
            const res = await this.configure();
            if ( !res.ok ) return res;
        }

        for ( const component of Object.values( this.#components ) ) {
            const res = await component.install();

            if ( !res.ok ) return res;

            // component is installed, check required dependencies are installed too
            if ( component.value != null ) {
                for ( const dependency of component.dependencies ) {
                    if ( this.get( dependency )?.value == null ) {
                        return result( [500, `Component "${dependency}" required by "${component.name}" is not installed`] );
                    }
                }
            }
        }

        return result( 200 );
    }

    async init () {
        if ( this.#isInitialized ) return result( [500, `Component are already initialized`] );
        this.#isInitialized = true;

        if ( !this.#isInstalled ) {
            const res = await this.install();
            if ( !res.ok ) return res;
        }

        for ( const component of Object.values( this.#components ) ) {
            const res = await component.init();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async run () {
        if ( this.#isStarted ) return result( [500, `Component are already started`] );
        this.#isStarted = true;

        if ( this.#isShuttingDown ) return result( 200 );

        if ( !this.#isInitialized ) {
            const res = await this.init();
            if ( !res.ok ) return res;
        }

        for ( const component of Object.values( this.#components ) ) {
            if ( this.#isShuttingDown ) break;

            const res = await component.run();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async shutDown () {
        if ( !this.#isStarted ) return;

        this.#isShuttingDown = true;

        // shutting down components
        for ( const component of Object.values( this.#components ).reverse() ) {
            await component.shutDown();
        }

        this.#isStarted = false;
    }

    // private
    #loadConfig ( location, resolve, registry ) {
        const configLocation = utils.resolve( location + "/app.yaml", resolve );

        // config is already loaded
        if ( registry.loadedConfigs[configLocation] ) return;

        registry.loadedConfigs[configLocation] = true;

        // read config
        const config = readConfig( configLocation, { resolve } );

        // validate config
        if ( !appConfigValidate( config ) ) {
            return result( [500, `Application config "${configLocation}" is not valid:\n${appConfigValidate.errors}`] );
        }

        const res = this.#loadComponents( configLocation, registry );
        if ( !res.ok ) return res;

        if ( config.dependencies ) {
            for ( const location of config.dependencies ) {
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
            if ( !isKebabCase( componentId ) ) {
                return result( [500, `Component id "${componentId}" should be in the kebab-case`] );
            }

            const componentName = kebabToCamelCase( componentId ),
                componentLocation = path.join( componentsLocation, componentId ),
                componentConfigPath = path.join( componentLocation, "index.yaml" ),
                componentModulePath = url.pathToFileURL( path.join( componentLocation, "index.js" ) );

            if ( registry.components[componentName] ) return result( [500, `Component "${componentName}" is already registered`] );

            // component config is is not exists
            if ( !fs.existsSync( componentConfigPath ) ) return result( [500, `Component config "${componentConfigPath}" is not exists`] );

            // component module is not exists
            if ( !fs.existsSync( componentModulePath ) ) return result( [500, `Component module "${componentModulePath}" is not exists`] );

            const componentConfig = readConfig( componentConfigPath );

            // validate component config
            if ( !appComponentConfigValidate( componentConfig ) ) {
                return result( [500, `Component config "${componentConfigPath}" is not valid:\n${appComponentConfigValidate.errors}`] );
            }

            registry.components[componentName] = {
                "name": componentName,
                "location": componentLocation,
                "module": componentModulePath,
                "config": componentConfig,
            };
        }

        return result( 200 );
    }

    getSchema ( type ) {
        return this.#createApiSchema( type );
    }

    // private
    #createApiSchema ( type ) {
        const schema = new ApiSchema( type );

        const locations = [];

        for ( const location of [...Object.values( this.#specs ).map( component => component.location ), path.dirname( url.fileURLToPath( this.#location ) )] ) {
            const schemaLocation = path.join( location, type );

            if ( !fs.existsSync( schemaLocation ) ) continue;

            locations.push( schemaLocation );
        }

        const res = schema.loadSchema( locations );

        if ( !res.ok ) return res;

        return result( 200, schema );
    }
}
