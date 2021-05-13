export default class Env {
    readBoolValue ( name ) {
        const value = process.env[name];

        if ( value === true || value === "true" ) return true;

        return false;
    }
}
