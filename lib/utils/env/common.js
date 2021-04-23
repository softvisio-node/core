module.exports = class Env {
    getBool ( name ) {
        const value = process.env[name];

        if ( value === true || value === "true" ) return true;

        return false;
    }
};
