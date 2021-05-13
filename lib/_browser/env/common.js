export default class Env {
    get mode () {
        return process.env.NODE_ENV || "production";
    }

    set mode ( value ) {
        process.env.NODE_ENV = value || "production";
    }

    get isProduction () {
        return this.mode === "production";
    }

    get isDevelopment () {
        return this.mode === "development";
    }

    readBoolValue ( name ) {
        const value = process.env[name];

        if ( value === true || value === "true" ) return true;

        return false;
    }
}
