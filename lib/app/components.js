import "#lib/result";
import { readConfig } from "#lib/config";
import * as utils from "#lib/utils";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import { isKebabCase, kebabToCamelCase } from "#lib/utils/naming-conventions";
import ApiSchema from "#lib/app/api/schema";
import Ajv from "#lib/ajv";
import Locale from "#lib/locale";

const appConfigValidate = new Ajv().compile( readConfig( "#resources/schemas/app-config.schema.yaml", { "resolve": import.meta.url } ) ),
    appComponentConfigValidate = new Ajv().compile( readConfig( "#resources/schemas/app-component-config.schema.yaml", { "resolve": import.meta.url } ) );

export default class Components {
    #location;
    #app;
    #service;
    #config;
    #components = {};
    #isShuttingDown = false;
    #ajvCache = {};

    constructor ( location, { app } = {} ) {
        this.#location = location;
        this.#app = app;
    }

    // properties
    get app () {
        return this.#app;
    }

    get service () {
        return this.#service;
    }

    get config () {
        return this.#config;
    }

    // public
    has ( componentName ) {
        return !!this.#components[componentName];
    }

    get ( componentName ) {
        return this.#components[componentName];
    }

    // public
    loadConfig () {
        try {
            const registry = {
                "loadedConfigs": {},
                "components": {},
            };

            const res = this.#loadConfig( ".", this.#location, registry );
            if ( !res.ok ) return res;

            this.#components = registry.components;
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true } );
        }

        return result( 200 );
    }

    load ( service ) {

        // load config if not loaded
        if ( !this.#config ) {
            const res = this.loadConfig();
            if ( !res.ok ) return res;
        }

        this.#service = service || this.#config.defaultService;

        try {

            // unknown service name
            if ( this.#config.services ) {
                if ( !this.service ) {
                    return result( [400, `Service name is required`] );
                }
                else if ( !( this.#service in this.#config.services ) ) {
                    return result( [400, `Service name "${this.#service}" is not valid`] );
                }
            }
            else if ( this.service ) {
                return result( [400, `Service name "${this.#service}" is not valid`] );
            }

            const colors = {},
                serviceComponents = this.#config.services?.[this.service]?.components || {},
                components = {};

            const sort = ( componentName, required ) => {
                const component = this.#components[componentName];

                if ( !component ) return result( [400, `Component "${componentName}" is not registered`] );

                const color = colors[componentName] || "white";

                // components already processed
                if ( color === "black" ) {
                    if ( required ) component.required = true;

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
                    if ( serviceComponents[componentName] !== false ) {

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

                        components[componentName] = component;
                    }

                    // end processing component
                    colors[componentName] = "black";

                    return result( 200 );
                }
            };

            // global components
            for ( const component of Object.values( this.#components ) ) {
                if ( !component.config.global ) continue;

                // global components are required
                const res = sort( component.name, true );
                if ( !res.ok ) return res;
            }

            // topologically sort components
            for ( const [name, enabled] of Object.entries( serviceComponents ) ) {

                // component is disabled
                if ( !enabled ) continue;

                const res = sort( name, true );
                if ( !res.ok ) return res;
            }

            this.#components = components;

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true } );
        }
    }

    async create ( publicConfig ) {
        const components = {};

        // create components
        for ( const spec of Object.values( this.#components ) ) {
            try {

                // validate commpon component public config
                if ( publicConfig.components?.[spec.name] ) {
                    const res = this.#validateComponentConfig( spec, "public-config", publicConfig.components[spec.name] );
                    if ( !res.ok ) return res;
                }

                // validate service component public config
                if ( publicConfig.services?.[this.service]?.components?.[spec.name] ) {
                    const res = this.#validateComponentConfig( spec, "public-config", publicConfig.services[this.service].components[spec.name] );
                    if ( !res.ok ) return res;
                }

                let servicePrivateConfig = this.#config.services?.[this.service]?.components?.[spec.name];
                if ( servicePrivateConfig === true ) servicePrivateConfig = null;

                // merge config
                const config = utils.mergeObjects(
                    {},
                    spec.config.config, // component default config
                    this.#config.components?.[spec.name], // private common config
                    publicConfig.components?.[spec.name], // public common config
                    servicePrivateConfig, // service private config
                    publicConfig.services?.[this.service]?.components?.[spec.name] // service public config
                );

                const Class = ( await import( spec.module ) ).default;

                const component = new Class( {
                    "components": this,
                    "name": spec.name,
                    "location": spec.location,
                    "required": spec.required,
                    "dependencies": spec.config.dependencies,
                    "optionalDependencies": spec.config.optionalDependencies,
                    config,
                    "locale": spec.locale,
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
                if ( usedComponents.has( component.name ) ) return result( 200 );

                usedComponents.add( component.name );

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
            if ( !usedComponents.has( component.name ) ) delete this.#components[component.name];
        }

        // validate component env
        for ( const component of Object.values( this.#components ) ) {
            const res = this.#validateComponentConfig( component );
            if ( !res.ok ) return res;
        }

        console.log( `• Used components:`, Object.keys( this.#components ).sort().join( ", " ) || "-" );

        return result( 200 );
    }

    async install () {
        for ( const component of this ) {
            const res = await component.install();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async configureInstances () {
        var res;

        for ( const component of Object.values( this.#components ).reverse() ) {

            // configure component instance
            res = await component.configureInstance();
            if ( !res.ok ) return res;

            // validate component config
            res = this.#validateComponentConfig( component );
            if ( !res.ok ) return res;

            // freeze component config
            utils.freezeObjectRecursively( component.config );
        }

        this.#ajvCache = null;

        return result( 200 );
    }

    async init () {
        for ( const component of this ) {
            const res = await component.init();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async start () {
        for ( const component of this ) {
            if ( this.#isShuttingDown ) break;

            const res = await component.start();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async afterAppStarted () {
        for ( const component of this ) {
            if ( this.#isShuttingDown ) break;

            const res = await component.afterAppStarted();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        // shutting down components
        for ( const component of Object.values( this.#components ).reverse() ) {
            await component.shutDown();
        }
    }

    getSchema ( type ) {
        return this.#createApiSchema( type );
    }

    *[Symbol.iterator] () {
        for ( const component of Object.values( this.#components ) ) {
            yield component;
        }
    }

    // private
    #loadConfig ( location, resolve, registry ) {
        const configLocation = utils.resolve( location + "/app.yaml", resolve );

        // config is already loaded
        if ( registry.loadedConfigs[configLocation] ) return;

        registry.loadedConfigs[configLocation] = true;

        // read config
        const config = readConfig( configLocation, {
            resolve,
            "locaale": this.#app?.locale,
        } );

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

        this.#config = config;

        return result( 200 );
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
                componentConfigPath = path.join( componentLocation, "config.yaml" ),
                componentModulePath = url.pathToFileURL( path.join( componentLocation, "component.js" ) ),
                componentLocale = new Locale();

            if ( registry.components[componentName] ) return result( [500, `Component "${componentName}" is already registered`] );

            // component config is is not exists
            if ( !fs.existsSync( componentConfigPath ) ) return result( [500, `Component config "${componentConfigPath}" is not exists`] );

            // component module is not exists
            if ( !fs.existsSync( componentModulePath ) ) return result( [500, `Component module "${componentModulePath}" is not exists`] );

            const componentConfig = readConfig( componentConfigPath, {
                "locale": componentLocale,
            } );

            // validate component config structure
            if ( !appComponentConfigValidate( componentConfig ) ) {
                return result( [500, `Component config "${componentConfigPath}" is not valid:\n${appComponentConfigValidate.errors}`] );
            }

            registry.components[componentName] = {
                "name": componentName,
                "location": componentLocation,
                "module": componentModulePath,
                "config": componentConfig,
                "locale": componentLocale,
            };
        }

        return result( 200 );
    }

    #createApiSchema ( type ) {
        const schema = new ApiSchema( type );

        if ( this.#components[type] ) {
            const locations = [];

            for ( const location of [...Object.values( this.#components ).map( component => component.location ), path.dirname( url.fileURLToPath( this.#location ) )] ) {
                const schemaLocation = path.join( location, type );

                if ( !fs.existsSync( schemaLocation ) ) continue;

                locations.push( schemaLocation );
            }

            const res = schema.loadSchema( locations );

            if ( !res.ok ) return res;
        }

        return result( 200, schema );
    }

    #validateComponentConfig ( component, schema, config ) {
        var ajv = this.#ajvCache[component.name];

        if ( !ajv ) {
            const schemaPath = component.location + "/config.schema.yaml";

            if ( fs.existsSync( schemaPath ) ) {
                this.#ajvCache[component.name] = ajv = new Ajv().addSchema( readConfig( schemaPath ) );
            }
        }

        if ( schema ) {
            if ( ajv?.getSchema( schema ) && !ajv.validate( schema, config ) ) {
                return result( [400, `Component "${component.name}" ${schema} config is not valid:\n` + ajv.errors] );
            }
        }
        else {

            // validate env
            if ( ajv?.getSchema( "env" ) && !ajv.validate( "env", process.env ) ) {
                return result( [400, `Component "${component.name}" env is not valid:\n` + ajv.errors] );
            }

            // validate config
            if ( ajv?.getSchema( "config" ) && !ajv.validate( "config", component.config ) ) {
                return result( [400, `Component "${component.name}" config is not valid:\n` + ajv.errors] );
            }
        }

        return result( 200 );
    }
}
