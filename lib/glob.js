// export { default } from "glob";

import glob from "glob";

export default glob;

glob.globSync = glob.sync;
