import module from "module";

export * from "@softvisio/utils";

// XXX remove, after import.meta.resolve will be released
export function resolve ( path, from ) {
    return module.createRequire( from ).resolve( path );
}
