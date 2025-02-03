import "#lib/result";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import Ajv from "#lib/ajv";
import ApiSchema from "#lib/app/api/schema";
import { readConfig, readConfigSync } from "#lib/config";
import { isKebabCase, kebabToCamelCase } from "#lib/naming-conventions";
import * as utils from "#lib/utils";
import Component from "./component.js";

const appConfigValidate = new Ajv().compile( await readConfig( "#resources/schemas/app-config.schema.yaml", { "resolve": import.meta.url } ) ),
    appComponentConfigValidate = new Ajv().compile( await readConfig( "#resources/schemas/app-component-config.schema.yaml", { "resolve": import.meta.url } ) );

var TEMPLATES_CACHE = {};

export default class Components {
    #location;
    #app;
    #service;
    #config;
    #components = {};
    #isDestroying = false;
    #ajvCache = {};
    #packages = [];

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

    get packages () {
        return this.#packages;
    }

    // public
    has ( componentId ) {
        return !!this.#components[ componentId ];
    }

    get ( componentId ) {
        return this.#components[ componentId ];
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
            return result.catch( e );
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
                    return result( [ 400, `Service name is required` ] );
                }
                else if ( !( this.#service in this.#config.services ) ) {
                    return result( [ 400, `Service name "${ this.#service }" is not valid` ] );
                }
            }
            else if ( this.service ) {
                return result( [ 400, `Service name "${ this.#service }" is not valid` ] );
            }

            const colors = {},
                serviceComponents = this.#config.services?.[ this.service ]?.components || {},
                components = {};

            const sort = ( componentId, required ) => {
                const component = this.#components[ componentId ];

                if ( !component ) return result( [ 400, `Component "${ componentId }" is not registered` ] );

                const color = colors[ componentId ] || "white";

                // components already processed
                if ( color === "black" ) {
                    if ( required ) component.required = true;

                    return result( 200 );
                }

                // cyclic dependency
                else if ( color === "grey" ) {
                    return result( [ 500, `Cyclic dependency: "${ componentId }"` ] );
                }

                // process component
                else {

                    // start processing component
                    colors[ componentId ] = "grey";

                    // component is allowed
                    if ( serviceComponents[ componentId ] !== false ) {

                        // process component dependencies
                        if ( component.config.dependencies ) {
                            for ( const componentId of component.config.dependencies ) {
                                const res = sort( componentId, required );

                                if ( !res.ok ) return res;
                            }
                        }

                        // process component optional dependencies
                        if ( component.config.optionalDependencies ) {
                            for ( const componentId of component.config.optionalDependencies ) {
                                const res = sort( componentId, false );

                                if ( !res.ok ) return res;
                            }
                        }

                        // register required component
                        if ( required ) component.required = true;

                        components[ componentId ] = component;
                    }

                    // end processing component
                    colors[ componentId ] = "black";

                    return result( 200 );
                }
            };

            // global components
            for ( const component of Object.values( this.#components ) ) {
                if ( !component.config.global ) continue;

                // global components are required
                const res = sort( component.id, true );
                if ( !res.ok ) return res;
            }

            // topologically sort components
            for ( const [ id, enabled ] of Object.entries( serviceComponents ) ) {

                // component is disabled
                if ( !enabled ) continue;

                const res = sort( id, true );
                if ( !res.ok ) return res;
            }

            const checkRequiredComponents = component => {
                if ( !component.required ) return;

                if ( !component.config.dependencies ) return;

                for ( const dependency of component.config.dependencies ) {
                    components[ dependency ].required = true;

                    checkRequiredComponents( components[ dependency ] );
                }
            };

            // check requires deps
            for ( const component of Object.values( components ).reverse() ) {
                checkRequiredComponents( component );
            }

            this.#components = components;

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async create ( publicConfig ) {
        const components = {};

        // create components
        for ( const spec of Object.values( this.#components ) ) {
            try {

                // store component templates
                if ( spec.config.templates ) {
                    TEMPLATES_CACHE[ spec.id ] = spec.config.templates;
                }

                // create component
                const Class = ( await import( spec.module ) ).default( Component );

                const component = new Class( {
                    "components": this,
                    "id": spec.id,
                    "location": spec.location,
                    "required": spec.required,
                    "dependencies": spec.config.dependencies,
                    "optionalDependencies": spec.config.optionalDependencies,
                    "config": {},
                } );

                // apply sub-configs
                component.applySubConfig();

                let servicePrivateConfig = this.#config.services?.[ this.service ]?.components?.[ spec.id ];
                if ( servicePrivateConfig === true ) servicePrivateConfig = null;

                // merge config
                utils.mergeObjects(
                    component.config,

                    // component default config
                    spec.config.config,

                    // private common config
                    this.#config.components?.[ spec.id ],

                    // public common config
                    publicConfig.components?.[ spec.id ],

                    // service private config
                    servicePrivateConfig,

                    // service public config
                    publicConfig.services?.[ this.service ]?.components?.[ spec.id ]
                );

                // create component public config
                const componentPublicConfig = utils.mergeObjects(
                    {},

                    // public common config
                    publicConfig.components?.[ spec.id ],

                    // service public config
                    publicConfig.services?.[ this.service ]?.components?.[ spec.id ]
                );

                // validate component public config
                const res = this.#validateComponentConfig( component, "public-config", componentPublicConfig );
                if ( !res.ok ) return res;

                // register component
                components[ component.id ] = component;
            }
            catch ( e ) {
                return result.catch( e );
            }
        }

        this.#components = components;

        return result( 200 );
    }

    async configure () {
        var res;

        // configure in the reverse order
        for ( const component of Object.values( this.#components ).reverse() ) {
            try {
                res = await component.configure();
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Failed to configure component. ${ res.statusText }` ] );
        }

        const components = this.#components;
        this.#components = {};

        // check enabled
        for ( const component of Object.values( components ) ) {
            let isEnabled;

            try {
                isEnabled = await component.checkEnabled();
            }
            catch ( e ) {
                res = result.catch( e );

                return result( [ res.status, `[${ component.id }] Failed to check component is enabled. ${ res.statusText }` ] );
            }

            // component is disabled
            if ( !isEnabled ) {

                // required component is disabled
                if ( component.isRequired ) {
                    return result( [ 500, `Required component "${ component.id }" is not enabled` ] );
                }

                continue;
            }

            this.#components[ component.id ] = component;
        }

        // check dependecies
        const usedComponents = new Set(),
            checkDependencies = component => {
                if ( usedComponents.has( component.id ) ) return result( 200 );

                usedComponents.add( component.id );

                for ( const dependency of component.dependencies ) {
                    if ( !this.has( dependency ) ) {
                        return result( [ 500, `Component "${ dependency }" required by "${ component.id }" is not enabled` ] );
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
            if ( !usedComponents.has( component.id ) ) delete this.#components[ component.id ];
        }

        // validate component env
        for ( const component of Object.values( this.#components ) ) {
            const res = this.#validateComponentConfig( component );

            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Component config is not valid. ${ res.statusText }` ] );
        }

        // add components templates
        for ( const component of Object.values( this.#components ) ) {
            if ( TEMPLATES_CACHE[ component.id ] ) {
                this.app.templates.add( TEMPLATES_CACHE[ component.id ] );
            }
        }
        TEMPLATES_CACHE = null;

        console.info( `Used components:`, Object.keys( this.#components ).sort().join( ", " ) || "-" );

        return result( 200 );
    }

    async install () {
        var res;

        for ( const component of this ) {
            try {
                res = await component.install();
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Failed to install component. ${ res.statusText }` ] );
        }

        return result( 200 );
    }

    async configureInstances () {
        var res;

        for ( const component of Object.values( this.#components ).reverse() ) {

            // configure component instance
            try {
                res = await component.configureInstance();
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Failed to configure component instance. ${ res.statusText }` ] );

            // validate component config
            res = this.#validateComponentConfig( component );
            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Component config is not valid. ${ res.statusText }` ] );

            // freeze component config
            utils.freezeObjectRecursively( component.config );
        }

        this.#ajvCache = null;

        return result( 200 );
    }

    async init () {
        var res;

        for ( const component of this ) {
            try {
                res = await component.init();
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Failed to init component instance. ${ res.statusText }` ] );
        }

        return result( 200 );
    }

    async start () {
        var res;

        for ( const component of this ) {
            if ( this.#isDestroying ) break;

            try {
                res = await component.start();
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Failed to start component instance. ${ res.statusText }` ] );
        }

        return result( 200 );
    }

    async afterAppStarted () {
        var res;

        for ( const component of this ) {
            if ( this.#isDestroying ) break;

            try {
                res = await component.afterAppStarted();
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( !res.ok ) return result( [ res.status, `[${ component.id }] Failed to start component instance after application started. ${ res.statusText }` ] );
        }

        return result( 200 );
    }

    async destroy () {
        this.#isDestroying = true;

        // destroy the components
        for ( const component of Object.values( this.#components ).reverse() ) {
            await component.destroy();
        }
    }

    getSchema ( type ) {
        return this.#createApiSchema( type );
    }

    [ Symbol.iterator ] () {
        return Object.values( this.#components ).values();
    }

    // private
    #loadConfig ( location, resolve, registry ) {
        const configLocation = utils.resolve( location + "/app.yaml", resolve );

        // config is already loaded
        if ( registry.loadedConfigs[ configLocation ] ) return result( 200 );

        if ( location !== "." ) this.#packages.push( location );

        registry.loadedConfigs[ configLocation ] = true;

        // read config
        const config = readConfigSync( configLocation, {
            resolve,
        } );

        // validate config
        if ( !appConfigValidate( config ) ) {
            return result( [ 500, `Application config "${ configLocation }" is not valid:\n${ appConfigValidate.errors }` ] );
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

            const componentName = dirent.name;

            // compinent id is not in kebab case
            if ( !isKebabCase( componentName ) ) {
                return result( [ 500, `Component id "${ componentName }" should be in the kebab-case` ] );
            }

            const componentId = kebabToCamelCase( componentName ),
                componentLocation = path.join( componentsLocation, componentName ),
                componentConfigPath = path.join( componentLocation, "config.yaml" ),
                componentModulePath = url.pathToFileURL( path.join( componentLocation, "component.js" ) );

            if ( registry.components[ componentId ] ) return result( [ 500, `Component "${ componentId }" is already registered` ] );

            // component config is is not exists
            if ( !fs.existsSync( componentConfigPath ) ) return result( [ 500, `Component config "${ componentConfigPath }" is not exists` ] );

            // component module is not exists
            if ( !fs.existsSync( componentModulePath ) ) return result( [ 500, `Component module "${ componentModulePath }" is not exists` ] );

            const componentConfig = readConfigSync( componentConfigPath );

            // validate component config structure
            if ( !appComponentConfigValidate( componentConfig ) ) {
                return result( [ 500, `Component config "${ componentConfigPath }" is not valid:\n${ appComponentConfigValidate.errors }` ] );
            }

            registry.components[ componentId ] = {
                "id": componentId,
                "location": componentLocation,
                "module": componentModulePath,
                "config": componentConfig,
            };
        }

        return result( 200 );
    }

    #createApiSchema ( type ) {
        const schema = new ApiSchema( type );

        if ( this.#components[ type ] ) {
            const locations = [];

            for ( const location of [ ...Object.values( this.#components ).map( component => component.location ), path.dirname( url.fileURLToPath( this.#location ) ) ] ) {
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
        var ajv = this.#ajvCache[ component.id ];

        if ( !ajv ) {
            const schemaPath = component.location + "/config.schema.yaml";

            if ( fs.existsSync( schemaPath ) ) {
                this.#ajvCache[ component.id ] = ajv = new Ajv().addSchema( component.applySubSchema( readConfigSync( schemaPath ) ) );
            }
        }

        if ( schema ) {
            if ( ajv?.getSchema( schema ) && !ajv.validate( schema, config ) ) {
                return result( [ 400, `Config schema "${ schema }" errors:\n` + ajv.errors ] );
            }
        }
        else {

            // validate env
            if ( ajv?.getSchema( "env" ) && !ajv.validate( "env", process.env ) ) {
                return result( [ 400, `Eenvironment errors:\n` + ajv.errors ] );
            }

            // validate config
            if ( ajv?.getSchema( "config" ) && !ajv.validate( "config", component.config ) ) {
                return result( [ 400, `Cconfig errors:\n` + ajv.errors ] );
            }
        }

        return result( 200 );
    }
}
