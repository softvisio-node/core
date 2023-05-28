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
    has ( componentName ) {
        return !!this.#components[componentName];
    }

    get ( componentName ) {
        return this.#components[componentName];
    }

    load ( mode ) {
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
                components = appConfig.modes[mode || "default"];

            if ( !components ) return result( [500, `App mode is invalid`] );

            const sort = ( componentName, required ) => {
                const component = registry.components[componentName];

                if ( !component ) return result( [400, `Component "${componentName}" is not registered`] );

                const color = colors[componentName] || "white";

                // components already processed
                if ( color === "black" ) {
                    return result( 200 );
                }

                // cyclic dependency
                else if ( color === "grey" ) {
                    return result( [500, `Cyclic dependency: "${componentName}"`] );
                }

                // process component
                else {

                    // start processing component
                    colors[componentName] = "grey";

                    // component is allowed
                    if ( components[componentName] !== false ) {

                        // process component dependencies
                        if ( component.config.dependencies ) {
                            for ( const componentName of component.config.dependencies ) {
                                const res = sort( componentName, required );

                                if ( !res.ok ) return res;
                            }
                        }

                        // process component optional dependencies
                        if ( component.config.optionalDependencies ) {
                            for ( const componentName of component.config.optionalDependencies ) {
                                const res = sort( componentName, false );

                                if ( !res.ok ) return res;
                            }
                        }

                        // register required component
                        if ( required ) component.required = true;

                        component.appConfig = appConfig.components?.[componentName];
                        if ( component.appConfig === true ) component.appConfig = null;

                        this.#components[componentName] = component;
                    }

                    // end processing component
                    colors[componentName] = "black";

                    return result( 200 );
                }
            };

            // topologically sort components
            for ( const componentName of Object.keys( components ) ) {
                const res = sort( componentName, true );

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

        const components = {};

        // create components
        for ( const spec of Object.values( this.#components ) ) {
            try {
                const Class = ( await import( spec.module ) ).default;

                const component = new Class( {
                    "components": this,
                    "name": spec.name,
                    "location": spec.location,
                    "required": spec.required,
                    "dependencies": spec.config.dependencies,
                    "optionalDependencies": spec.config.optionalDependencies,
                    "config": utils.mergeObjects( [
                        {},
                        spec.config.config, // component default config
                        spec.appConfig, // component app config
                        runtimeConfig?.[spec.name], // component runtime config
                    ] ),
                } );

                components[component.name] = component;
            }
            catch ( e ) {
                return result.catch( e, { "keepError": true } );
            }
        }

        this.#components = components;

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

        const components = this.#components;
        this.#components = {};

        // check enabled
        for ( const component of Object.values( components ) ) {
            const isEnabled = await component.checkEnabled();

            // component is disabled
            if ( !isEnabled ) {

                // required component is disabled
                if ( component.isRequired ) {
                    return result( [500, `Required component "${component.name}" is not enabled`] );
                }

                continue;
            }

            this.#components[component.name] = component;
        }

        // check dependecies
        const usedComponents = new Set(),
            checkDependencies = component => {
                if ( usedComponents.has( component ) ) return result( 200 );

                usedComponents.add( component );

                for ( const dependency of component.dependencies ) {
                    if ( !this.has( dependency ) ) {
                        return result( [500, `Component "${dependency}" required by "${component.name}" is not enabled`] );
                    }

                    const res = checkDependencies( this.get( dependency ) );
                    if ( !res.ok ) return res;
                }

                for ( const dependency of component.optionalDependencies ) {
                    if ( !this.has( dependency ) ) continue;

                    const res = checkDependencies( this.get( dependency ) );
                    if ( !res.ok ) return res;
                }

                return result( 200 );
            };

        for ( const component of Object.values( this.#components ).reverse() ) {
            if ( component.isRequired ) {
                const res = checkDependencies( component );
                if ( !res.ok ) return res;
            }
        }

        // exclude not used components
        for ( const component of Object.values( this.#components ).reverse() ) {
            if ( !usedComponents.has( component ) ) delete this.#components[component.name];
        }

        // validate component env
        for ( const component of Object.values( this.#components ) ) {
            const envSchemaPath = component.location + "/schemas/env.schema.yaml",
                configSchemaPath = component.location + "/schemas/config.schema.yaml";

            // validate env
            if ( fs.existsSync( envSchemaPath ) ) {
                const validate = new Ajv().compile( readConfig( envSchemaPath ) );

                if ( !validate( process.env ) ) {
                    return result( [400, `Component "${component.name}" env is not valid:\n` + validate.errors] );
                }
            }

            // validate config
            if ( fs.existsSync( configSchemaPath ) ) {
                const validate = new Ajv().compile( readConfig( configSchemaPath ) );

                if ( !validate( component.config ) ) {
                    return result( [400, `Component "${component.name}" config is not valid:\n` + validate.errors] );
                }
            }
        }

        console.log( `Application components:`, Object.keys( this.#components ).sort().join( ", " ) || "-" );

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

            // component must install some true value
            if ( !component.value ) {
                return result( [400, `Component "${component.name}" must install some tru value`] );
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

    getSchema ( type ) {
        return this.#createApiSchema( type );
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

    #createApiSchema ( type ) {
        const schema = new ApiSchema( type );

        const locations = [];

        for ( const location of [...Object.values( this.#components ).map( component => component.location ), path.dirname( url.fileURLToPath( this.#location ) )] ) {
            const schemaLocation = path.join( location, type );

            if ( !fs.existsSync( schemaLocation ) ) continue;

            locations.push( schemaLocation );
        }

        const res = schema.loadSchema( locations );

        if ( !res.ok ) return res;

        return result( 200, schema );
    }
}
