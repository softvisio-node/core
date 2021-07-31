export default class Env {
    get mode () {
        return process.env.NODE_ENV || "production";
    }

    get isProduction () {
        return !process.env.NODE_ENV || process.env.NODE_ENV === "production";
    }

    get isDevelopment () {
        return process.env.NODE_ENV === "development";
    }

    get isTest () {
        return process.env.NODE_ENV === "test";
    }
}
