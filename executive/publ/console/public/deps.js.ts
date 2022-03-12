/**
 * deps.js.ts is a Typescript-friendly Deno-style strategy of bringing in
 * selective server-side Typescript functions and modules into client-side
 * browser and other user agent Javascript.
 *
 * deps.js.ts should be Deno bundled into universal.auto.js assuming that
 * universal.auto.js exists as a "twin". The existence of the universal.auto.js
 * (even an empty one) is a signal to the bundler to generate the *.auto.js file.
 * HTML and client-side source pulls in *.auto.js but since it's generated from
 * this file we know it will be correct.
 *
 * REMINDER: deps.auto.js must exist in order for deps.js.ts to be bundled.
 *           if it doesn't exist just create a empty file named deps.auto.js
 */

// export * as fingerprintJS from "https://openfpcdn.io/fingerprintjs/v3.3.3/esm.min.js";
export * from "https://raw.githubusercontent.com/ihack2712/eventemitter/1.2.4/mod.ts";

export * from "../../../../lib/text/human.ts";
export * from "../../../../lib/text/whitespace.ts";
export * from "../../../../lib/conf/flexible-args.ts";
export * from "../../../../lib/text/detect-route.ts";
export * from "../../../../lib/service-bus/core/mod.ts";
export * from "../../../../lib/service-bus/service/ping.ts";
export * from "../../../../lib/service-bus/service/file-impact.ts";
export * from "../service/open-user-agent-window.ts";
export * from "../../../../lib/presentation/custom-element/badge/mod.ts";
export * from "../../../../lib/presentation/dom/markdown-it.js";
